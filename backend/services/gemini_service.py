# backend/services/gemini_service.py

import io
import json
import base64
import asyncio
import time
from typing import Optional, List

from PIL import Image
from pydantic import BaseModel, Field

from google import genai
from google.genai import types

from config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    GEMINI_HTTP_TIMEOUT_MS,
    GEMINI_MAX_RETRIES,
    GEMINI_CLASSIFY_BATCH_SIZE,
    GEMINI_DIRECT_THRESHOLD,
)

from prompts.gemini_prompts import (
    INTERVIEW_GENERATION_PROMPT,
    CURATION_SYNTHESIS_PROMPT,
    PHOTO_VOTING_CLASSIFY_PROMPT,
    TRAVEL_ANALYSIS_PROMPT,
    build_travel_analysis_user_prompt,
    build_new_interview_user_prompt,
    build_curation_user_prompt,
    build_photo_classification_user_prompt,
    build_existing_album_interview_user_prompt,
)


# ============================================================
# 기본 설정
# ============================================================

MODEL_NAME = GEMINI_MODEL

DIRECT_THRESHOLD = GEMINI_DIRECT_THRESHOLD
BATCH_CHUNK_SIZE = GEMINI_CLASSIFY_BATCH_SIZE


# ============================================================
# Gemini Client
# ============================================================

_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:

    global _client

    if _client is not None:
        return _client

    if not GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY가 설정되지 않았습니다. "
            "backend/.env 파일을 확인해주세요."
        )

    _client = genai.Client(
        api_key=GEMINI_API_KEY,
        http_options=types.HttpOptions(
            timeout=GEMINI_HTTP_TIMEOUT_MS
        )
    )

    return _client


# ============================================================
# Structured Output Schema
# ============================================================

class PhotoAnalysisItem(BaseModel):
    photoIndex: int
    detected: str
    reason: str
    observedFacts: List[str] = Field(
        default_factory=list
    )
    memoryClues: List[str] = Field(
        default_factory=list
    )


class PhotoClassificationResponse(BaseModel):
    perPhotoAnalysis: List[PhotoAnalysisItem]


class InterviewQuestion(BaseModel):
    id: str
    category: str
    targetClue: str = ""
    targetPhotoIndexes: List[int] = Field(
        default_factory=list
    )
    question: str
    quickOptions: List[str] = Field(
        default_factory=list
    )


class InterviewResponse(BaseModel):
    estimatedEra: str
    sceneFacts: str
    visualClues: List[str]
    interviewQuestions: List[InterviewQuestion]


class CuratedNoteResponse(BaseModel):
    title: str
    sceneDescription: str
    remembered: str
    unremembered: str
    reflection: str


class TravelAnalysisResponse(BaseModel):
    title: str
    location: str
    yearEstimate: str
    description: str
    storyCaption: str
    audioTranscriptSummary: str = ""


# ============================================================
# Image Utils
# ============================================================

def _optimize_base64_image(
    b64_str: str,
    max_dim: int = 1024
) -> bytes:

    try:

        raw_bytes = base64.b64decode(
            b64_str
        )

        image = Image.open(
            io.BytesIO(raw_bytes)
        )

        if image.mode not in (
            "RGB",
            "L"
        ):
            image = image.convert(
                "RGB"
            )

        width, height = image.size

        if max(
            width,
            height
        ) > max_dim:

            scale = (
                max_dim
                /
                max(
                    width,
                    height
                )
            )

            new_size = (
                int(
                    width * scale
                ),
                int(
                    height * scale
                )
            )

            image = image.resize(
                new_size,
                Image.Resampling.LANCZOS
            )

        buffer = io.BytesIO()

        image.save(
            buffer,
            format="JPEG",
            quality=80,
            optimize=True
        )

        return buffer.getvalue()

    except Exception as e:

        print(
            "⚠️ 이미지 최적화 실패. "
            "원본 binary 사용:"
            f" {type(e).__name__}: {e}"
        )

        return base64.b64decode(
            b64_str
        )


def _image_part(
    image_data: dict
) -> types.Part:

    binary = _optimize_base64_image(
        image_data.get(
            "base64",
            ""
        )
    )

    return types.Part.from_bytes(
        data=binary,
        mime_type="image/jpeg"
    )


def _audio_part(
    audio_base64: str,
    audio_mime: Optional[str]
) -> types.Part:

    binary = base64.b64decode(
        audio_base64
    )

    return types.Part.from_bytes(
        data=binary,
        mime_type=(
            audio_mime
            or "audio/mp3"
        )
    )


