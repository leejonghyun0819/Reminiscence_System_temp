# backend/utils/media_utils.py
import os
import time
import subprocess
import shutil
import requests
from PIL import Image
import pillow_heif
from fastapi import UploadFile
from config import ENHANCED_DIR, YOUCAM_API_KEY, ALBUMS_DIR

pillow_heif.register_heif_opener()

YCE_BASE_URL = "https://yce-api-01.makeupar.com"


async def save_media_file(
    upload_file: UploadFile,
    save_folder: str,
    index: int,
    relative_url_prefix: str
) -> tuple[str, str]:
    """업로드된 미디어를 최적화 저장 후 (파일명, URL) 반환"""
    orig_name = upload_file.filename or f"media_{index}"
    _, ext = os.path.splitext(orig_name)
    ext_lower = ext.lower()

    video_exts = {".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"}
    if upload_file.content_type.startswith("video/") or ext_lower in video_exts:
        saved_filename = f"video_{index}.mp4"
        temp_input_path = os.path.join(save_folder, f"temp_{index}{ext_lower}")
        final_output_path = os.path.join(save_folder, saved_filename)

        with open(temp_input_path, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)

        try:
            cmd = [
                "ffmpeg", "-y", "-i", temp_input_path,
                "-vcodec", "libx264", "-crf", "24",
                "-preset", "fast", "-acodec", "aac",
                "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                final_output_path
            ]
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            if os.path.exists(temp_input_path):
                os.remove(temp_input_path)
        except Exception:
            if os.path.exists(temp_input_path):
                os.rename(temp_input_path, final_output_path)

        url = f"http://localhost:8000/albums/{relative_url_prefix}/{saved_filename}"
        return saved_filename, url

    saved_filename = f"image_{index}.jpg"
    final_output_path = os.path.join(save_folder, saved_filename)

    try:
        image = Image.open(upload_file.file)
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")

        max_dim = 1600
        if max(image.width, image.height) > max_dim:
            image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

        image.save(final_output_path, "JPEG", quality=85, optimize=True)
    except Exception:
        upload_file.file.seek(0)
        with open(final_output_path, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)

    url = f"http://localhost:8000/albums/{relative_url_prefix}/{saved_filename}"
    return saved_filename, url


def _upload_to_youcam(input_image_path: str, auth_headers: dict) -> str:
    """YouCam S3 업로드 공통 내부 헬퍼"""
    file_api_url = f"{YCE_BASE_URL}/s2s/v2.0/file"
    file_name = os.path.basename(input_image_path)
    file_size = os.path.getsize(input_image_path)

    file_api_payload = {
        "files": [
            {
                "file_name": file_name,
                "content_type": "image/jpeg",
                "file_size": file_size
            }
        ]
    }

    file_res = requests.post(file_api_url, headers=auth_headers, json=file_api_payload, timeout=20)
    if not file_res.ok:
        raise Exception(f"YouCam File API 오류: {file_res.text}")

    file_data = file_res.json()
    files_arr = file_data.get("data", {}).get("files", []) or file_data.get("files", [])
    if not files_arr:
        raise Exception("YouCam file_id 파싱 실패")

    first_file = files_arr[0]
    file_id = first_file.get("file_id")
    upload_url = first_file.get("requests", [{}])[0].get("url")
    req_headers = first_file.get("requests", [{}])[0].get("headers", {"Content-Type": "image/jpeg"})

    with open(input_image_path, "rb") as f:
        img_bytes = f.read()

    put_res = requests.put(upload_url, data=img_bytes, headers=req_headers, timeout=40)
    if not put_res.ok:
        raise Exception("YouCam S3 업로드 실패")

    return file_id


def _extract_result_url(data_obj: dict) -> str | None:
    """YouCam 응답의 다변화된 results / output 구조에서 최종 URL 추출"""
    results = data_obj.get("results") or data_obj.get("result") or data_obj.get("files") or {}

    # 1. results가 딕셔너리 형태일 때 (예: {"output": [{"url": "..."}], "url": "..."})
    if isinstance(results, dict):
        if "output" in results:
            outputs = results["output"]
            if isinstance(outputs, list) and len(outputs) > 0:
                first = outputs[0]
                if isinstance(first, dict):
                    return first.get("url") or first.get("download_url") or first.get("result_url")
                return str(first)
            elif isinstance(outputs, dict):
                return outputs.get("url") or outputs.get("download_url")
        return (
            results.get("url")
            or results.get("download_url")
            or results.get("result_url")
            or results.get("file_url")
        )

    # 2. results가 리스트 형태일 때
    if isinstance(results, list) and len(results) > 0:
        first = results[0]
        if isinstance(first, dict):
            return first.get("url") or first.get("download_url") or first.get("result_url")
        return str(first)

    # 3. data_obj 직속 필드 확인
    return data_obj.get("result_url") or data_obj.get("url") or data_obj.get("download_url")


