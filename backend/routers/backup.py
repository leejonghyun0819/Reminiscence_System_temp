# backend/routers/backup.py
import os
import shutil
import json
from urllib.parse import unquote, urlparse
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import ALBUMS_DIR, ENHANCED_DIR
from database import get_db_cursor
from models import MoveFolderRequest, BatchMoveFoldersRequest, BatchAlbumIdsRequest
from utils.file_utils import (
    find_album_folder_path,
    read_album_meta,
    internal_move_single_album,
    restore_memory_from_meta,
)

router = APIRouter(prefix="/api/backup-albums", tags=["Backup"])

# ==============================================================================
# 안전한 앨범 폴더 경로 탐색 및 영구 삭제 헬퍼
# ==============================================================================
def _is_path_inside(path: str, root: str) -> bool:
    """실제 경로 기준으로 path가 root 내부인지 확인한다."""
    real_path = os.path.realpath(path)
    real_root = os.path.realpath(root)
    try:
        return os.path.commonpath([real_path, real_root]) == real_root
    except ValueError:
        return False


def _validate_deletable_album_path(folder_path: str) -> str:
    """
    앨범 폴더만 삭제할 수 있도록 경로를 제한한다.
    albums 루트와 enhanced 공용 폴더는 어떤 경우에도 삭제하지 않는다.
    """
    real_folder = os.path.realpath(folder_path)
    real_albums = os.path.realpath(ALBUMS_DIR)
    real_enhanced = os.path.realpath(ENHANCED_DIR)

    if not _is_path_inside(real_folder, real_albums):
        raise ValueError("앨범 저장소 밖의 경로는 삭제할 수 없습니다.")
    if real_folder in {real_albums, real_enhanced}:
        raise ValueError("앨범 저장소 루트는 삭제할 수 없습니다.")
    if _is_path_inside(real_folder, real_enhanced):
        raise ValueError("공용 화질 복원 폴더는 앨범으로 삭제할 수 없습니다.")
    if not os.path.isdir(real_folder):
        raise FileNotFoundError("Album not found")
    if not os.path.isfile(os.path.join(real_folder, "album_meta.json")):
        raise ValueError("album_meta.json이 없는 폴더는 삭제할 수 없습니다.")

    return real_folder


def resolve_album_path(album_id: str) -> str:
    path = find_album_folder_path(album_id)
    if path:
        try:
            return _validate_deletable_album_path(path)
        except (FileNotFoundError, ValueError):
            pass

    if os.path.exists(ALBUMS_DIR):
        for root, dirs, files in os.walk(ALBUMS_DIR):
            # 공용 AI 복원 결과 폴더는 탐색 대상에서 제외한다.
            dirs[:] = [
                name
                for name in dirs
                if os.path.realpath(os.path.join(root, name)) != os.path.realpath(ENHANCED_DIR)
            ]

            if "album_meta.json" not in files:
                continue

            try:
                if os.path.basename(root) == str(album_id):
                    return _validate_deletable_album_path(root)

                with open(os.path.join(root, "album_meta.json"), "r", encoding="utf-8") as f:
                    meta = json.load(f)
                if str(meta.get("id")) == str(album_id):
                    return _validate_deletable_album_path(root)
            except (OSError, json.JSONDecodeError, TypeError, ValueError):
                continue

    return ""


def _normalise_url_path(value: object) -> str:
    if not value:
        return ""
    try:
        return unquote(urlparse(str(value)).path).replace("\\", "/")
    except (TypeError, ValueError):
        return ""