# ============================================================
# Gemini 공통 호출
# ============================================================

async def _generate_json(
    *,
    parts: List[types.Part],
    system_instruction: str,
    response_schema,
    operation_name: str,
    max_retries: Optional[int] = None,
) -> dict:

    client = _get_client()

    retry_count = (
        GEMINI_MAX_RETRIES
        if max_retries is None
        else max_retries
    )

    last_exception = None

    for attempt in range(
        retry_count + 1
    ):

        start_time = (
            time.perf_counter()
        )

        try:

            print(
                f"🤖 [{operation_name}] "
                f"Gemini 요청 시작 "
                f"(attempt {attempt + 1}/"
                f"{retry_count + 1})"
            )

            response = (
                await client.aio.models.generate_content(
                    model=MODEL_NAME,
                    contents=[
                        types.Content(
                            role="user",
                            parts=parts
                        )
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=(
                            system_instruction
                        ),
                        response_mime_type=(
                            "application/json"
                        ),
                        response_schema=(
                            response_schema
                        ),
                    ),
                )
            )

            elapsed = (
                time.perf_counter()
                - start_time
            )

            print(
                f"✅ [{operation_name}] "
                f"응답 완료: "
                f"{elapsed:.2f}초"
            )

            if (
                response.parsed
                is not None
            ):

                parsed = (
                    response.parsed
                )

                if isinstance(
                    parsed,
                    BaseModel
                ):

                    return parsed.model_dump()

                if isinstance(
                    parsed,
                    dict
                ):

                    return (
                        response_schema
                        .model_validate(
                            parsed
                        )
                        .model_dump()
                    )

            if not response.text:

                raise ValueError(
                    "Gemini 응답의 text가 비어 있습니다."
                )

            raw_result = json.loads(
                response.text
            )

            return (
                response_schema
                .model_validate(
                    raw_result
                )
                .model_dump()
            )

        except Exception as e:

            elapsed = (
                time.perf_counter()
                - start_time
            )

            last_exception = e

            print(
                f"⚠️ [{operation_name}] "
                f"Gemini 호출 실패"
            )

            print(
                f"   - attempt: "
                f"{attempt + 1}/"
                f"{retry_count + 1}"
            )

            print(
                f"   - elapsed: "
                f"{elapsed:.2f}초"
            )

            print(
                f"   - Exception Type: "
                f"{type(e).__name__}"
            )

            print(
                f"   - Exception repr: "
                f"{repr(e)}"
            )

            if (
                attempt
                >= retry_count
            ):
                break

            # 1초 → 2초 정도의 짧은 backoff
            backoff = min(
                1.0 * (
                    2 ** attempt
                ),
                3.0
            )

            print(
                f"   ↻ {backoff:.1f}초 후 재시도"
            )

            await asyncio.sleep(
                backoff
            )

    raise last_exception


# ============================================================
# Photo-aware Interview Helpers
# ============================================================

def _select_representative_images(
    images_data: list[dict],
    max_images: int = 8,
) -> list[tuple[int, dict]]:
    total_count = len(images_data)

    if total_count <= max_images:
        return list(enumerate(images_data))

    indexes = [
        round(
            i
            * (total_count - 1)
            / (max_images - 1)
        )
        for i in range(max_images)
    ]

    unique_indexes = list(
        dict.fromkeys(indexes)
    )

    return [
        (index, images_data[index])
        for index in unique_indexes
    ]


def _append_labeled_images(
    parts: List[types.Part],
    indexed_images: list[tuple[int, dict]],
) -> None:
    for zero_based_index, image in indexed_images:
        parts.append(
            types.Part.from_text(
                text=f"사진 {zero_based_index + 1}"
            )
        )
        parts.append(
            _image_part(image)
        )


