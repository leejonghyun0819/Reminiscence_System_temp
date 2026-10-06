# backend/routers/gemini.py

import os
import glob
import base64
import json
from typing import List, Optional
from urllib.parse import unquote

from fastapi import (
    APIRouter,
    HTTPException,
)

from pydantic import (
    BaseModel,
    Field,
)

from config import ALBUMS_DIR

from services.gemini_service import (
    analyze_multimodal_memory,
    generate_memory_interview,
    generate_memory_interview_batch,
    build_curated_memory_note,
    generate_memory_book_note,
    detect_memory_mode_batch,
)

from utils.file_utils import (
    find_album_folder_path,
)


router = APIRouter(
    prefix="/api/gemini",
    tags=["gemini"]
)


# ============================================================
# Request Models
# ============================================================

class ImageItem(BaseModel):
    base64: str
    mimeType: str = (
        "image/jpeg"
    )


class AnalyzeRequest(BaseModel):

    images: List[ImageItem] = Field(
        default_factory=list
    )

    audio_base64: Optional[str] = None

    audio_mime: Optional[str] = None


class MemoryContextPayload(BaseModel):

    memoryOwner: Optional[str] = Field(
        default=None,
        max_length=40
    )

    purpose: Optional[str] = Field(
        default=None,
        max_length=40
    )

    approximateTime: Optional[str] = Field(
        default=None,
        max_length=120
    )

    placeHint: Optional[str] = Field(
        default=None,
        max_length=160
    )

    peopleHint: Optional[str] = Field(
        default=None,
        max_length=240
    )

    additionalContext: Optional[str] = Field(
        default=None,
        max_length=1200
    )


class InterviewRequest(BaseModel):

    images: List[ImageItem] = Field(
        default_factory=list
    )

    photoAnalyses: List[dict] = Field(
        default_factory=list
    )

    detectedMode: Optional[str] = (
        "childhood"
    )

    memoryContext: Optional[
        MemoryContextPayload
    ] = None


class AlbumInterviewRequest(BaseModel):

    memoryId: Optional[str] = None

    albumId: Optional[str] = None

    imageUrls: Optional[
        List[str]
    ] = None

    memoryContext: Optional[
        MemoryContextPayload
    ] = None


class QAPairItem(BaseModel):

    id: str

    category: Optional[str] = (
        "기억의 열쇠"
    )

    targetClue: Optional[str] = ""

    targetPhotoIndexes: List[int] = Field(
        default_factory=list
    )

    targetImageUrls: List[str] = Field(
        default_factory=list
    )

    question: str

    answer: str


class FactsAndCluesPayload(BaseModel):

    estimatedEra: Optional[str] = (
        "시기 미상"
    )

    sceneFacts: Optional[str] = ""

    visualClues: List[str] = Field(
        default_factory=list
    )

    memoryContext: Optional[
        MemoryContextPayload
    ] = None


class CurateRequest(BaseModel):

    factsAndClues: FactsAndCluesPayload

    qaPairs: List[QAPairItem] = Field(
        default_factory=list
    )


class NoteSourceItem(BaseModel):

    id: str = Field(
        min_length=1,
        max_length=160,
    )

    mode: Optional[str] = None
    title: Optional[str] = Field(default="", max_length=240)
    location: Optional[str] = Field(default="", max_length=320)
    yearEstimate: Optional[str] = Field(default="", max_length=240)
    categoryFolder: Optional[str] = Field(default="", max_length=160)
    sceneDescription: Optional[str] = Field(default="", max_length=4000)
    remembered: Optional[str] = Field(default="", max_length=6000)
    unremembered: Optional[str] = Field(default="", max_length=3000)
    reflection: Optional[str] = Field(default="", max_length=4000)

    interviewAnswers: List[str] = Field(
        default_factory=list,
        max_length=30,
    )


class GenerateNoteRequest(BaseModel):

    memories: List[NoteSourceItem] = Field(
        min_length=1,
        max_length=6,
    )

    style: Optional[str] = "warm"


# ============================================================
# Helpers
# ============================================================

def _image_items_to_payload(
    images: List[ImageItem]
) -> list[dict]:

    return [
        {
            "base64": image.base64,
            "mimeType": (
                image.mimeType
                or "image/jpeg"
            )
        }
        for image in images
    ]


