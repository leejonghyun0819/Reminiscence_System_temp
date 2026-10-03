# backend/routers/memories.py
import os
import json
import time
import shutil
from typing import Optional, List
from urllib.parse import urlparse, unquote
from fastapi import APIRouter, File, UploadFile, Form, HTTPException

from config import ALBUMS_DIR, ENHANCED_DIR
from database import get_db_cursor
from models import UpdateMemoryRequest, SwapImageRequest, DeleteImageRequest, AppendImageRequest
from utils.media_utils import save_media_file, enhance_image_with_youcam, colorize_image_with_youcam
from utils.file_utils import (
    row_to_memory_dict,
    find_album_folder_path,
    read_album_meta,
    write_album_meta,
)

router = APIRouter(prefix="/api/memories", tags=["Memories"])


def find_local_media_path(target_url: str) -> str:
    """URL로부터 로컬 디스크의 실제 이미지 파일 경로를 완벽하게 탐색"""
    parsed = urlparse(target_url)
    rel_path = parsed.path.lstrip("/")
    file_name = os.path.basename(rel_path)

    # 1. /enhanced/ 경로인 경우
    if rel_path.startswith("enhanced/"):
        enhanced_path = os.path.join(ENHANCED_DIR, file_name)
        if os.path.exists(enhanced_path) and os.path.isfile(enhanced_path):
            return enhanced_path

    # 2. /albums/ 경로인 경우
    if rel_path.startswith("albums/"):
        album_sub_path = rel_path[len("albums/"):].lstrip("/")
        direct_album_path = os.path.join(ALBUMS_DIR, album_sub_path)
        if os.path.exists(direct_album_path) and os.path.isfile(direct_album_path):
            return direct_album_path

    # 3. ENHANCED_DIR 탐색
    fallback_enhanced = os.path.join(ENHANCED_DIR, file_name)
    if os.path.exists(fallback_enhanced) and os.path.isfile(fallback_enhanced):
        return fallback_enhanced

    # 4. ALBUMS_DIR 재귀 탐색
    for root, _, files in os.walk(ALBUMS_DIR):
        if file_name in files:
            found = os.path.join(root, file_name)
            if os.path.isfile(found):
                return found

    # 5. 프로젝트 상위 루트 기준 탐색
    project_root = os.path.dirname(ALBUMS_DIR)
    root_direct_path = os.path.join(project_root, rel_path)
    if os.path.exists(root_direct_path) and os.path.isfile(root_direct_path):
        return root_direct_path

    raise HTTPException(status_code=404, detail="서버에 해당 원본 파일이 존재하지 않습니다.")


def _is_path_inside(path: str, root: str) -> bool:
    real_path = os.path.realpath(path)
    real_root = os.path.realpath(root)
    try:
        return os.path.commonpath([real_path, real_root]) == real_root
    except ValueError:
        return False


def _normalise_media_url_path(value: str) -> str:
    if not value:
        return ""
    try:
        return unquote(urlparse(value).path).replace("\\", "/")
    except (TypeError, ValueError):
        return ""