def _normalize_interview_photo_indexes(
    result: dict,
    total_count: int,
    fallback_photo_indexes: list[int],
) -> dict:
    if total_count <= 0:
        return result

    safe_fallback_indexes = [
        photo_index
        for photo_index in fallback_photo_indexes
        if 1 <= photo_index <= total_count
    ]

    if not safe_fallback_indexes:
        safe_fallback_indexes = [1]

    normalized_questions = []

    for question_position, question in enumerate(
        result.get(
            "interviewQuestions",
            [],
        )
    ):
        normalized_question = dict(
            question
        )

        valid_indexes = []

        for raw_index in normalized_question.get(
            "targetPhotoIndexes",
            [],
        ):
            if isinstance(
                raw_index,
                bool,
            ):
                continue

            try:
                photo_index = int(
                    raw_index
                )
            except (
                TypeError,
                ValueError,
            ):
                continue

            if (
                1 <= photo_index <= total_count
                and photo_index not in valid_indexes
            ):
                valid_indexes.append(
                    photo_index
                )

        if not valid_indexes:
            valid_indexes = [
                safe_fallback_indexes[
                    question_position
                    % len(
                        safe_fallback_indexes
                    )
                ]
            ]

        normalized_question[
            "targetPhotoIndexes"
        ] = valid_indexes

        normalized_questions.append(
            normalized_question
        )

    normalized_result = dict(
        result
    )

    normalized_result[
        "interviewQuestions"
    ] = normalized_questions

    return normalized_result


def _format_photo_analysis_summary(
    photo_analyses: list[dict],
) -> str:
    lines = []

    for analysis in photo_analyses:
        photo_index = (
            analysis.get("globalPhotoIndex")
            or analysis.get("photoIndex")
        )

        if not photo_index:
            continue

        observed_facts = analysis.get(
            "observedFacts",
            [],
        ) or []
        memory_clues = analysis.get(
            "memoryClues",
            [],
        ) or []
        reason = analysis.get(
            "reason",
            "",
        )

        lines.append(
            f"- 사진 {photo_index}\n"
            f"  관찰 사실: "
            f"{'; '.join(observed_facts) if observed_facts else '세부 관찰 없음'}\n"
            f"  기억 단서: "
            f"{'; '.join(memory_clues) if memory_clues else reason or '단서 없음'}"
        )

    if not lines:
        return (
            "사진별 분석 단서가 없습니다. "
            "함께 제공된 원본 사진에서 직접 단서를 찾으세요."
        )

    return "\n".join(lines)


# ============================================================
# Travel / Multimodal
# ============================================================

async def analyze_multimodal_memory(
    images_data: list[dict],
    audio_base64: str | None = None,
    audio_mime: str | None = None,
) -> dict:

    parts: List[types.Part] = []

    for image in images_data[:6]:

        parts.append(
            _image_part(
                image
            )
        )

    if audio_base64:

        parts.append(
            _audio_part(
                audio_base64,
                audio_mime
            )
        )

    parts.append(
        types.Part.from_text(
            text=build_travel_analysis_user_prompt(
                len(images_data)
            )
        )
    )

    return await _generate_json(
        parts=parts,
        system_instruction=(
            TRAVEL_ANALYSIS_PROMPT
        ),
        response_schema=(
            TravelAnalysisResponse
        ),
        operation_name=(
            "여행/일상 종합 분석"
        ),
    )


# ============================================================
# New Interview
# ============================================================

async def generate_memory_interview(
    images_data: list[dict],
    photo_analyses: Optional[list[dict]] = None,
    memory_mode: str = "childhood",
    memory_context: Optional[dict] = None,
) -> dict:

    parts: List[types.Part] = []

    indexed_images = _select_representative_images(
        images_data,
    )

    _append_labeled_images(
        parts,
        indexed_images,
    )

    clues_summary = _format_photo_analysis_summary(
        photo_analyses or [],
    )

    parts.append(
        types.Part.from_text(
            text=build_new_interview_user_prompt(
                total_count=len(images_data),
                clues_summary=clues_summary,
                memory_mode=memory_mode,
                provided_photo_indexes=[
                    index + 1
                    for index, _ in indexed_images
                ],
                memory_context=memory_context,
            )
        )
    )

    result = await _generate_json(
        parts=parts,
        system_instruction=(
            INTERVIEW_GENERATION_PROMPT
        ),
        response_schema=(
            InterviewResponse
        ),
        operation_name=(
            "신규 기억 인터뷰 생성"
        ),
    )

    normalized_result = _normalize_interview_photo_indexes(
        result=result,
        total_count=len(
            images_data
        ),
        fallback_photo_indexes=[
            index + 1
            for index, _ in indexed_images
        ],
    )

    normalized_result[
        "memoryContext"
    ] = memory_context or {}

    return normalized_result


# ============================================================
# Curated Note
# ============================================================

