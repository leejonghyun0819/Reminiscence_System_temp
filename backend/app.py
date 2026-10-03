# backend/app.py
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers import gemini, youcam, memories, folders, backup

from config import ALBUMS_DIR, ENHANCED_DIR
from database import init_db

# -------------------------------------------------------------
# 라우터 모듈 Import (실제 존재하는 파일명 기준)
# -------------------------------------------------------------
# 1. AI 라우터
try:
    from routers.gemini import router as ai_router
except ImportError:
    ai_router = None

# 2. Memories 라우터
try:
    from routers.memories import router as memories_router
except ImportError:
    memories_router = None

# 3. Folders 라우터
try:
    from routers.folders import router as folders_router
except ImportError:
    folders_router = None

# 4. Backup 라우터
try:
    from routers.backup import router as backup_router
except ImportError:
    backup_router = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    os.makedirs(ALBUMS_DIR, exist_ok=True)
    os.makedirs(ENHANCED_DIR, exist_ok=True)
    print("🚀 Reminiscence Note 백엔드 서버가 시작되었습니다.")
    yield
    print("🛑 Reminiscence Note 백엔드 서버가 종료되었습니다.")


app = FastAPI(
    title="Reminiscence Note API",
    description="AI 기반 멀티모달 추억 기록 및 YouCam 화질 개선 서비스 API",
    version="2.0.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(gemini.router)
app.include_router(youcam.router)
app.include_router(memories.router)
app.include_router(folders.router)
app.include_router(backup.router)



# -------------------------------------------------------------
# 정적 파일 서빙 및 스마트 Fallback 라우터
# -------------------------------------------------------------
app.mount("/enhanced", StaticFiles(directory=ENHANCED_DIR), name="enhanced")


@app.get("/albums/{rest_of_path:path}")
async def serve_album_media(rest_of_path: str):
    file_name = os.path.basename(rest_of_path)

    # 1. 앨범 실제 폴더 경로에서 우선 탐색
    direct_path = os.path.join(ALBUMS_DIR, rest_of_path)
    if os.path.exists(direct_path) and os.path.isfile(direct_path):
        return FileResponse(direct_path)

    # 2. YouCam 개선본 파일인 경우 ENHANCED_DIR 탐색
    if "_enhanced_" in file_name:
        enhanced_path = os.path.join(ENHANCED_DIR, file_name)
        if os.path.exists(enhanced_path) and os.path.isfile(enhanced_path):
            return FileResponse(enhanced_path)

    # 3. albums 전체 서브디렉터리 재귀 탐색
    for root, _, files in os.walk(ALBUMS_DIR):
        if file_name in files:
            found_path = os.path.join(root, file_name)
            return FileResponse(found_path)

    raise HTTPException(status_code=404, detail=f"미디어 파일을 찾을 수 없습니다: {rest_of_path}")


@app.get("/")
def root_check():
    return {
        "status": "online",
        "message": "Reminiscence Note API Server is running."
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)