def _json_string_list(raw_value: object) -> List[str]:
    if isinstance(raw_value, list):
        return [str(value) for value in raw_value if value]
    if not raw_value:
        return []
    try:
        loaded = json.loads(str(raw_value))
        return [str(value) for value in loaded if value] if isinstance(loaded, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _meta_media_urls(meta: dict) -> List[str]:
    urls = _json_string_list(meta.get("imageUrls"))
    audio_url = meta.get("audioUrl")
    if audio_url:
        urls.append(str(audio_url))
    return urls


def _row_media_urls(row: dict) -> List[str]:
    urls = _json_string_list(row.get("image_urls_json"))
    if row.get("audio_url"):
        urls.append(str(row["audio_url"]))
    return urls


def _enhanced_filename_from_url(value: object) -> Optional[str]:
    path = _normalise_url_path(value)
    if not path.startswith("/enhanced/"):
        return None
    filename = os.path.basename(path)
    return filename or None


def _memory_id_matches_album(memory_id: str, identifiers: set[str]) -> bool:
    if memory_id in identifiers:
        return True
    return any(memory_id.startswith(f"restored_{identifier}_") for identifier in identifiers)


def _load_memory_rows() -> List[dict]:
    with get_db_cursor() as cursor:
        cursor.execute("SELECT id, image_urls_json, audio_url FROM memories")
        return [dict(row) for row in cursor.fetchall()]


def _find_related_memory_ids(
    folder_path: str,
    album_id: str,
    meta: dict,
    memory_rows: List[dict],
) -> List[str]:
    identifiers = {
        str(value)
        for value in (album_id, os.path.basename(folder_path), meta.get("id"))
        if value
    }
    relative_folder = os.path.relpath(folder_path, ALBUMS_DIR).replace(os.sep, "/")
    album_url_prefix = f"/albums/{relative_folder}"

    related_ids = []
    for row in memory_rows:
        memory_id = str(row.get("id", ""))
        row_paths = [_normalise_url_path(url) for url in _row_media_urls(row)]
        points_to_album = any(
            path == album_url_prefix or path.startswith(f"{album_url_prefix}/")
            for path in row_paths
        )
        if _memory_id_matches_album(memory_id, identifiers) or points_to_album:
            related_ids.append(memory_id)

    return related_ids


def _is_generated_for_album(filename: str, identifiers: set[str]) -> bool:
    generated_markers = ("_enhanced_", "_colorized_")
    if not any(marker in filename for marker in generated_markers):
        return False

    for identifier in identifiers:
        if filename.startswith(f"{identifier}_"):
            return True
        if filename.startswith(f"restored_{identifier}_"):
            return True
    return False


def _collect_enhanced_candidates(
    folder_path: str,
    album_id: str,
    meta: dict,
    related_memory_ids: List[str],
    memory_rows: List[dict],
) -> set[str]:
    candidates = {
        filename
        for filename in (
            _enhanced_filename_from_url(url)
            for url in _meta_media_urls(meta)
        )
        if filename
    }

    related_id_set = set(related_memory_ids)
    for row in memory_rows:
        if str(row.get("id", "")) not in related_id_set:
            continue
        for url in _row_media_urls(row):
            filename = _enhanced_filename_from_url(url)
            if filename:
                candidates.add(filename)

    identifiers = {
        str(value)
        for value in (
            album_id,
            os.path.basename(folder_path),
            meta.get("id"),
            *related_memory_ids,
        )
        if value
    }
    if os.path.isdir(ENHANCED_DIR):
        for filename in os.listdir(ENHANCED_DIR):
            full_path = os.path.join(ENHANCED_DIR, filename)
            if os.path.isfile(full_path) and _is_generated_for_album(filename, identifiers):
                candidates.add(filename)

    return candidates


def _collect_shared_enhanced_references(
    deleted_folder_path: str,
    excluded_memory_ids: set[str],
    memory_rows: List[dict],
) -> set[str]:
    """삭제 대상 외의 DB/메타가 사용 중인 공용 개선 파일명을 수집한다."""
    shared = set()

    for row in memory_rows:
        if str(row.get("id", "")) in excluded_memory_ids:
            continue
        for url in _row_media_urls(row):
            filename = _enhanced_filename_from_url(url)
            if filename:
                shared.add(filename)

    if os.path.isdir(ALBUMS_DIR):
        for root, dirs, files in os.walk(ALBUMS_DIR):
            dirs[:] = [
                name
                for name in dirs
                if os.path.realpath(os.path.join(root, name)) != os.path.realpath(ENHANCED_DIR)
            ]
            if _is_path_inside(root, deleted_folder_path):
                continue
            if "album_meta.json" not in files:
                continue

            other_meta = read_album_meta(root)
            for url in _meta_media_urls(other_meta):
                filename = _enhanced_filename_from_url(url)
                if filename:
                    shared.add(filename)

    return shared


def _delete_related_memory_rows(memory_ids: List[str]) -> Optional[str]:
    if not memory_ids:
        return None

    placeholders = ", ".join("?" for _ in memory_ids)
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                f"DELETE FROM memories WHERE id IN ({placeholders})",
                tuple(memory_ids),
            )
        return None
    except Exception as exc:
        return f"DB 레코드 정리 실패: {exc}"


def _delete_unshared_enhanced_files(
    candidates: set[str],
    shared_references: set[str],
) -> tuple[List[str], List[str]]:
    deleted_files = []
    cleanup_errors = []

    for filename in sorted(candidates - shared_references):
        file_path = os.path.realpath(os.path.join(ENHANCED_DIR, filename))
        if not _is_path_inside(file_path, ENHANCED_DIR):
            cleanup_errors.append(f"안전하지 않은 개선 파일 경로: {filename}")
            continue
        if not os.path.isfile(file_path):
            continue

        try:
            os.remove(file_path)
            deleted_files.append(filename)
        except OSError as exc:
            cleanup_errors.append(f"{filename} 삭제 실패: {exc}")

    return deleted_files, cleanup_errors