async def build_curated_memory_note(
    facts_and_clues: dict,
    qa_pairs: list[dict]
) -> dict:

    parts = [
        types.Part.from_text(
            text=build_curation_user_prompt(
                facts_and_clues,
                qa_pairs,
            )
        )
    ]

    try:

        result = await _generate_json(
            parts=parts,
            system_instruction=(
                CURATION_SYNTHESIS_PROMPT
            ),
            response_schema=(
                CuratedNoteResponse
            ),
            operation_name=(
                "추억 노트 큐레이션"
            ),
        )

        print(
            "✨ [큐레이션 완료] "
            f"{result.get('title')}"
        )

        return result

    except Exception as e:

        print(
            "⚠️ 큐레이션 최종 실패. "
            "로컬 fallback 사용"
        )

        print(
            f"   {type(e).__name__}: "
            f"{repr(e)}"
        )

        meaningful_answers = []

        for item in qa_pairs:

            answer = (
                item.get(
                    "answer",
                    ""
                )
                or ""
            ).strip()

            if not answer:
                continue

            if answer in {
                "기억 안 남",
                "기억이 안 남",
                "모르겠음",
                "잘 모르겠음",
            }:
                continue

            meaningful_answers.append(
                answer
            )

        remembered = (
            " ".join(
                meaningful_answers
            )
            if meaningful_answers
            else (
                "사진은 남아 있지만 "
                "이 장면에 대한 구체적인 기억은 "
                "아직 선명하지 않다."
            )
        )

        clues = (
            facts_and_clues.get(
                "visualClues",
                []
            )
            or []
        )

        title = (
            f"{clues[0]}에 남은 기억"
            if clues
            else "사진 속에 남은 한 장면"
        )

        return {
            "title": title,
            "sceneDescription": (
                facts_and_clues.get(
                    "sceneFacts",
                    ""
                )
                or (
                    "사진 속에 당시의 모습이 "
                    "기록되어 있다."
                )
            ),
            "remembered": remembered,
            "unremembered": (
                "사진 속 일부 상황은 "
                "현재 정확히 기억나지 않는다."
            ),
            "reflection": (
                "사진을 다시 바라보며 "
                "기억나는 부분과 기억나지 않는 부분을 "
                "천천히 되짚어본다."
            ),
        }


# ============================================================
# Classification
# ============================================================

async def _classify_images_once(
    images_data: list[dict],
    operation_name: str,
) -> list[dict]:

    parts: List[types.Part] = []

    for local_index, image in enumerate(
        images_data,
        start=1,
    ):

        parts.append(
            types.Part.from_text(
                text=f"사진 {local_index}"
            )
        )

        parts.append(
            _image_part(
                image
            )
        )

    parts.append(
        types.Part.from_text(
            text=build_photo_classification_user_prompt(
                len(images_data)
            )
        )
    )

    result = await _generate_json(
        parts=parts,
        system_instruction=(
            PHOTO_VOTING_CLASSIFY_PROMPT
        ),
        response_schema=(
            PhotoClassificationResponse
        ),
        operation_name=(
            operation_name
        ),
        # classification 자체에서 이미
        # recursive retry가 있기 때문에
        # 한 호출당 재시도는 1회로 제한
        max_retries=1,
    )

    analyses = result.get(
        "perPhotoAnalysis",
        []
    )

    if len(analyses) != len(
        images_data
    ):

        raise ValueError(
            "Gemini 분류 결과 수가 입력 사진 수와 다릅니다. "
            f"input={len(images_data)}, "
            f"output={len(analyses)}"
        )

    expected_indexes = set(
        range(
            1,
            len(images_data) + 1,
        )
    )

    actual_indexes = {
        item.get(
            "photoIndex"
        )
        for item in analyses
    }

    if actual_indexes != expected_indexes:

        raise ValueError(
            "Gemini 사진 번호가 입력 순서와 일치하지 않습니다. "
            f"expected={sorted(expected_indexes)}, "
            f"actual={sorted(actual_indexes)}"
        )

    return sorted(
        analyses,
        key=lambda item: item[
            "photoIndex"
        ],
    )