def _find_album_folder(
    target_id: str
) -> Optional[str]:

    # 먼저 공통 helper 사용
    folder = find_album_folder_path(
        target_id
    )

    if (
        folder
        and os.path.exists(folder)
    ):
        return folder

    # fallback:
    # album_meta.json의 id까지 탐색
    if not os.path.exists(
        ALBUMS_DIR
    ):
        return None

    for root, _, files in os.walk(
        ALBUMS_DIR
    ):

        if (
            os.path.basename(root)
            == target_id
        ):
            return root

        if (
            "album_meta.json"
            not in files
        ):
            continue

        meta_path = os.path.join(
            root,
            "album_meta.json"
        )

        try:

            with open(
                meta_path,
                "r",
                encoding="utf-8"
            ) as file:

                meta = json.load(
                    file
                )

            meta_id = str(
                meta.get(
                    "id",
                    ""
                )
            )

            if (
                meta_id
                == target_id
            ):
                return root

        except Exception:
            continue

    return None


def _collect_album_images(
    album_folder: str,
    preferred_urls: Optional[List[str]] = None,
) -> list[str]:

    image_files = []

    extensions = (
        "*.jpg",
        "*.jpeg",
        "*.png",
        "*.webp",
        "*.JPG",
        "*.JPEG",
        "*.PNG",
        "*.WEBP",
    )

    for extension in extensions:

        image_files.extend(
            glob.glob(
                os.path.join(
                    album_folder,
                    extension
                )
            )
        )

    image_files = list(
        dict.fromkeys(
            image_files
        )
    )

    # 프런트에서 보고 있는 imageUrls 순서를 우선한다.
    # Gemini의 사진 번호와 UI의 사진 번호가 반드시 같아야 한다.
    if preferred_urls:

        by_file_name = {
            os.path.basename(path): path
            for path in image_files
        }

        ordered_files = []

        for url in preferred_urls:

            decoded_url = unquote(
                url
            ).split("?")[0]

            file_name = os.path.basename(
                decoded_url
            )

            matched_path = by_file_name.get(
                file_name
            )

            if matched_path:
                ordered_files.append(
                    matched_path
                )

        if ordered_files:
            ordered_files = list(
                dict.fromkeys(
                    ordered_files
                )
            )

            ordered_set = set(
                ordered_files
            )

            unmatched_files = [
                path
                for path in sorted(
                    image_files
                )
                if path not in ordered_set
            ]

            return (
                ordered_files
                + unmatched_files
            )

    return sorted(
        image_files
    )


def _read_album_memory_context(
    album_folder: Optional[str]
) -> dict:

    if not album_folder:
        return {}

    meta_path = os.path.join(
        album_folder,
        "album_meta.json"
    )

    if not os.path.isfile(
        meta_path
    ):
        return {}

    try:

        with open(
            meta_path,
            "r",
            encoding="utf-8"
        ) as file:
            meta = json.load(
                file
            )

        interview_data = meta.get(
            "interviewData",
            {}
        )

        if not isinstance(
            interview_data,
            dict
        ):
            return {}

        memory_context = interview_data.get(
            "memoryContext",
            {}
        )

        return (
            memory_context
            if isinstance(
                memory_context,
                dict
            )
            else {}
        )

    except Exception as e:

        print(
            "⚠️ 저장된 기억 맥락 로딩 실패: "
            f"{type(e).__name__}"
        )

        return {}


# ============================================================
# Mode Detection
# ============================================================

@router.post(
    "/detect-mode"
)
async def detect_mode_endpoint(
    req: InterviewRequest
):

    if not req.images:

        return {
            "mode": "travel"
        }

    try:

        images_payload = (
            _image_items_to_payload(
                req.images
            )
        )

        mode, analyses = (
            await detect_memory_mode_batch(
                images_payload
            )
        )

        return {
            "mode": mode,
            "photoAnalyses": analyses,
        }

    except Exception as e:

        print(
            "❌ [/detect-mode] "
            "최종 예외"
        )

        print(
            "   Exception Type: "
            f"{type(e).__name__}"
        )

        print(
            "   Exception repr: "
            f"{repr(e)}"
        )

        # 기존 frontend 호환 유지
        return {
            "mode": "travel"
        }


# ============================================================
# Multimodal Analysis
# ============================================================

