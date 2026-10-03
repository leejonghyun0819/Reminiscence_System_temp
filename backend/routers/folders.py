# backend/routers/folders.py
import os
import shutil
import json
from typing import List, Optional, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config import ALBUMS_DIR
from database import get_db_cursor

router = APIRouter(prefix="/api/folders", tags=["Folders"])

ROOT_CATEGORIES = ["유년시절", "여행"]

class CreateFolderRequest(BaseModel):
    name: str
    rootCategory: Optional[str] = "여행"  # "유년시절" | "여행"

class RenameFolderRequest(BaseModel):
    newName: str
    rootCategory: Optional[str] = None

def ensure_root_dirs():
    if os.path.exists(ALBUMS_DIR):
        for cat in ROOT_CATEGORIES:
            os.makedirs(os.path.join(ALBUMS_DIR, cat), exist_ok=True)

ensure_root_dirs()

# 🌟 1. 폴더 목록 조회: 대분류 맵핑과 기존 List[str] 하위 호환을 둘 다 지원
@router.get("")
def get_folders():
    """대분류별 하위 폴더 맵 및 전체 통합 리스트 반환"""
    categorized: Dict[str, List[str]] = {"유년시절": [], "여행": [], "기타": []}
    all_folders = set()

    if os.path.exists(ALBUMS_DIR):
        for cat in ROOT_CATEGORIES:
            cat_path = os.path.join(ALBUMS_DIR, cat)
            if os.path.exists(cat_path):
                subs = [
                    d for d in os.listdir(cat_path)
                    if os.path.isdir(os.path.join(cat_path, d)) and not d.startswith(".")
                ]
                categorized[cat] = sorted(subs)
                all_folders.update(subs)

        # 기존 최상위 레거시 폴더 호환
        for item in os.listdir(ALBUMS_DIR):
            f_path = os.path.join(ALBUMS_DIR, item)
            if (
                os.path.isdir(f_path)
                and not item.startswith(".")
                and item != "enhanced"
                and item not in ROOT_CATEGORIES
            ):
                categorized["기타"].append(item)
                all_folders.update([item])

    # index/context 기존 호환용 flat 리스트와 대분류 맵을 함께 반환
    return {
        "all": sorted(list(all_folders)),
        "categorized": categorized
    }

# 🌟 2. 새 폴더 생성: 지정한 대분류 내부에 생성
@router.post("")
def create_folder(payload: CreateFolderRequest):
    folder_name = payload.name.strip()
    if not folder_name:
        raise HTTPException(status_code=400, detail="폴더명을 입력해주세요.")

    root_cat = payload.rootCategory if payload.rootCategory in ROOT_CATEGORIES else "여행"
    target_path = os.path.join(ALBUMS_DIR, root_cat, folder_name)

    # 기존 최상위 폴더 및 해당 대분류 내 중복 체크
    if os.path.exists(target_path) or os.path.exists(os.path.join(ALBUMS_DIR, folder_name)):
        raise HTTPException(status_code=400, detail="이미 존재하는 폴더입니다.")

    try:
        os.makedirs(target_path, exist_ok=True)
        return {"status": "success", "folderName": folder_name, "rootCategory": root_cat}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"폴더 생성 실패: {str(e)}")

# 🌟 3. 폴더 이름 변경: 대분류 내부 폴더 및 레거시 폴더 모두 탐색하여 변경
@router.put("/{folder_name}/rename")
def rename_folder(folder_name: str, payload: RenameFolderRequest):
    old_name = folder_name.strip()
    new_name = payload.newName.strip()

    if not old_name or not new_name:
        raise HTTPException(status_code=400, detail="유효한 폴더명을 입력해주세요.")

    if old_name == new_name:
        return {"status": "success", "folderName": new_name}

    # 폴더 실제 위치 탐색
    found_parent = None
    if payload.rootCategory and os.path.exists(os.path.join(ALBUMS_DIR, payload.rootCategory, old_name)):
        found_parent = os.path.join(ALBUMS_DIR, payload.rootCategory)
    else:
        for cat in ROOT_CATEGORIES:
            if os.path.exists(os.path.join(ALBUMS_DIR, cat, old_name)):
                found_parent = os.path.join(ALBUMS_DIR, cat)
                break
        if not found_parent and os.path.exists(os.path.join(ALBUMS_DIR, old_name)):
            found_parent = ALBUMS_DIR

    if not found_parent:
        raise HTTPException(status_code=404, detail=f"'{old_name}' 폴더를 찾을 수 없습니다.")

    old_folder_path = os.path.join(found_parent, old_name)
    new_folder_path = os.path.join(found_parent, new_name)

    if os.path.exists(new_folder_path):
        raise HTTPException(status_code=400, detail=f"이미 존재하는 폴더명입니다: '{new_name}'")

    try:
        os.rename(old_folder_path, new_folder_path)

        for root, _, files in os.walk(new_folder_path):
            if "album_meta.json" in files:
                meta_path = os.path.join(root, "album_meta.json")
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                    meta["categoryFolder"] = new_name
                    with open(meta_path, "w", encoding="utf-8") as f:
                        json.dump(meta, f, ensure_ascii=False, indent=2)
                except Exception as meta_err:
                    print(f"[Warning] meta 갱신 실패: {meta_err}")

        try:
            with get_db_cursor() as cursor:
                cursor.execute(
                    "UPDATE memories SET category_folder = ? WHERE category_folder = ?",
                    (new_name, old_name)
                )
        except Exception as db_err:
            print(f"[Warning] DB 갱신 실패: {db_err}")

        return {"status": "success", "oldName": old_name, "newName": new_name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"폴더 이름 변경 실패: {str(e)}")

# 🌟 4. 폴더 삭제
@router.delete("/{folder_name}")
def delete_folder(folder_name: str):
    target_path = None
    parent_dir = None

    for cat in ROOT_CATEGORIES:
        cand = os.path.join(ALBUMS_DIR, cat, folder_name)
        if os.path.exists(cand):
            target_path = cand
            parent_dir = os.path.join(ALBUMS_DIR, cat)
            break

    if not target_path and os.path.exists(os.path.join(ALBUMS_DIR, folder_name)):
        target_path = os.path.join(ALBUMS_DIR, folder_name)
        parent_dir = ALBUMS_DIR

    if not target_path or not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="삭제할 폴더가 없습니다.")

    try:
        # 하위 앨범들은 해당 대분류 루트 또는 미분류로 대피 후 폴더 삭제
        for item in os.listdir(target_path):
            src = os.path.join(target_path, item)
            dst = os.path.join(parent_dir, item)
            if not os.path.exists(dst):
                shutil.move(src, dst)

        shutil.rmtree(target_path)

        try:
            with get_db_cursor() as cursor:
                cursor.execute(
                    "UPDATE memories SET category_folder = '미분류' WHERE category_folder = ?",
                    (folder_name,)
                )
        except Exception:
            pass

        return {"status": "success", "deletedFolder": folder_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"폴더 삭제 실패: {str(e)}")