async def _classify_chunk_adaptive(
    images_data: list[dict],
    global_start_index: int,
    depth: int = 0,
) -> list[dict]:

    count = len(
        images_data
    )

    label = (
        f"사진 분류 "
        f"{global_start_index}"
        f"~"
        f"{global_start_index + count - 1}"
    )

    try:

        print(
            f"📸 [{label}] "
            f"{count}장 요청"
        )

        analyses = (
            await _classify_images_once(
                images_data,
                label,
            )
        )

        result = []

        for item in analyses:

            normalized = dict(
                item
            )

            normalized[
                "globalPhotoIndex"
            ] = (
                global_start_index
                + normalized[
                    "photoIndex"
                ]
                - 1
            )

            result.append(
                normalized
            )

        return result

    except Exception as e:

        print(
            f"⚠️ [{label}] 실패"
        )

        print(
            "   Exception Type: "
            f"{type(e).__name__}"
        )

        print(
            "   Exception repr: "
            f"{repr(e)}"
        )

        # ====================================================
        # 핵심:
        # 4장 실패 → 2장 + 2장
        # 2장 실패 → 1장 + 1장
        # ====================================================

        if count > 1:

            middle = (
                count // 2
            )

            left = (
                images_data[:middle]
            )

            right = (
                images_data[middle:]
            )

            print(
                f"🔀 [{label}] "
                f"{count}장 → "
                f"{len(left)}장 + "
                f"{len(right)}장으로 자동 분할"
            )

            # API가 잠깐 불안정했을 가능성을 고려
            await asyncio.sleep(
                0.5
            )

            left_result = (
                await _classify_chunk_adaptive(
                    left,
                    global_start_index,
                    depth + 1,
                )
            )

            right_result = (
                await _classify_chunk_adaptive(
                    right,
                    global_start_index
                    + len(left),
                    depth + 1,
                )
            )

            return (
                left_result
                + right_result
            )

        # ====================================================
        # 한 장짜리 요청까지 실패했을 경우
        # 억지로 childhood로 분류하지 않는다.
        # ====================================================

        print(
            f"❌ 사진 {global_start_index}번 "
            "단독 분석까지 실패"
        )

        return [{
            "globalPhotoIndex": (
                global_start_index
            ),
            "photoIndex": 1,
            "detected": "unknown",
            "reason": (
                "Gemini API 분석 실패"
            ),
        }]


async def detect_memory_mode(
    images_data: list[dict]
) -> str:

    mode, _ = (
        await detect_memory_mode_batch(
            images_data
        )
    )

    return mode


async def detect_memory_mode_batch(
    images_data: list[dict]
) -> tuple[str, list[dict]]:

    total_count = len(
        images_data
    )

    if total_count == 0:

        return (
            "travel",
            []
        )

    print(
        "\n======================================================="
    )

    print(
        "🧠 [사진 모드 분석 시작]"
    )

    print(
        f"   총 사진 수: {total_count}장"
    )

    print(
        f"   기본 Batch 크기: "
        f"{BATCH_CHUNK_SIZE}장"
    )

    print(
        f"   모델: {MODEL_NAME}"
    )

    print(
        "======================================================="
    )

    all_analysis: list[dict] = []

    start_index = 0

    while start_index < total_count:

        chunk = images_data[
            start_index:
            start_index
            + BATCH_CHUNK_SIZE
        ]

        chunk_result = (
            await _classify_chunk_adaptive(
                images_data=chunk,
                global_start_index=(
                    start_index + 1
                ),
            )
        )

        all_analysis.extend(
            chunk_result
        )

        start_index += len(
            chunk
        )

    childhood_votes = sum(
        1
        for item in all_analysis
        if (
            item.get(
                "detected",
                ""
            ).lower()
            == "childhood"
        )
    )

    travel_votes = sum(
        1
        for item in all_analysis
        if (
            item.get(
                "detected",
                ""
            ).lower()
            == "travel"
        )
    )

    unknown_votes = sum(
        1
        for item in all_analysis
        if (
            item.get(
                "detected",
                ""
            ).lower()
            not in {
                "childhood",
                "travel"
            }
        )
    )

    valid_votes = (
        childhood_votes
        + travel_votes
    )

    # 모든 API 분석이 실패했을 때
    if valid_votes == 0:

        print(
            "❌ 모든 사진 분류가 실패했습니다."
        )

        print(
            "⚠️ 기존 프론트 호환을 위해 "
            "travel을 기본값으로 반환합니다."
        )

        final_mode = (
            "travel"
        )

    else:

        final_mode = (
            "childhood"
            if childhood_votes
            >= travel_votes
            else "travel"
        )

    print(
        "\n🎯 [최종 사진 분류 결과]"
    )

    print(
        f"   Childhood : "
        f"{childhood_votes}"
    )

    print(
        f"   Travel    : "
        f"{travel_votes}"
    )

    print(
        f"   Unknown   : "
        f"{unknown_votes}"
    )

    print(
        f"   Final     : "
        f"{final_mode.upper()}"
    )

    print(
        "=======================================================\n"
    )

    return (
        final_mode,
        all_analysis
    )