def enhance_image_with_youcam(input_image_path: str, album_id: str) -> str:
    """YouCam AI 초고화질 복원 (Super Resolution)"""
    if not os.path.exists(input_image_path):
        raise FileNotFoundError(f"원본 이미지를 찾을 수 없습니다: {input_image_path}")

    if not YOUCAM_API_KEY:
        raise ValueError("YOUCAM_API_KEY가 설정되지 않았습니다.")

    auth_headers = {
        "Authorization": f"Bearer {YOUCAM_API_KEY.strip()}",
        "Content-Type": "application/json"
    }

    file_id = _upload_to_youcam(input_image_path, auth_headers)

    task_endpoint = f"{YCE_BASE_URL}/s2s/v2.0/task/enhance"
    task_res = requests.post(task_endpoint, headers=auth_headers, json={"src_file_id": file_id, "scale": 2}, timeout=20)
    if not task_res.ok:
        raise Exception(f"YouCam Task 생성 오류: {task_res.text}")

    task_id = task_res.json().get("data", {}).get("task_id") or task_res.json().get("task_id")

    poll_endpoint = f"{task_endpoint}/{task_id}"
    final_result_url = None
    for _ in range(35):
        time.sleep(1.0)
        poll_res = requests.get(poll_endpoint, headers=auth_headers, timeout=15)
        if not poll_res.ok:
            continue
        poll_json = poll_res.json()
        data_obj = poll_json.get("data", {}) if isinstance(poll_json.get("data"), dict) else poll_json
        status = str(data_obj.get("task_status") or poll_json.get("task_status") or "").lower()
        
        if status in ("success", "completed", "done"):
            final_result_url = _extract_result_url(data_obj)
            break
        elif status in ("error", "failed"):
            raise Exception("YouCam AI 화질 개선 처리 실패")

    if not final_result_url:
        raise Exception("YouCam 화질 개선 결과 URL 획득 실패")

    enhanced_dl_res = requests.get(final_result_url, timeout=30)
    if not enhanced_dl_res.ok:
        raise Exception("YouCam 결과 다운로드 실패")

    timestamp = int(time.time() * 1000)
    enhanced_filename = f"{album_id}_enhanced_{timestamp}.jpg"

    enhanced_save_path = os.path.join(ENHANCED_DIR, enhanced_filename)
    with open(enhanced_save_path, "wb") as out_file:
        out_file.write(enhanced_dl_res.content)

    album_dir = os.path.dirname(input_image_path)
    if os.path.exists(album_dir) and os.path.isdir(album_dir):
        album_target_path = os.path.join(album_dir, enhanced_filename)
        with open(album_target_path, "wb") as out_file:
            out_file.write(enhanced_dl_res.content)

    return f"http://localhost:8000/enhanced/{enhanced_filename}"


def colorize_image_with_youcam(input_image_path: str, album_id: str) -> str:
    """🎨 YouCam AI 흑백 사진 컬러 복원 (Colorize)"""
    if not os.path.exists(input_image_path):
        raise FileNotFoundError(f"원본 이미지를 찾을 수 없습니다: {input_image_path}")

    if not YOUCAM_API_KEY:
        raise ValueError("YOUCAM_API_KEY가 설정되지 않았습니다.")

    auth_headers = {
        "Authorization": f"Bearer {YOUCAM_API_KEY.strip()}",
        "Content-Type": "application/json"
    }

    file_id = _upload_to_youcam(input_image_path, auth_headers)

    task_endpoint = f"{YCE_BASE_URL}/s2s/v2.0/task/colorize"
    task_res = requests.post(task_endpoint, headers=auth_headers, json={"src_file_id": file_id}, timeout=20)
    
    if task_res.status_code == 404:
        task_endpoint = f"{YCE_BASE_URL}/s2s/v2.0/task/colorization"
        task_res = requests.post(task_endpoint, headers=auth_headers, json={"src_file_id": file_id}, timeout=20)

    if not task_res.ok:
        raise Exception(f"YouCam Colorize Task 생성 오류: {task_res.text}")

    task_json = task_res.json()
    task_id = (
        task_json.get("data", {}).get("task_id")
        or task_json.get("task_id")
        or task_json.get("data", {}).get("id")
    )

    poll_endpoint = f"{task_endpoint}/{task_id}"
    final_result_url = None

    for _ in range(45):
        time.sleep(1.0)
        poll_res = requests.get(poll_endpoint, headers=auth_headers, timeout=15)
        if not poll_res.ok:
            continue
        
        poll_json = poll_res.json()
        data_obj = poll_json.get("data", {}) if isinstance(poll_json.get("data"), dict) else poll_json
        status = str(data_obj.get("task_status") or poll_json.get("task_status") or "").lower()

        if status in ("success", "completed", "done"):
            # 🌟 results.output[0].url 구조 완벽 추출
            final_result_url = _extract_result_url(data_obj)
            print(f"[*] YouCam 컬러 복원 URL 파싱 성공: {final_result_url}")
            break
        elif status in ("error", "failed"):
            raise Exception("YouCam 흑백 컬러 복원 처리 실패")

    if not final_result_url:
        raise Exception("YouCam 컬러 복원 결과 URL 획득 실패")

    colorized_dl_res = requests.get(final_result_url, timeout=30)
    if not colorized_dl_res.ok:
        raise Exception("YouCam 컬러 복원 이미지 다운로드 실패")

    timestamp = int(time.time() * 1000)
    colorized_filename = f"{album_id}_colorized_{timestamp}.jpg"

    colorized_save_path = os.path.join(ENHANCED_DIR, colorized_filename)
    with open(colorized_save_path, "wb") as out_file:
        out_file.write(colorized_dl_res.content)

    album_dir = os.path.dirname(input_image_path)
    if os.path.exists(album_dir) and os.path.isdir(album_dir):
        album_target_path = os.path.join(album_dir, colorized_filename)
        with open(album_target_path, "wb") as out_file:
            out_file.write(colorized_dl_res.content)

    return f"http://localhost:8000/enhanced/{colorized_filename}"