def _parse_url_list(raw_value: object) -> List[str]:
    if isinstance(raw_value, list):
        return [str(value) for value in raw_value if value]
    if not raw_value:
        return []
    try:
        loaded = json.loads(str(raw_value))
        return [str(value) for value in loaded if value] if isinstance(loaded, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _is_media_referenced_elsewhere(
    target_url: str,
    memory_id: str,
    album_folder_path: Optional[str],
    remaining_urls: List[str],
) -> bool:
    """현재 앨범 외의 DB/메타가 같은 공용 미디어를 사용하는지 확인한다."""
    target_path = _normalise_media_url_path(target_url)
    if not target_path:
        return True

    if any(_normalise_media_url_path(url) == target_path for url in remaining_urls):
        return True

    with get_db_cursor() as cursor:
        cursor.execute("SELECT id, image_urls_json FROM memories WHERE id != ?", (memory_id,))
        for row in cursor.fetchall():
            if any(
                _normalise_media_url_path(url) == target_path
                for url in _parse_url_list(row["image_urls_json"])
            ):
                return True

    if os.path.isdir(ALBUMS_DIR):
        for root, dirs, files in os.walk(ALBUMS_DIR):
            dirs[:] = [
                name
                for name in dirs
                if os.path.realpath(os.path.join(root, name)) != os.path.realpath(ENHANCED_DIR)
            ]
            if album_folder_path and os.path.realpath(root) == os.path.realpath(album_folder_path):
                continue
            if "album_meta.json" not in files:
                continue

            meta = read_album_meta(root)
            if any(
                _normalise_media_url_path(url) == target_path
                for url in _parse_url_list(meta.get("imageUrls"))
            ):
                return True

    return False


def _delete_album_media_files(
    memory_id: str,
    target_url: str,
    remaining_urls: List[str],
    album_folder_path: Optional[str],
    metadata_synced: bool,
) -> tuple[List[str], List[str]]:
    """개별 삭제된 미디어의 앨범 사본과 미사용 공용 개선본을 물리적으로 제거한다."""
    deleted_files = []
    cleanup_errors = []
    target_path = _normalise_media_url_path(target_url)
    filename = os.path.basename(target_path)

    if not filename or not metadata_synced:
        if not metadata_synced:
            cleanup_errors.append("album_meta.json 동기화를 확인하지 못해 실제 파일 삭제를 중단했습니다.")
        return deleted_files, cleanup_errors

    candidates = []
    remaining_names = {
        os.path.basename(_normalise_media_url_path(url))
        for url in remaining_urls
        if _normalise_media_url_path(url)
    }

    # AI 개선본은 공용 enhanced 폴더와 앨범 폴더에 각각 저장된다.
    if album_folder_path and filename not in remaining_names:
        local_copy = os.path.realpath(os.path.join(album_folder_path, filename))
        if _is_path_inside(local_copy, album_folder_path) and os.path.isfile(local_copy):
            candidates.append(local_copy)

    if (
        target_path.startswith("/enhanced/")
        and not _is_media_referenced_elsewhere(
            target_url,
            memory_id,
            album_folder_path,
            remaining_urls,
        )
    ):
        shared_copy = os.path.realpath(os.path.join(ENHANCED_DIR, filename))
        if _is_path_inside(shared_copy, ENHANCED_DIR) and os.path.isfile(shared_copy):
            candidates.append(shared_copy)

    for file_path in dict.fromkeys(candidates):
        try:
            os.remove(file_path)
            deleted_files.append(os.path.relpath(file_path, ALBUMS_DIR).replace(os.sep, "/"))
        except OSError as exc:
            cleanup_errors.append(f"{os.path.basename(file_path)} 삭제 실패: {exc}")

    return deleted_files, cleanup_errors


@router.get("")
def get_all_memories():
    """모든 추억 앨범 목록 조회"""
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM memories ORDER BY created_at DESC")
        rows = cursor.fetchall()
        return [row_to_memory_dict(r) for r in rows]


@router.post("")
async def create_multi_memory(
    id: str = Form(...),
    analysisJson: str = Form(...),
    imageFiles: List[UploadFile] = File(...),
    audioFile: Optional[UploadFile] = File(None),
    categoryFolder: str = Form("미분류")
):
    """새로운 멀티모달 추억 앨범 생성 및 디스크/DB 저장"""
    try:
        raw = json.loads(analysisJson)

        if isinstance(raw, list):
            target = raw[0] if len(raw) > 0 and isinstance(raw[0], dict) else {}
        elif isinstance(raw, dict):
            target = raw.get("analysis", raw) if isinstance(raw.get("analysis"), dict) else raw
        else:
            target = {}

        # 🌟 mode 감지 ('childhood' -> '유년시절', 그 외 -> '여행')
        raw_mode = raw.get("mode") or target.get("mode") or "travel"
        root_category = "유년시절" if raw_mode == "childhood" else "여행"

        title = target.get("title") or target.get("albumTitle") or "추억의 순간"
        location = target.get("location") or target.get("place") or "장소 미상"
        year_estimate = target.get("yearEstimate") or target.get("year_estimate") or target.get("date") or "시기 미상"
        description = target.get("description") or target.get("summary") or ""
        story_caption = target.get("storyCaption") or target.get("story_caption") or target.get("caption") or ""
        audio_transcript_summary = target.get("audioTranscriptSummary") or target.get("audio_transcript_summary") or ""

        analysis_dict = {
            "title": title,
            "location": location,
            "yearEstimate": year_estimate,
            "description": description,
            "storyCaption": story_caption,
            "audioTranscriptSummary": audio_transcript_summary,
        }

        # 🌟 대분류(유년시절/여행) 경로 하위에 폴더 및 앨범 배치
        folder_clean = categoryFolder if (categoryFolder and categoryFolder != "미분류") else "미분류"
        parent_dir = os.path.join(ALBUMS_DIR, root_category, folder_clean)
        os.makedirs(parent_dir, exist_ok=True)

        album_folder = os.path.join(parent_dir, id)
        relative_url_prefix = f"{root_category}/{folder_clean}/{id}"
        os.makedirs(album_folder, exist_ok=True)

        file_names = []
        image_urls = []

        for idx, img_file in enumerate(imageFiles):
            fname, furl = await save_media_file(img_file, album_folder, idx, relative_url_prefix)
            file_names.append(fname)
            image_urls.append(furl)

        audio_url = None
        audio_file_name = None
        if audioFile:
            audio_file_name = audioFile.filename
            a_ext = os.path.splitext(audio_file_name)[1] or ".mp3"
            a_saved_name = f"audio{a_ext}"
            a_save_path = os.path.join(album_folder, a_saved_name)
            with open(a_save_path, "wb") as buffer:
                shutil.copyfileobj(audioFile.file, buffer)
            audio_url = f"http://localhost:8000/albums/{relative_url_prefix}/{a_saved_name}"

        initial_history = [{
            "version": 1,
            "timestamp": int(time.time() * 1000),
            "title": title,
            "location": location,
            "yearEstimate": year_estimate,
            "description": description,
            "storyCaption": story_caption
        }]

        album_meta = {
            "id": id,
            "mode": raw_mode,
            "rootCategory": root_category,
            "fileNames": file_names,
            "imageUrls": image_urls,
            "audioFileName": audio_file_name,
            "audioUrl": audio_url,
            "categoryFolder": categoryFolder,
            "analysis": analysis_dict,
            "curatedNote": raw.get("curatedNote"),
            "interviewData": raw.get("interviewData"),
            "history": initial_history,
            "createdAt": int(os.path.getmtime(album_folder) * 1000)
        }
        write_album_meta(album_folder, album_meta)

        with get_db_cursor() as cursor:
            cursor.execute("""
                INSERT INTO memories (
                    id, file_names_json, image_urls_json, audio_file_name, audio_url,
                    title, location, year_estimate, description, story_caption, audio_transcript_summary, category_folder, history_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                id,
                json.dumps(file_names, ensure_ascii=False),
                json.dumps(image_urls, ensure_ascii=False),
                audio_file_name,
                audio_url,
                title,
                location,
                year_estimate,
                description,
                story_caption,
                audio_transcript_summary,
                categoryFolder,
                json.dumps(initial_history, ensure_ascii=False)
            ))

        return {
            "id": id,
            "mode": raw_mode,
            "rootCategory": root_category,
            "fileNames": file_names,
            "imageUrls": image_urls,
            "audioFileName": audio_file_name,
            "audioUrl": audio_url,
            "categoryFolder": categoryFolder,
            "history": initial_history,
            "analysis": analysis_dict,
            "curatedNote": raw.get("curatedNote"),
            "interviewData": raw.get("interviewData"),
        }
    except Exception as e:
        print(f"Error creating multi-memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{memory_id}/append-files")
async def append_files_to_memory(
    memory_id: str,
    newImageFiles: List[UploadFile] = File(...)
):
    """기존 추억 앨범에 사진/동영상 추가"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM memories WHERE id = ?", (memory_id,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Memory not found")

            current_file_names = json.loads(row["file_names_json"])
            current_image_urls = json.loads(row["image_urls_json"])

        album_folder_path = find_album_folder_path(memory_id)
        if not album_folder_path or not os.path.exists(album_folder_path):
            raise HTTPException(status_code=404, detail="Album directory not found")

        rel_path = os.path.relpath(album_folder_path, ALBUMS_DIR).replace("\\", "/")
        start_idx = len(current_image_urls)

        for idx_offset, img_file in enumerate(newImageFiles):
            fname, furl = await save_media_file(img_file, album_folder_path, start_idx + idx_offset, rel_path)
            current_file_names.append(fname)
            current_image_urls.append(furl)

        with get_db_cursor() as cursor:
            cursor.execute(
                "UPDATE memories SET file_names_json = ?, image_urls_json = ? WHERE id = ?",
                (json.dumps(current_file_names, ensure_ascii=False), json.dumps(current_image_urls, ensure_ascii=False), memory_id)
            )

        meta = read_album_meta(album_folder_path)
        if meta:
            meta["fileNames"] = current_file_names
            meta["imageUrls"] = current_image_urls
            write_album_meta(album_folder_path, meta)

        return {
            "status": "success",
            "fileNames": current_file_names,
            "imageUrls": current_image_urls
        }
    except Exception as e:
        print(f"Error appending files: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# backend/routers/memories.py 의 update_memory 함수 부분

@router.put("/{memory_id}")
def update_memory(memory_id: str, payload: UpdateMemoryRequest):
    """추억 앨범 텍스트 정보 업데이트 및 대분류(유년시절/여행) 물리 폴더 자동 이동"""
    old_history = []
    current_mode = None
    current_category = "미분류"

    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM memories WHERE id = ?", (memory_id,))
        row = cursor.fetchone()

        if row:
            if "history_json" in row.keys() and row["history_json"]:
                try:
                    old_history = json.loads(row["history_json"])
                except Exception:
                    pass

            current_category = row["category_folder"] or "미분류"

            update_fields = []
            values = []

            if payload.title is not None: update_fields.append("title = ?"); values.append(payload.title)
            if payload.location is not None: update_fields.append("location = ?"); values.append(payload.location)
            if payload.yearEstimate is not None: update_fields.append("year_estimate = ?"); values.append(payload.yearEstimate)
            if payload.description is not None: update_fields.append("description = ?"); values.append(payload.description)
            if payload.storyCaption is not None: update_fields.append("story_caption = ?"); values.append(payload.storyCaption)
            if payload.categoryFolder is not None: 
                update_fields.append("category_folder = ?")
                values.append(payload.categoryFolder)
                current_category = payload.categoryFolder

            if update_fields:
                values.append(memory_id)
                cursor.execute(f"UPDATE memories SET {', '.join(update_fields)} WHERE id = ?", tuple(values))

    # 🌟 1. 물리 앨범 폴더 위치 탐색
    album_folder_path = find_album_folder_path(memory_id)
    if not album_folder_path or not os.path.exists(album_folder_path):
        raise HTTPException(status_code=404, detail="디스크에서 앨범 폴더를 찾을 수 없습니다.")

    meta = read_album_meta(album_folder_path) or {}

    # 🌟 2. 목표 대분류(유년시절 vs 여행) 산출
    target_mode = payload.mode or meta.get("mode") or "childhood"
    target_root_cat = "유년시절" if target_mode == "childhood" else "여행"
    target_sub_folder = payload.categoryFolder or meta.get("categoryFolder") or current_category or "미분류"

    # 목표 디렉터리 경로: backend/albums/{유년시절|여행}/{서브폴더}/{memory_id}
    target_parent_dir = os.path.join(ALBUMS_DIR, target_root_cat, target_sub_folder)
    target_album_path = os.path.join(target_parent_dir, memory_id)

    # 🌟 3. 현재 위치와 목표 위치가 다르면 실제 물리 디스크 이동 실행!
    if os.path.abspath(album_folder_path) != os.path.abspath(target_album_path):
        print(f"\n🚚 [앨범 물리 폴더 대분류 자동 이동]")
        print(f"   - 기존 경로: {album_folder_path}")
        print(f"   - 이동 경로: {target_album_path}")
        
        os.makedirs(target_parent_dir, exist_ok=True)
        shutil.move(album_folder_path, target_album_path)
        album_folder_path = target_album_path

        # 이동 후 relative prefix 갱신 및 imageUrls 갱신
        new_prefix = f"{target_root_cat}/{target_sub_folder}/{memory_id}"
        old_image_urls = meta.get("imageUrls", [])
        new_image_urls = []
        for u in old_image_urls:
            fname = os.path.basename(u.split("?")[0])
            new_image_urls.append(f"http://localhost:8000/albums/{new_prefix}/{fname}")
        meta["imageUrls"] = new_image_urls

        # DB imageUrls 동기화
        with get_db_cursor() as cursor:
            cursor.execute(
                "UPDATE memories SET image_urls_json = ? WHERE id = ?",
                (json.dumps(new_image_urls, ensure_ascii=False), memory_id)
            )

    # 🌟 4. album_meta.json 갱신
    an = meta.get("analysis", {})
    if payload.title is not None: an["title"] = payload.title
    if payload.location is not None: an["location"] = payload.location
    if payload.yearEstimate is not None: an["yearEstimate"] = payload.yearEstimate
    if payload.description is not None: an["description"] = payload.description
    if payload.storyCaption is not None: an["storyCaption"] = payload.storyCaption
    
    meta["mode"] = target_mode
    meta["rootCategory"] = target_root_cat
    meta["categoryFolder"] = target_sub_folder
    meta["analysis"] = an
    if payload.curatedNote is not None: meta["curatedNote"] = payload.curatedNote
    if payload.interviewData is not None: meta["interviewData"] = payload.interviewData

    write_album_meta(album_folder_path, meta)
    print(f"💾 [앨범 대분류 동기화 완료]: mode={target_mode}, rootCategory={target_root_cat}\n")

    return {"status": "success", "mode": target_mode, "rootCategory": target_root_cat}

@router.post("/{memory_id}/enhance-image")
async def enhance_single_image(
    memory_id: str,
    targetImageUrl: str = Form(...)
):
    """YouCam AI 초고화질 개선 (Super Resolution)"""
    try:
        local_file_path = find_local_media_path(targetImageUrl)
        new_enhanced_url = enhance_image_with_youcam(local_file_path, memory_id)

        return {
            "status": "success",
            "oldUrl": targetImageUrl,
            "newUrl": new_enhanced_url
        }
    except Exception as e:
        print(f"YouCam 화질 개선 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{memory_id}/colorize-image")
async def colorize_single_image(
    memory_id: str,
    targetImageUrl: str = Form(...)
):
    """🎨 YouCam AI 흑백 사진 컬러 복원 (Colorize)"""
    try:
        local_file_path = find_local_media_path(targetImageUrl)
        new_colorized_url = colorize_image_with_youcam(local_file_path, memory_id)

        return {
            "status": "success",
            "oldUrl": targetImageUrl,
            "newUrl": new_colorized_url
        }
    except Exception as e:
        print(f"YouCam 흑백 컬러 복원 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{memory_id}/swap-image")
def swap_memory_image(memory_id: str, payload: SwapImageRequest):
    """AI 개선본/복원본 사진으로 원본 이미지 교체 반영"""
    with get_db_cursor() as cursor:
        cursor.execute("SELECT image_urls_json FROM memories WHERE id = ?", (memory_id,))
        row = cursor.fetchone()
        if row:
            urls = json.loads(row["image_urls_json"])
            urls = [payload.newUrl if u == payload.oldUrl else u for u in urls]
            cursor.execute("UPDATE memories SET image_urls_json = ? WHERE id = ?", (json.dumps(urls, ensure_ascii=False), memory_id))

    album_folder_path = find_album_folder_path(memory_id)
    if album_folder_path:
        meta = read_album_meta(album_folder_path)
        if meta:
            meta["imageUrls"] = [payload.newUrl if u == payload.oldUrl else u for u in meta.get("imageUrls", [])]
            write_album_meta(album_folder_path, meta)

    return {"status": "success"}


@router.post("/{memory_id}/append-image-url")
def append_single_image_url(memory_id: str, payload: AppendImageRequest):
    """기존 원본을 유지하면서 AI 결과 사진을 앨범에 새 사진으로 추가"""
    with get_db_cursor() as cursor:
        cursor.execute("SELECT image_urls_json, file_names_json FROM memories WHERE id = ?", (memory_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Memory not found")

        urls = json.loads(row["image_urls_json"])
        fnames = json.loads(row["file_names_json"])

        urls.append(payload.imageUrl)
        fnames.append(os.path.basename(payload.imageUrl))

        cursor.execute(
            "UPDATE memories SET image_urls_json = ?, file_names_json = ? WHERE id = ?",
            (json.dumps(urls, ensure_ascii=False), json.dumps(fnames, ensure_ascii=False), memory_id)
        )

    album_folder_path = find_album_folder_path(memory_id)
    if album_folder_path:
        meta = read_album_meta(album_folder_path)
        if meta:
            meta["imageUrls"] = urls
            meta["fileNames"] = fnames
            write_album_meta(album_folder_path, meta)

    return {"status": "success", "imageUrls": urls, "fileNames": fnames}


@router.delete("/{memory_id}/image")
def delete_single_album_image(memory_id: str, payload: DeleteImageRequest):
    """앨범 내 특정 사진/동영상을 DB, 메타데이터, 디스크에서 함께 삭제"""
    target_url = payload.targetImageUrl
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM memories WHERE id = ?", (memory_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Memory not found")

        urls = json.loads(row["image_urls_json"])
        fnames = json.loads(row["file_names_json"])

        if len(urls) <= 1:
            raise HTTPException(status_code=400, detail="앨범에는 최소 1장 이상의 사진이 남아있어야 합니다.")
        if target_url not in urls:
            raise HTTPException(status_code=404, detail="삭제할 사진이 앨범에 없습니다.")

        target_idx = urls.index(target_url)
        urls.pop(target_idx)
        if target_idx < len(fnames):
            fnames.pop(target_idx)

        cursor.execute(
            "UPDATE memories SET image_urls_json = ?, file_names_json = ? WHERE id = ?",
            (json.dumps(urls, ensure_ascii=False), json.dumps(fnames, ensure_ascii=False), memory_id)
        )

    cleanup_errors = []
    metadata_synced = True
    album_folder_path = find_album_folder_path(memory_id)
    if album_folder_path:
        meta = read_album_meta(album_folder_path)
        if meta:
            meta["imageUrls"] = urls
            meta["fileNames"] = fnames
            write_album_meta(album_folder_path, meta)

            persisted_meta = read_album_meta(album_folder_path)
            target_path = _normalise_media_url_path(target_url)
            metadata_synced = not any(
                _normalise_media_url_path(url) == target_path
                for url in _parse_url_list(persisted_meta.get("imageUrls"))
            )
            if not metadata_synced:
                cleanup_errors.append("album_meta.json 갱신에 실패했습니다.")

    deleted_files, file_errors = _delete_album_media_files(
        memory_id,
        target_url,
        urls,
        album_folder_path,
        metadata_synced,
    )
    cleanup_errors.extend(file_errors)

    return {
        "status": "partial" if cleanup_errors else "success",
        "imageUrls": urls,
        "fileNames": fnames,
        "deletedFiles": deleted_files,
        "cleanupErrors": cleanup_errors,
    }


@router.delete("/{memory_id}/history/{version}")
def delete_history_version(memory_id: str, version: int):
    """특정 분석 버전 히스토리 삭제 및 버전 번호 순차 자동 재정렬"""
    old_history = []
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM memories WHERE id = ?", (memory_id,))
        row = cursor.fetchone()
        if row and "history_json" in row.keys() and row["history_json"]:
            try:
                old_history = json.loads(row["history_json"])
            except Exception:
                pass

    album_folder_path = find_album_folder_path(memory_id)
    if not old_history and album_folder_path:
        meta = read_album_meta(album_folder_path)
        old_history = meta.get("history", [])

    filtered = [v for v in old_history if int(v.get("version", 0)) != int(version)]
    new_history = [{**item, "version": idx + 1} for idx, item in enumerate(filtered)]

    if row:
        with get_db_cursor() as cursor:
            cursor.execute("UPDATE memories SET history_json = ? WHERE id = ?", (json.dumps(new_history, ensure_ascii=False), memory_id))

    if album_folder_path:
        meta = read_album_meta(album_folder_path)
        if meta:
            meta["history"] = new_history
            write_album_meta(album_folder_path, meta)

    return {"status": "success", "history": new_history}


@router.delete("/{memory_id}")
def delete_memory(memory_id: str):
    """작업 목록에서 특정 앨범 제외 (DB 레코드만 삭제)"""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
    return {"status": "deleted"}


@router.delete("")
def clear_active_memories():
    """현재 작업 목록 전체 비우기"""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM memories")
    return {"status": "success"}