def _delete_album_permanently(album_id: str) -> dict:
    folder_path = resolve_album_path(album_id)
    if not folder_path:
        raise FileNotFoundError("Album not found")

    folder_path = _validate_deletable_album_path(folder_path)
    meta = read_album_meta(folder_path)
    memory_rows = _load_memory_rows()
    related_memory_ids = _find_related_memory_ids(
        folder_path,
        album_id,
        meta,
        memory_rows,
    )
    enhanced_candidates = _collect_enhanced_candidates(
        folder_path,
        album_id,
        meta,
        related_memory_ids,
        memory_rows,
    )
    shared_references = _collect_shared_enhanced_references(
        folder_path,
        set(related_memory_ids),
        memory_rows,
    )

    # 앨범 폴더 삭제가 실패하면 DB와 공용 개선본은 건드리지 않는다.
    shutil.rmtree(folder_path)

    cleanup_errors = []
    db_error = _delete_related_memory_rows(related_memory_ids)
    if db_error:
        cleanup_errors.append(db_error)

    deleted_enhanced_files, enhanced_errors = _delete_unshared_enhanced_files(
        enhanced_candidates,
        shared_references,
    )
    cleanup_errors.extend(enhanced_errors)

    return {
        "albumId": album_id,
        "deletedFolder": os.path.relpath(folder_path, ALBUMS_DIR).replace(os.sep, "/"),
        "deletedMemoryIds": related_memory_ids,
        "deletedEnhancedFiles": deleted_enhanced_files,
        "cleanupErrors": cleanup_errors,
    }


# ==============================================================================
# 파일명 변경 요청 스키마 및 엔드포인트
# ==============================================================================
class RenameAlbumFileRequest(BaseModel):
    oldFileName: str
    newFileName: str

@router.post("/{album_id}/rename-file")
def rename_backup_album_file(album_id: str, payload: RenameAlbumFileRequest):
    """
    백업 앨범 내부의 미디어 파일명 변경
    - URL 인코딩 및 파라미터 자동 정규화
    - 디스크 파일명 변경 (os.rename)
    - album_meta.json 및 DB 레코드 동기화
    """
    folder_path = resolve_album_path(album_id)
    if not folder_path or not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail=f"앨범 폴더를 찾을 수 없습니다. (ID: {album_id})")

    # URL 디코딩 및 순수 파일명 추출
    raw_old = unquote(payload.oldFileName.strip()).split("?")[0]
    raw_new = unquote(payload.newFileName.strip()).split("?")[0]

    old_name = os.path.basename(raw_old)
    new_name = os.path.basename(raw_new)

    if not old_name or not new_name:
        raise HTTPException(status_code=400, detail="유효한 파일명을 입력해주세요.")

    # 확장자 유지 보장
    old_ext = os.path.splitext(old_name)[1]
    if old_ext and not new_name.endswith(old_ext):
        new_name += old_ext

    old_file_path = os.path.join(folder_path, old_name)
    new_file_path = os.path.join(folder_path, new_name)

    if not os.path.exists(old_file_path):
        raise HTTPException(status_code=404, detail=f"대상 파일을 찾을 수 없습니다: {old_name}")

    if os.path.exists(new_file_path) and old_file_path != new_file_path:
        raise HTTPException(status_code=400, detail="이미 동일한 이름의 파일이 존재합니다.")

    try:
        # 1. 실제 물리 디스크 파일 이름 변경
        if old_file_path != new_file_path:
            os.rename(old_file_path, new_file_path)

        # 2. album_meta.json 동기화
        meta_path = os.path.join(folder_path, "album_meta.json")
        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta_data = json.load(f)

                if "media_files" in meta_data and isinstance(meta_data["media_files"], list):
                    meta_data["media_files"] = [
                        new_name if f == old_name else f for f in meta_data["media_files"]
                    ]

                if "imageUrls" in meta_data and isinstance(meta_data["imageUrls"], list):
                    meta_data["imageUrls"] = [
                        url.replace(old_name, new_name) if old_name in url else url
                        for url in meta_data["imageUrls"]
                    ]

                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(meta_data, f, ensure_ascii=False, indent=2)
            except Exception as meta_err:
                print(f"[Warning] album_meta.json 갱신 실패: {meta_err}")

        # 3. SQLite DB memories 테이블 동기화 (존재 시)
        try:
            with get_db_cursor() as cursor:
                cursor.execute("SELECT id, image_urls_json FROM memories WHERE id = ?", (album_id,))
                row = cursor.fetchone()
                if row and row["image_urls_json"]:
                    updated_urls = row["image_urls_json"].replace(old_name, new_name)
                    cursor.execute("UPDATE memories SET image_urls_json = ? WHERE id = ?", (updated_urls, album_id))
        except Exception:
            pass

        return {"status": "success", "oldFileName": old_name, "newFileName": new_name}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일명 변경 중 오류 발생: {str(e)}")

