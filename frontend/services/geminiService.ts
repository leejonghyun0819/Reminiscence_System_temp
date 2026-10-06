import { MemoryContextData } from '../types/memoryContext';

export type MemoryMode = 'childhood' | 'travel';

export interface PhotoAnalysisItem {
    photoIndex: number;
    globalPhotoIndex?: number;
    detected: MemoryMode | 'unknown';
    reason: string;
    observedFacts?: string[];
    memoryClues?: string[];
}

export interface InterviewQuestionItem {
    id: string;
    category: string;
    targetClue?: string;
    targetPhotoIndexes: number[];
    question: string;
    quickOptions?: string[];
}

export interface InterviewResponseData {
    estimatedEra: string;
    sceneFacts: string;
    visualClues: string[];
    interviewQuestions: InterviewQuestionItem[];
    detectedMode?: MemoryMode;
    memoryContext?: MemoryContextData;
}

export interface InterviewAnswerItem {
    id: string;
    category: string;
    targetClue?: string;
    targetPhotoIndexes: number[];
    targetImageUrls: string[];
    question: string;
    answer: string;
}

export interface ModeDetectionResult {
    mode: MemoryMode;
    photoAnalyses: PhotoAnalysisItem[];
}

export interface CuratedNoteData {
    title: string;
    sceneDescription: string;
    remembered: string;
    unremembered: string;
    reflection: string;
}

export type GeneratedNoteStyle = 'warm' | 'documentary';

export interface GeneratedNoteSourceItem {
    id: string;
    mode?: MemoryMode;
    title?: string;
    location?: string;
    yearEstimate?: string;
    categoryFolder?: string;
    sceneDescription?: string;
    remembered?: string;
    unremembered?: string;
    reflection?: string;
    interviewAnswers?: string[];
}

export interface GeneratedMemoryBookNote {
    title: string;
    subtitle: string;
    periodSummary: string;
    placeSummary: string;
    opening: string;
    body: string;
    closing: string;
    keywords: string[];
    sourceMemoryIds: string[];
    style: GeneratedNoteStyle;
}

const BASE_URL = 'http://localhost:8000';

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
    const errorBody = await response.json().catch(() => ({}));
    return errorBody.detail || fallback;
}

// 1. 여행 모드 멀티모달 분석
export async function analyzeMultiImageMemoryWithGemini(
    images: Array<{ base64: string; mimeType: string }>,
    audio?: { base64: string; mimeType?: string },
): Promise<any> {
    const response = await fetch(`${BASE_URL}/api/gemini/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            images,
            audio_base64: audio?.base64 || null,
            audio_mime: audio?.mimeType || null,
        }),
    });

    if (!response.ok) {
        throw new Error(await getErrorMessage(response, '멀티모달 분석에 실패했습니다.'));
    }

    const data = await response.json();
    return data.analysis;
}

// 2. 신규 사진 대상의 사진 연결형 인터뷰 질문 생성
export async function generateMemoryInterview(
    images: Array<{ base64: string; mimeType: string }>,
    photoAnalyses: PhotoAnalysisItem[] = [],
    detectedMode: MemoryMode = 'childhood',
    memoryContext: MemoryContextData = {},
): Promise<InterviewResponseData> {
    const response = await fetch(`${BASE_URL}/api/gemini/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            images,
            photoAnalyses,
            detectedMode,
            memoryContext,
        }),
    });

    if (!response.ok) {
        throw new Error(await getErrorMessage(response, '인터뷰 질문을 생성하지 못했습니다.'));
    }

    return await response.json();
}

// 3. 과거 앨범 대상 인터뷰 질문 생성
export async function generateInterviewFromExistingAlbum(
    memoryId: string,
    imageUrls?: string[],
    memoryContext?: MemoryContextData,
): Promise<InterviewResponseData> {
    const response = await fetch(`${BASE_URL}/api/gemini/interview-from-album`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            memoryId,
            imageUrls: imageUrls || [],
            memoryContext: memoryContext || {},
        }),
    });

    if (!response.ok) {
        throw new Error(await getErrorMessage(response, '과거 사진 분석에 실패했습니다.'));
    }

    return await response.json();
}

// 4. 사진 단서와 인터뷰 답변을 큐레이션 노트로 합성
export async function buildCuratedMemoryNote(
    factsAndClues: {
        estimatedEra?: string;
        sceneFacts?: string;
        visualClues?: string[];
        memoryContext?: MemoryContextData;
    },
    qaPairs: InterviewAnswerItem[],
): Promise<CuratedNoteData> {
    const response = await fetch(`${BASE_URL}/api/gemini/curate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            factsAndClues,
            qaPairs,
        }),
    });

    if (!response.ok) {
        throw new Error(await getErrorMessage(response, '큐레이션 노트 합성에 실패했습니다.'));
    }

    return await response.json();
}

// 5. 완성된 추억 기록 여러 개를 한 편의 포토북 노트로 합성
export async function generateMemoryBookNote(
    memories: GeneratedNoteSourceItem[],
    style: GeneratedNoteStyle = 'warm',
): Promise<GeneratedMemoryBookNote> {
    const response = await fetch(`${BASE_URL}/api/gemini/generate-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memories, style }),
    });

    if (!response.ok) {
        throw new Error(await getErrorMessage(response, '포토북 노트를 생성하지 못했습니다.'));
    }

    return await response.json();
}

// 6. 사진 전체의 모드와 사진별 분석 단서를 함께 반환
export async function detectMemoryMode(
    images: Array<{ base64: string; mimeType: string }>,
): Promise<ModeDetectionResult> {
    const response = await fetch(`${BASE_URL}/api/gemini/detect-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
    });

    if (!response.ok) {
        throw new Error(await getErrorMessage(response, '사진 유형을 분석하지 못했습니다.'));
    }

    const data = await response.json();

    return {
        mode: data.mode || 'travel',
        photoAnalyses: Array.isArray(data.photoAnalyses) ? data.photoAnalyses : [],
    };
}
