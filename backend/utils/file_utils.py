# backend/utils/file_utils.py
import os
import json
import sqlite3
import shutil
import re
import time
from typing import Optional, Dict, Any, List
from pathlib import Path
from config import ALBUMS_DIR, ENHANCED_DIR
from database import get_db_cursor


def find_local_media_path(target_filename: str) -> Optional[str]:
    """파일명 또는 URL에서 파일명을 추출하여 enhanced 및 albums 디렉토리에서 실제 로컬 경로 탐색"""
    if not target_filename:
        return None

    # URL 쿼리스트링 및 경로 정리 후 순수 파일명 추출
    clean_name = os.path.basename(target_filename.split("?")[0])
    search_dirs = [ENHANCED_DIR, ALBUMS_DIR]

    for directory in search_dirs:
        if not os.path.exists(directory):
            continue
        for root, _, files in os.walk(directory):
            if clean_name in files:
                return os.path.join(root, clean_name)
    return None


def row_to_memory_dict(row: sqlite3.Row) -> Dict[str, Any]:
    """SQLite Row 객체를 프론트엔드용 MemoryItem 딕셔너리로 변환"""
    history_list = []
    if "history_json" in row.keys() and row["history_json"]:
        try:
            history_list = json.loads(row["history_json"])
        except Exception:
            history_list = []

    file_names = []
    if "file_names_json" in row.keys() and row["file_names_json"]:
        try:
            file_names = json.loads(row["file_names_json"])
        except Exception:
            file_names = []

    image_urls = []
    if "image_urls_json" in row.keys() and row["image_urls_json"]:
        try:
            image_urls = json.loads(row["image_urls_json"])
        except Exception:
            image_urls = []

    # SQLite에 없는 분류/큐레이션 정보는 앨범 메타데이터에서 복원한다.
    meta: Dict[str, Any] = {}
    album_folder = find_album_folder_path(str(row["id"]))
    if album_folder:
        meta = read_album_meta(album_folder)

    mode = meta.get("mode")
    root_category = meta.get("rootCategory")
    if mode not in ("travel", "childhood"):
        if root_category == "유년시절":
            mode = "childhood"
        elif root_category == "여행":
            mode = "travel"
        else:
            mode = None

    if root_category not in ("유년시절", "여행"):
        root_category = (
            "유년시절"
            if mode == "childhood"
            else "여행"
            if mode == "travel"
            else None
        )

    return {
        "id": row["id"],
        "mode": mode,
        "rootCategory": root_category,
        "fileNames": file_names,
        "imageUrls": image_urls,
        "audioFileName": row["audio_file_name"] if "audio_file_name" in row.keys() else None,
        "audioUrl": row["audio_url"] if "audio_url" in row.keys() else None,
        "categoryFolder": (row["category_folder"] if "category_folder" in row.keys() else None) or "미분류",
        "history": history_list,
        "curatedNote": meta.get("curatedNote"),
        "interviewData": meta.get("interviewData"),
        "analysis": {
            "title": row["title"] if "title" in row.keys() else "",
            "location": row["location"] if "location" in row.keys() else "",
            "yearEstimate": row["year_estimate"] if "year_estimate" in row.keys() else "",
            "description": row["description"] if "description" in row.keys() else "",
            "storyCaption": row["story_caption"] if "story_caption" in row.keys() else "",
            "audioTranscriptSummary": row["audio_transcript_summary"] if "audio_transcript_summary" in row.keys() else "",
        }
    }


def find_album_folder_path(target_id: str) -> Optional[str]:
    """앨범 ID를 기반으로 albums 폴더 내의 실제 디렉터리 경로 탐색"""
    if not target_id or target_id == "undefined":
        return None

    direct_path = os.path.join(ALBUMS_DIR, target_id)
    if os.path.exists(os.path.join(direct_path, "album_meta.json")):
        return direct_path

    # 복원 작업 ID: restored_<실제 폴더명>_<timestamp>
    # DB의 작업 ID와 변경되지 않은 실제 폴더명을 연결한다.
    for root, _, files in os.walk(ALBUMS_DIR):
        if "album_meta.json" not in files:
            continue

        folder_name = os.path.basename(root)
        if folder_name == target_id:
            return root

        restored_prefix = f"restored_{folder_name}_"
        restored_suffix = target_id[len(restored_prefix):] if target_id.startswith(restored_prefix) else ""
        if restored_suffix.isdigit():
            return root

        try:
            with open(os.path.join(root, "album_meta.json"), "r", encoding="utf-8") as f:
                meta = json.load(f)

            meta_id = str(meta.get("id", ""))
            if meta_id == target_id:
                return root

            meta_prefix = f"restored_{meta_id}_"
            meta_suffix = target_id[len(meta_prefix):] if meta_id and target_id.startswith(meta_prefix) else ""
            if meta_suffix.isdigit():
                return root
        except (OSError, json.JSONDecodeError, TypeError):
            continue

    return None