@router.post(
    "/analyze"
)
@router.post(
    "/analyze-multimodal"
)
async def analyze_memory_endpoint(
    req: AnalyzeRequest
):

    if not req.images:

        raise HTTPException(
            status_code=400,
            detail=(
                "최소 1장 이상의 이미지가 필요합니다."
            )
        )

    try:

        images_payload = (
            _image_items_to_payload(
                req.images
            )
        )

        analysis_result = (
            await analyze_multimodal_memory(
                images_data=(
                    images_payload
                ),
                audio_base64=(
                    req.audio_base64
                ),
                audio_mime=(
                    req.audio_mime
                ),
            )
        )

        return {
            "success": True,
            "analysis": (
                analysis_result
            ),
        }

    except Exception as e:

        print(
            "❌ [멀티모달 분석 오류]"
        )

        print(
            f"   Type: "
            f"{type(e).__name__}"
        )

        print(
            f"   repr: "
            f"{repr(e)}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "멀티모달 분석 실패: "
                f"{type(e).__name__}"
            )
        )


# ============================================================
# New Interview
# ============================================================

@router.post(
    "/interview"
)
@router.post(
    "/generate-interview"
)
async def generate_interview_endpoint(
    req: InterviewRequest
):

    if not req.images:

        raise HTTPException(
            status_code=400,
            detail=(
                "질문을 도출할 이미지가 필요합니다."
            )
        )

    try:

        images_payload = (
            _image_items_to_payload(
                req.images
            )
        )

        result = (
            await generate_memory_interview(
                images_data=images_payload,
                photo_analyses=req.photoAnalyses,
                memory_mode=(
                    req.detectedMode
                    or "childhood"
                ),
                memory_context=(
                    req.memoryContext.model_dump(
                        exclude_none=True
                    )
                    if req.memoryContext
                    else {}
                ),
            )
        )

        return result

    except Exception as e:

        print(
            "❌ [인터뷰 생성 오류]"
        )

        print(
            f"   Type: "
            f"{type(e).__name__}"
        )

        print(
            f"   repr: "
            f"{repr(e)}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "인터뷰 생성 실패: "
                f"{type(e).__name__}"
            )
        )


# ============================================================
# Existing Album Interview
# ============================================================

@router.post(
    "/interview-from-album"
)
async def generate_interview_from_existing_album(
    req: AlbumInterviewRequest
):

    raw_target_id = (
        req.memoryId
        or req.albumId
        or ""
    )

    if not raw_target_id:

        raise HTTPException(
            status_code=400,
            detail=(
                "memoryId 또는 albumId가 필요합니다."
            )
        )

    print(
        "\n=========================================="
    )

    print(
        "🔍 [기존 앨범 인터뷰 재분석 요청]"
    )

    print(
        f"   Target ID: "
        f"{raw_target_id}"
    )

    try:

        target_album_folder = (
            _find_album_folder(
                raw_target_id
            )
        )

        image_files = []

        memory_context = (
            req.memoryContext.model_dump(
                exclude_none=True
            )
            if req.memoryContext
            else {}
        )

        if target_album_folder:

            print(
                "📂 [앨범 폴더 발견]"
            )

            print(
                f"   {target_album_folder}"
            )

            image_files = (
                _collect_album_images(
                    target_album_folder,
                    req.imageUrls,
                )
            )

            if not memory_context:
                memory_context = (
                    _read_album_memory_context(
                        target_album_folder
                    )
                )

        # ----------------------------------------------------
        # folder를 못 찾은 경우 URL fallback
        # ----------------------------------------------------

        if (
            not image_files
            and req.imageUrls
        ):

            print(
                "🔄 imageUrls 기반 "
                "fallback 탐색"
            )

            for url in req.imageUrls:

                decoded_url = (
                    unquote(
                        url
                    )
                    .split("?")[0]
                )

                if (
                    "/albums/"
                    not in decoded_url
                ):
                    continue

                path_part = (
                    decoded_url
                    .split(
                        "/albums/",
                        1
                    )[1]
                    .lstrip("/")
                )

                exact_path = (
                    os.path.join(
                        ALBUMS_DIR,
                        path_part
                    )
                )

                if (
                    os.path.isfile(
                        exact_path
                    )
                ):
                    image_files.append(
                        exact_path
                    )

        image_files = list(
            dict.fromkeys(
                image_files
            )
        )

        if not image_files:

            raise HTTPException(
                status_code=404,
                detail=(
                    f"앨범({raw_target_id})의 "
                    "사진 파일을 찾을 수 없습니다."
                )
            )

        print(
            "📸 [재분석 대상]"
        )

        print(
            f"   총 {len(image_files)}장"
        )

        images_payload = []

        for image_path in image_files:

            with open(
                image_path,
                "rb"
            ) as file:

                encoded = (
                    base64
                    .b64encode(
                        file.read()
                    )
                    .decode(
                        "utf-8"
                    )
                )

            extension = (
                os.path.splitext(
                    image_path
                )[1]
                .lower()
            )

            mime_type = (
                "image/png"
                if extension == ".png"
                else (
                    "image/webp"
                    if extension == ".webp"
                    else "image/jpeg"
                )
            )

            images_payload.append({
                "base64": encoded,
                "mimeType": mime_type,
            })

        # ----------------------------------------------------
        # 전체 사진 분류
        # ----------------------------------------------------

        detected_mode, photo_analyses = (
            await detect_memory_mode_batch(
                images_data=(
                    images_payload
                )
            )
        )

        # ----------------------------------------------------
        # 분석 결과 + 대표 사진으로 인터뷰 생성
        # ----------------------------------------------------

        interview_result = (
            await generate_memory_interview_batch(
                images_data=(
                    images_payload
                ),
                photo_analyses=(
                    photo_analyses
                ),
                memory_mode=(
                    detected_mode
                ),
                memory_context=(
                    memory_context
                ),
            )
        )

        interview_result[
            "detectedMode"
        ] = detected_mode

        return interview_result

    except HTTPException:
        raise

    except Exception as e:

        print(
            "❌ [interview-from-album 오류]"
        )

        print(
            f"   Type: "
            f"{type(e).__name__}"
        )

        print(
            f"   repr: "
            f"{repr(e)}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "과거 앨범 기반 인터뷰 생성 실패: "
                f"{type(e).__name__}"
            )
        )


