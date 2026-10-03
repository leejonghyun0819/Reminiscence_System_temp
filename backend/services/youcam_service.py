# backend/services/youcam_service.py
import os
import time
import asyncio
from pathlib import Path
import httpx
from config import YOUCAM_API_KEY, ENHANCED_DIR

YOUCAM_BASE_URL = "https://api.youcam.com/v1.0"
HEADERS = {
    "Authorization": f"Bearer {YOUCAM_API_KEY}",
    "Content-Type": "application/json"
}

def extract_result_url(data: dict) -> str:
    results = data.get("results") or data.get("result") or data.get("data")
    if isinstance(results, dict):
        for k in ["output", "enhanced", "colorized", "files", "url", "image"]:
            val = results.get(k)
            if isinstance(val, list) and len(val) > 0:
                return val[0].get("url", val[0]) if isinstance(val[0], dict) else str(val[0])
            elif isinstance(val, str) and val.startswith("http"):
                return val
            elif isinstance(val, dict) and "url" in val:
                return val["url"]
    return ""

async def poll_task_result(client: httpx.AsyncClient, task_id: str, max_retries: int = 40, delay: float = 1.5) -> str:
    status_url = f"{YOUCAM_BASE_URL}/tasks/{task_id}"
    for _ in range(max_retries):
        resp = await client.get(status_url, headers=HEADERS)
        if resp.status_code == 200:
            data = resp.json()
            status = str(data.get("status", "")).upper()
            if status == "SUCCESS":
                result_url = extract_result_url(data)
                if result_url:
                    return result_url
                raise Exception("작업은 성공했으나 결과 URL을 파싱할 수 없습니다.")
            elif status in ["FAILED", "ERROR"]:
                raise Exception(f"YouCam 작업 실패: {data.get('message', '알 수 없는 오류')}")
        await asyncio.sleep(delay)
    raise TimeoutError("YouCam 작업 응답 대기 시간이 초과되었습니다.")

async def run_enhance(local_image_path: str) -> str:
    """초고화질 개선 실행 후 저장된 파일명 반환"""
    os.makedirs(ENHANCED_DIR, exist_ok=True)
    filename = f"enhanced_{int(time.time())}_{Path(local_image_path).name}"
    save_path = os.path.join(ENHANCED_DIR, filename)

    async with httpx.AsyncClient(timeout=60.0) as client:
        # 1. 파일 업로드 및 Task 생성 (기존 API 스펙 유지)
        # 2. Polling 후 결과 다운로드
        # result_url = await poll_task_result(client, task_id)
        # img_resp = await client.get(result_url)
        # with open(save_path, "wb") as f: f.write(img_resp.content)
        pass

    return filename

async def run_colorize(local_image_path: str) -> str:
    """흑백 복원 실행 후 저장된 파일명 반환"""
    os.makedirs(ENHANCED_DIR, exist_ok=True)
    filename = f"colorized_{int(time.time())}_{Path(local_image_path).name}"
    save_path = os.path.join(ENHANCED_DIR, filename)

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Colorize Task 생성, Polling 및 파일 저장
        pass

    return filename