def read_album_meta(folder_path: str) -> Dict[str, Any]:
    """album_meta.json 파일 읽기"""
    meta_path = os.path.join(folder_path, "album_meta.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def write_album_meta(folder_path: str, meta: Dict[str, Any]):
    """album_meta.json 파일 저장"""
    meta_path = os.path.join(folder_path, "album_meta.json")
    try:
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ 메타 파일 저장 실패 ({folder_path}): {e}")


def internal_move_single_album(album_id: str, target_folder: str) -> bool:
    """앨범 폴더 이동 및 메타/DB 동기화"""
    target_folder = target_folder.strip() or "미분류"
    src_folder_path = find_album_folder_path(album_id)
    if not src_folder_path:
        return False

    folder_name = os.path.basename(src_folder_path)

    if target_folder == "미분류":
        dest_folder_path = os.path.join(ALBUMS_DIR, folder_name)
        new_url_prefix = f"{folder_name}"
    else:
        parent_dir = os.path.join(ALBUMS_DIR, target_folder)
        os.makedirs(parent_dir, exist_ok=True)
        dest_folder_path = os.path.join(parent_dir, folder_name)
        new_url_prefix = f"{target_folder}/{folder_name}"

    if os.path.abspath(src_folder_path) != os.path.abspath(dest_folder_path):
        shutil.move(src_folder_path, dest_folder_path)

    meta = read_album_meta(dest_folder_path)
    if meta:
        meta["categoryFolder"] = target_folder
        meta["imageUrls"] = [
            f"http://localhost:8000/albums/{new_url_prefix}/{os.path.basename(u.split('?')[0])}"
            for u in meta.get("imageUrls", [])
        ]
        if meta.get("audioUrl"):
            meta["audioUrl"] = f"http://localhost:8000/albums/{new_url_prefix}/{os.path.basename(meta['audioUrl'])}"

        write_album_meta(dest_folder_path, meta)

    with get_db_cursor() as cursor:
        cursor.execute("UPDATE memories SET category_folder = ? WHERE id = ?", (target_folder, album_id))

    return True


def restore_memory_from_meta(folder_path: str, cursor: sqlite3.Cursor) -> Optional[Dict[str, Any]]:
    """백업 메타 파일로부터 DB 레코드 복원"""
    meta = read_album_meta(folder_path)
    if not meta:
        return None

    folder_name = os.path.basename(folder_path)
    new_id = f"restored_{folder_name}_{int(time.time() * 1000)}"
    analysis = meta.get("analysis", {})
    file_names = meta.get("fileNames", [])
    image_urls = meta.get("imageUrls", [])
    audio_file_name = meta.get("audioFileName")
    audio_url = meta.get("audioUrl")
    category_folder = meta.get("categoryFolder", "미분류")
    history = meta.get("history", [])
    mode = meta.get("mode")
    root_category = meta.get("rootCategory")

    if mode not in ("travel", "childhood"):
        if root_category == "유년시절":
            mode = "childhood"
        elif root_category == "여행":
            mode = "travel"
        else:
            mode = None

    if root_category not in ("유년시절", "여행"):
        if mode == "childhood":
            root_category = "유년시절"
        elif mode == "travel":
            root_category = "여행"
        else:
            root_category = None

    cursor.execute("""
        INSERT INTO memories (
            id, file_names_json, image_urls_json, audio_file_name, audio_url,
            title, location, year_estimate, description, story_caption, audio_transcript_summary, category_folder, history_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        new_id,
        json.dumps(file_names, ensure_ascii=False),
        json.dumps(image_urls, ensure_ascii=False),
        audio_file_name,
        audio_url,
        analysis.get("title", ""),
        analysis.get("location", ""),
        analysis.get("yearEstimate", ""),
        analysis.get("description", ""),
        analysis.get("storyCaption", ""),
        analysis.get("audioTranscriptSummary", ""),
        category_folder,
        json.dumps(history, ensure_ascii=False)
    ))

    return {
        "id": new_id,
        "mode": mode,
        "rootCategory": root_category,
        "fileNames": file_names,
        "imageUrls": image_urls,
        "audioFileName": audio_file_name,
        "audioUrl": audio_url,
        "categoryFolder": category_folder,
        "history": history,
        "analysis": analysis,
        "curatedNote": meta.get("curatedNote"),
        "interviewData": meta.get("interviewData"),
    }