# ============================================================
# Curation
# ============================================================

@router.post(
    "/curate"
)
@router.post(
    "/curate-note"
)
async def curate_memory_note_endpoint(
    req: CurateRequest
):

    print(
        "\n======================================================="
    )

    print(
        "📥 [/api/gemini/curate 요청]"
    )

    print(
        "📌 추정 연대: "
        f"{req.factsAndClues.estimatedEra}"
    )

    print(
        "📌 시각적 사실: "
        f"{req.factsAndClues.sceneFacts}"
    )

    print(
        "📝 사용자 인터뷰 답변: "
        f"{len(req.qaPairs)}개"
    )

    for idx, qa in enumerate(
        req.qaPairs,
        start=1
    ):

        print(
            f"   [{idx}] "
            f"[{qa.category}] "
            f"{qa.question}"
        )

        print(
            f"       → {qa.answer}"
        )

    print(
        "======================================================="
    )

    try:

        facts = (
            req.factsAndClues.model_dump()
        )

        pairs = [
            qa.model_dump()
            for qa in req.qaPairs
        ]

        curated_note = (
            await build_curated_memory_note(
                facts_and_clues=facts,
                qa_pairs=pairs,
            )
        )

        return curated_note

    except Exception as e:

        print(
            "❌ [큐레이션 라우터 오류]"
        )

        print(
            f"   Type: "
            f"{type(e).__name__}"
        )

        print(
            f"   repr: "
            f"{repr(e)}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "추억 큐레이션 노트 합성 실패: "
                f"{type(e).__name__}"
            )
        )


# ============================================================
# Generated Memory Book Note (Beta)
# ============================================================

@router.post("/generate-note")
async def generate_note_endpoint(
    req: GenerateNoteRequest,
):
    selected_style = (
        req.style
        if req.style in {"warm", "documentary"}
        else "warm"
    )

    print(
        "📚 [/api/gemini/generate-note 요청] "
        f"추억 {len(req.memories)}개, "
        f"문체 {selected_style}"
    )

    try:
        return await generate_memory_book_note(
            memories=[
                memory.model_dump()
                for memory in req.memories
            ],
            style=selected_style,
        )
    except Exception as e:
        print(
            "❌ [포토북 노트 생성 라우터 오류] "
            f"{type(e).__name__}: {repr(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=(
                "포토북 노트 생성 실패: "
                f"{type(e).__name__}"
            ),
        )