# ============================================================
# Existing Album Interview
# ============================================================

async def generate_memory_interview_batch(
    images_data: list[dict],
    photo_analyses: list[dict],
    memory_mode: str = "childhood",
    memory_context: Optional[dict] = None,
) -> dict:

    total_count = len(
        images_data
    )

    parts: List[types.Part] = []

    # ========================================================
    # 대표 이미지와 원본 앨범 번호 연결
    # ========================================================

    indexed_images = _select_representative_images(
        images_data,
    )

    _append_labeled_images(
        parts,
        indexed_images,
    )

    # ========================================================
    # 분류 분석 결과 요약
    # ========================================================

    clues_summary = _format_photo_analysis_summary(
        photo_analyses,
    )

    parts.append(
        types.Part.from_text(
            text=build_existing_album_interview_user_prompt(
                total_count=total_count,
                clues_summary=clues_summary,
                memory_mode=memory_mode,
                provided_photo_indexes=[
                    index + 1
                    for index, _ in indexed_images
                ],
                memory_context=memory_context,
            )
        )
    )

    try:

        result = await _generate_json(
            parts=parts,
            system_instruction=(
                INTERVIEW_GENERATION_PROMPT
            ),
            response_schema=(
                InterviewResponse
            ),
            operation_name=(
                "기존 앨범 인터뷰 재생성"
            ),
        )

        normalized_result = _normalize_interview_photo_indexes(
            result=result,
            total_count=total_count,
            fallback_photo_indexes=[
                index + 1
                for index, _ in indexed_images
            ],
        )

        normalized_result[
            "memoryContext"
        ] = memory_context or {}

        return normalized_result

    except Exception as e:

        print(
            "⚠️ 인터뷰 생성 최종 fallback"
        )

        print(
            f"   {type(e).__name__}: "
            f"{repr(e)}"
        )

        first_photo = 1
        second_photo = min(
            2,
            max(1, total_count),
        )
        last_photo = max(
            1,
            total_count,
        )

        return {
            "estimatedEra": (
                "정확한 시기 확인 필요"
            ),

            "sceneFacts": (
                "여러 장의 과거 사진에 "
                "인물과 주변 공간이 기록되어 있다."
            ),

            "visualClues": [
                "반복적으로 등장하는 공간",
                "여러 사진에 등장하는 사람",
                "사진에 남아 있는 당시의 생활 물건",
            ],

            "memoryContext": memory_context or {},

            "interviewQuestions": [
                {
                    "id": "q_1",
                    "category": (
                        "반복되던 일상"
                    ),
                    "targetClue": (
                        "사진 1에 보이는 공간"
                    ),
                    "targetPhotoIndexes": [
                        first_photo
                    ],
                    "question": (
                        f"사진 {first_photo}의 공간에서 "
                        "자주 하던 일이나 "
                        "반복되던 하루의 모습이 있었나요?"
                    ),
                    "quickOptions": [
                        "자주 놀던 곳",
                        "가족과 있던 곳",
                        "특별한 날에 가던 곳",
                        "기억 안 남",
                    ],
                },

                {
                    "id": "q_2",
                    "category": (
                        "관계"
                    ),
                    "targetClue": (
                        f"사진 {second_photo}에 등장하는 사람들"
                    ),
                    "targetPhotoIndexes": [
                        second_photo
                    ],
                    "question": (
                        f"사진 {second_photo} 속 사람들과 "
                        "당시 자주 함께했던 일 중 "
                        "지금도 떠오르는 장면이 있나요?"
                    ),
                    "quickOptions": [
                        "함께 놀던 기억",
                        "함께 외출한 기억",
                        "가족 행사",
                        "기억 안 남",
                    ],
                },

                {
                    "id": "q_3",
                    "category": (
                        "사진 밖의 이야기"
                    ),
                    "targetClue": (
                        f"사진 {last_photo}에 기록된 당시 장면"
                    ),
                    "targetPhotoIndexes": [
                        last_photo
                    ],
                    "question": (
                        f"사진 {last_photo}를 보면 "
                        "사진을 찍기 전이나 "
                        "찍은 뒤에 있었던 일까지 "
                        "떠오르는 것이 있나요?"
                    ),
                    "quickOptions": [
                        "사진 찍기 전이 기억남",
                        "사진 찍은 뒤가 기억남",
                        "다른 장면이 떠오름",
                        "기억 안 남",
                    ],
                },
            ],
        }