# ==============================================================================
# 기존 백업 앨범 관리 라우터
# ==============================================================================
@router.get("")
def get_backup_albums():
    albums_list = []
    ROOT_CATEGORIES = ["유년시절", "여행"]

    if os.path.exists(ALBUMS_DIR):
        for root, _, files in os.walk(ALBUMS_DIR):
            if "enhanced" in root.split(os.sep):
                continue

            if "album_meta.json" in files:
                meta = read_album_meta(root)
                if meta:
                    folder_name = os.path.basename(root)
                    meta["id"] = meta.get("id") or folder_name

                    rel_parts = os.path.relpath(root, ALBUMS_DIR).split(os.sep)

                    detected_root = None
                    if len(rel_parts) >= 2 and rel_parts[0] in ROOT_CATEGORIES:
                        detected_root = rel_parts[0]
                        if not meta.get("categoryFolder"):
                            meta["categoryFolder"] = rel_parts[1]
                    else:
                        # 유년/여행 구조가 생기기 전에 만들어진 레거시 앨범은
                        # 임의로 여행으로 지정하지 않고 미분류 상태를 유지한다.
                        parent_name = os.path.basename(os.path.dirname(root))
                        if parent_name != "albums" and not meta.get("categoryFolder"):
                            meta["categoryFolder"] = parent_name
                        else:
                            meta["categoryFolder"] = meta.get("categoryFolder") or "미분류"

                    if not meta.get("mode") and detected_root:
                        meta["mode"] = "childhood" if detected_root == "유년시절" else "travel"
                    if not meta.get("rootCategory") and detected_root:
                        meta["rootCategory"] = detected_root

                    albums_list.append(meta)

    albums_list.sort(key=lambda x: x.get("createdAt", 0), reverse=True)
    return albums_list

@router.put("/{album_id}/move")
def move_backup_album_folder(album_id: str, payload: MoveFolderRequest):
    if not internal_move_single_album(album_id, payload.categoryFolder):
        raise HTTPException(status_code=404, detail="Album folder not found")
    return {"status": "success", "categoryFolder": payload.categoryFolder}

@router.post("/batch-move")
def batch_move_backup_albums(payload: BatchMoveFoldersRequest):
    moved_count = sum(1 for a_id in payload.albumIds if internal_move_single_album(a_id, payload.categoryFolder))
    return {"status": "success", "movedCount": moved_count, "categoryFolder": payload.categoryFolder}

@router.delete("/{album_id}")
def delete_single_backup_album(album_id: str):
    try:
        result = _delete_album_permanently(album_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Album not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"앨범 폴더 삭제 실패: {exc}")

    return {
        "status": "partial" if result["cleanupErrors"] else "success",
        **result,
    }


@router.post("/batch-delete")
def batch_delete_backup_albums(payload: BatchAlbumIdsRequest):
    results = []
    failures = []

    # 같은 ID가 여러 번 전달돼도 실제 삭제는 한 번만 수행한다.
    for album_id in dict.fromkeys(payload.albumIds):
        try:
            result = _delete_album_permanently(album_id)
            results.append(result)
        except (FileNotFoundError, ValueError, OSError) as exc:
            failures.append({"albumId": album_id, "detail": str(exc)})

    has_cleanup_errors = any(result["cleanupErrors"] for result in results)
    status = "success"
    if failures or has_cleanup_errors:
        status = "partial" if results else "failure"

    return {
        "status": status,
        "deletedCount": len(results),
        "failedIds": [failure["albumId"] for failure in failures],
        "failures": failures,
        "results": results,
    }

@router.post("/{album_id}/restore")
def restore_backup_album(album_id: str):
    folder_path = resolve_album_path(album_id)
    if not folder_path:
        raise HTTPException(status_code=404, detail="Album not found")

    with get_db_cursor() as cursor:
        restored_item = restore_memory_from_meta(folder_path, cursor)
        if not restored_item:
            raise HTTPException(status_code=500, detail="Failed to restore album meta")
        return {"status": "success", "restoredItem": restored_item}

@router.post("/batch-restore")
def batch_restore_backup_albums(payload: BatchAlbumIdsRequest):
    restored_items = []
    with get_db_cursor() as cursor:
        for album_id in payload.albumIds:
            folder_path = resolve_album_path(album_id)
            if not folder_path:
                continue
            try:
                item = restore_memory_from_meta(folder_path, cursor)
                if item:
                    restored_items.append(item)
            except Exception as e:
                print(f"앨범 일괄 복원 실패 ({album_id}): {e}")

    return {"status": "success", "restoredItems": restored_items}