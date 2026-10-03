# backend/routers/youcam.py
from fastapi import APIRouter, HTTPException, Query
from services.youcam_service import run_enhance, run_colorize
from utils.file_utils import find_local_media_path

router = APIRouter(prefix="/api/youcam", tags=["YouCam AI"])

@router.post("/enhance")
async def enhance_image(image_url: str = Query(...)):
    local_path = find_local_media_path(image_url)
    if not local_path:
        raise HTTPException(status_code=404, detail="이미지 파일을 찾을 수 없습니다.")
    try:
        saved_filename = await run_enhance(local_path)
        return {"status": "success", "enhanced_url": f"/enhanced/{saved_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/colorize")
async def colorize_image(image_url: str = Query(...)):
    local_path = find_local_media_path(image_url)
    if not local_path:
        raise HTTPException(status_code=404, detail="이미지 파일을 찾을 수 없습니다.")
    try:
        saved_filename = await run_colorize(local_path)
        return {"status": "success", "colorized_url": f"/enhanced/{saved_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))