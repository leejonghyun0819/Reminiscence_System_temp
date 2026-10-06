// frontend/context/MemoryContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { MemoryContextData } from '../types/memoryContext';

const BACKEND_URL = 'http://localhost:8000';

export interface AnalysisData {
    title?: string;
    location?: string;
    yearEstimate?: string;
    description?: string;
    storyCaption?: string;
    audioTranscriptSummary?: string;
}

export interface MemoryHistoryItem {
    version: number;
    timestamp: number;
    title: string;
    location: string;
    yearEstimate: string;
    description: string;
    storyCaption: string;
}

export interface CuratedNote {
    title: string;
    sceneDescription: string;
    remembered: string;
    unremembered: string;
    reflection: string;
}

export interface GeneratedBookNote {
    title: string;
    subtitle: string;
    periodSummary: string;
    placeSummary: string;
    opening: string;
    body: string;
    closing: string;
    keywords: string[];
    sourceMemoryIds: string[];
    style: 'warm' | 'documentary';
}

export interface InterviewQAItem {
    id: string;
    category: string;
    targetClue?: string;
    targetPhotoIndexes?: number[];
    targetImageUrls?: string[];
    question: string;
    quickOptions?: string[];
    answer: string;
}

export interface InterviewData {
    estimatedEra: string;
    sceneFacts: string;
    visualClues: string[];
    questions: InterviewQAItem[];
    memoryContext?: MemoryContextData;
}

export type AnalysisVersion = MemoryHistoryItem;
export type BackupAlbumItem = MemoryItem;
export type UpdateMemoryPayload = {
    title?: string;
    location?: string;
    yearEstimate?: string;
    description?: string;
    storyCaption?: string;
    categoryFolder?: string;
    mode?: 'travel' | 'childhood';
    rootCategory?: '유년시절' | '여행';
    curatedNote?: CuratedNote;
    interviewData?: InterviewData;
};

export type UploadableAsset = any;

export interface MemoryItem {
    id: string;
    mode?: 'travel' | 'childhood';
    rootCategory?: '유년시절' | '여행';
    fileNames: string[];
    imageUrls: string[];
    audioFileName?: string;
    audioUrl?: string;
    categoryFolder?: string;
    analysis?: AnalysisData;
    history?: MemoryHistoryItem[];
    createdAt?: number;
    interviewData?: InterviewData;
    curatedNote?: CuratedNote;
    generatedNote?: GeneratedBookNote;
}

interface MemoryContextType {
    memoryList: MemoryItem[];
    memories: MemoryItem[];
    selectedEnhanceMemory: MemoryItem | null;
    selectedGenerateMemory: MemoryItem | null;
    folderList: string[];
    categorizedFolders: { [key: string]: string[] };
    generatedNotes: MemoryItem[];

    currentMode: 'travel' | 'childhood';
    setCurrentMode: (mode: 'travel' | 'childhood') => void;

    fetchMemories: () => Promise<void>;
    fetchFolders: () => Promise<void>;
    setSelectedEnhanceMemory: (memory: MemoryItem | null) => void;
    setSelectedGenerateMemory: (memory: MemoryItem | null) => void;
    clearSelectedGenerateMemory: () => void;

    addMultiImageMemoryToServer: (
        arg1: any,
        arg2?: any,
        arg3?: any,
        arg4?: any,
        arg5?: any,
    ) => Promise<MemoryItem | null>;
    appendFilesToMemory: (memoryId: string, newImageAssets: any) => Promise<boolean>;
    updateMemoryItem: (id: string, updates: UpdateMemoryPayload) => Promise<MemoryHistoryItem[] | null>;
    deleteMemoryItem: (id: string) => Promise<boolean>;
    deleteMultipleMemoryItems: (ids: string[]) => Promise<boolean>;
    clearAllMemories: () => Promise<boolean>;

    appendActiveMemory: (memory: MemoryItem) => void;
    appendActiveMemories: (memories: MemoryItem[]) => void;

    addToGeneratedNotes: (memory: MemoryItem) => void;
    addMultipleToGeneratedNotes: (memories: MemoryItem[]) => void;
    updateGeneratedNote: (id: string, updates: { title: string; story: string }) => void;
    deleteFromGeneratedNotes: (id: string) => void;
    deleteMultipleFromGeneratedNotes: (ids: string[]) => void;

    swapAlbumImage: (memoryId: string, oldUrl: string, newUrl: string) => Promise<boolean>;
    appendAlbumImage: (memoryId: string, imageUrl: string) => Promise<boolean>;
    deleteSingleImage: (memoryId: string, targetImageUrl: string) => Promise<boolean>;
    deleteHistoryVersion: (memoryId: string, version: number) => Promise<boolean>;

    createFolder: (name: string, rootCategory?: '유년시절' | '여행') => Promise<boolean>;
    moveMemoryToFolder: (memoryId: string, folderName: string) => Promise<boolean>;
    batchMoveMemoriesToFolder: (albumIds: string[], folderName: string) => Promise<boolean>;
}

const MemoryContext = createContext<MemoryContextType | undefined>(undefined);

async function assetToBlob(asset: any, defaultName: string): Promise<{ blob: Blob; name: string }> {
    if (!asset) {
        return { blob: new Blob([''], { type: 'image/jpeg' }), name: defaultName };
    }
    if (asset instanceof File) {
        return { blob: asset, name: asset.name };
    }
    if (asset instanceof Blob) {
        return { blob: asset, name: defaultName };
    }
    if (asset.file instanceof File || asset.file instanceof Blob) {
        return { blob: asset.file, name: asset.name || asset.fileName || defaultName };
    }
    if (typeof asset === 'string' && asset.startsWith('data:')) {
        const res = await fetch(asset);
        const blob = await res.blob();
        return { blob, name: defaultName };
    }
    if (typeof asset.base64 === 'string') {
        const dataUri = asset.base64.startsWith('data:')
            ? asset.base64
            : `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
        const res = await fetch(dataUri);
        const blob = await res.blob();
        return { blob, name: asset.name || defaultName };
    }
    if (typeof asset.uri === 'string') {
        try {
            const res = await fetch(asset.uri);
            const blob = await res.blob();
            return { blob, name: asset.name || asset.fileName || defaultName };
        } catch (e) {
            console.warn('URI 변환 실패:', e);
        }
    }
    return { blob: new Blob([''], { type: 'image/jpeg' }), name: defaultName };
}

export const MemoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [memoryList, setMemoryList] = useState<MemoryItem[]>([]);
    const [selectedEnhanceMemory, setSelectedEnhanceMemory] = useState<MemoryItem | null>(null);
    const [selectedGenerateMemory, setSelectedGenerateMemory] = useState<MemoryItem | null>(null);
    const [generatedNotes, setGeneratedNotes] = useState<MemoryItem[]>([]);
    const [folderList, setFolderList] = useState<string[]>(['미분류']);
    const [categorizedFolders, setCategorizedFolders] = useState<{ [key: string]: string[] }>({
        유년시절: [],
        여행: [],
    });
    const [currentMode, setCurrentMode] = useState<'travel' | 'childhood'>('childhood');

    const fetchFolders = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/folders`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.all && Array.isArray(data.all)) {
                    setFolderList(['미분류', ...data.all.filter((f: string) => f !== '미분류')]);
                    if (data.categorized) {
                        setCategorizedFolders(data.categorized);
                    }
                } else if (Array.isArray(data)) {
                    setFolderList(data);
                }
            }
        } catch (e) {
            console.error('폴더 로딩 실패:', e);
        }
    };

    const fetchMemories = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/memories`);
            if (res.ok) {
                const data: MemoryItem[] = await res.json();
                setMemoryList(data);
                if (data.length > 0 && !selectedEnhanceMemory) {
                    setSelectedEnhanceMemory(data[0]);
                }
            }
        } catch (e) {
            console.error('메모리 로딩 실패:', e);
        }
    };

    useEffect(() => {
        fetchFolders();
    }, []);

    const addMultiImageMemoryToServer = async (
        arg1: any,
        arg2?: any,
        arg3?: any,
        arg4?: any,
        arg5?: any,
    ): Promise<MemoryItem | null> => {
        try {
            let id = `album_${Date.now()}`;
            let rawAnalysis: any = {};
            let imageAssets: any[] = [];
            let audioAsset: any = null;
            let categoryFolder = '미분류';

            const args = [arg1, arg2, arg3, arg4, arg5].filter((a) => a !== undefined);

            for (const arg of args) {
                if (typeof arg === 'string') {
                    if (arg.startsWith('album_')) {
                        id = arg;
                    } else if (arg !== '미분류' && folderList.includes(arg)) {
                        categoryFolder = arg;
                    }
                } else if (Array.isArray(arg)) {
                    imageAssets = arg;
                } else if (typeof arg === 'object' && arg !== null) {
                    if (
                        'title' in arg ||
                        'description' in arg ||
                        'storyCaption' in arg ||
                        'analysis' in arg ||
                        'mode' in arg
                    ) {
                        rawAnalysis = arg.analysis || arg;
                        if (arg.images && Array.isArray(arg.images)) imageAssets = arg.images;
                        if (arg.audio) audioAsset = arg.audio;
                        if (arg.categoryFolder) categoryFolder = arg.categoryFolder;
                        if (arg.id) id = arg.id;
                    } else if (arg.uri || arg.base64 || arg instanceof Blob || arg instanceof File) {
                        audioAsset = arg;
                    }
                }
            }

            const targetAnalysis = Array.isArray(rawAnalysis)
                ? rawAnalysis[0]
                : rawAnalysis?.analysis || rawAnalysis || {};

            const analysis: AnalysisData = {
                title: targetAnalysis.title || '추억의 순간',
                location: targetAnalysis.location || '장소 미상',
                yearEstimate: targetAnalysis.yearEstimate || targetAnalysis.year_estimate || '시기 미상',
                description: targetAnalysis.description || '',
                storyCaption: targetAnalysis.storyCaption || '',
                audioTranscriptSummary: targetAnalysis.audioTranscriptSummary || '',
            };

            const finalMode = rawAnalysis.mode || currentMode;
            const finalRoot = finalMode === 'childhood' ? '유년시절' : '여행';

            const payloadAnalysis = {
                analysis,
                mode: finalMode,
                rootCategory: finalRoot,
                curatedNote: rawAnalysis.curatedNote,
                interviewData: rawAnalysis.interviewData,
            };

            const formData = new FormData();
            formData.append('id', id);
            formData.append('analysisJson', JSON.stringify(payloadAnalysis));
            formData.append('categoryFolder', categoryFolder || '미분류');

            for (let i = 0; i < imageAssets.length; i++) {
                const { blob, name } = await assetToBlob(imageAssets[i], `image_${i}.jpg`);
                formData.append('imageFiles', blob, name);
            }

            if (audioAsset) {
                const { blob, name } = await assetToBlob(audioAsset, 'audio.mp3');
                if (blob.size > 0) {
                    formData.append('audioFile', blob, name);
                }
            }

            const postRes = await fetch(`${BACKEND_URL}/api/memories`, {
                method: 'POST',
                body: formData,
            });

            if (!postRes.ok) {
                const errorText = await postRes.text();
                throw new Error(`서버 저장 실패 (${postRes.status}): ${errorText}`);
            }

            const savedItem: MemoryItem = await postRes.json();
            setMemoryList((prev) => [savedItem, ...prev]);
            setSelectedEnhanceMemory(savedItem);
            return savedItem;
        } catch (e) {
            console.error('앨범 서버 생성 오류 상세:', e);
            return null;
        }
    };

    const appendFilesToMemory = async (memoryId: string, newImageAssets: any): Promise<boolean> => {
        try {
            const assets = Array.isArray(newImageAssets) ? newImageAssets : [newImageAssets];
            const formData = new FormData();
            for (let i = 0; i < assets.length; i++) {
                const { blob, name } = await assetToBlob(assets[i], `new_image_${i}.jpg`);
                formData.append('newImageFiles', blob, name);
            }

            const postRes = await fetch(`${BACKEND_URL}/api/memories/${memoryId}/append-files`, {
                method: 'POST',
                body: formData,
            });

            if (postRes.ok) {
                const data = await postRes.json();
                setMemoryList((prev) =>
                    prev.map((m) =>
                        m.id === memoryId ? { ...m, imageUrls: data.imageUrls, fileNames: data.fileNames } : m,
                    ),
                );
                return true;
            }
            return false;
        } catch (e) {
            console.error('파일 추가 실패:', e);
            return false;
        }
    };

    const updateMemoryItem = async (id: string, updates: UpdateMemoryPayload): Promise<MemoryHistoryItem[] | null> => {
        try {
            // mode에 따라 rootCategory 자동 보정 후 백엔드 전송
            const resolvedRoot =
                updates.rootCategory ||
                (updates.mode === 'childhood' ? '유년시절' : updates.mode === 'travel' ? '여행' : undefined);

            const payload = {
                ...updates,
                rootCategory: resolvedRoot,
            };

            const res = await fetch(`${BACKEND_URL}/api/memories/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const errorBody = await res.json().catch(() => ({}));
                throw new Error(
                    errorBody.detail || `추억 업데이트에 실패했습니다. (HTTP ${res.status})`,
                );
            }

            {
                const data = await res.json();
                const nextHistory: MemoryHistoryItem[] = data.history || [];
                setMemoryList((prev) =>
                    prev.map((m) => {
                        if (m.id === id) {
                            return {
                                ...m,
                                analysis: { ...m.analysis, ...updates },
                                categoryFolder: updates.categoryFolder ?? m.categoryFolder,
                                mode: updates.mode ?? m.mode,
                                rootCategory: resolvedRoot ?? m.rootCategory,
                                curatedNote: updates.curatedNote ?? m.curatedNote,
                                interviewData: updates.interviewData ?? m.interviewData,
                                history: nextHistory,
                            };
                        }
                        return m;
                    }),
                );
                return nextHistory;
            }
        } catch (e) {
            console.error('메모리 업데이트 실패:', e);
            throw e;
        }
    };

    const swapAlbumImage = async (memoryId: string, oldUrl: string, newUrl: string): Promise<boolean> => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/memories/${memoryId}/swap-image`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldUrl, newUrl }),
            });
            if (res.ok) {
                const updateUrls = (urls: string[]) => urls.map((u) => (u === oldUrl ? newUrl : u));
                setMemoryList((prev) =>
                    prev.map((m) => (m.id === memoryId ? { ...m, imageUrls: updateUrls(m.imageUrls) } : m)),
                );
                if (selectedEnhanceMemory?.id === memoryId) {
                    setSelectedEnhanceMemory((prev) =>
                        prev ? { ...prev, imageUrls: updateUrls(prev.imageUrls) } : null,
                    );
                }
                return true;
            }
            return false;
        } catch (e) {
            console.error('이미지 교체 실패:', e);
            return false;
        }
    };

    const appendAlbumImage = async (memoryId: string, imageUrl: string): Promise<boolean> => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/memories/${memoryId}/append-image-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl }),
            });
            if (res.ok) {
                const data = await res.json();
                setMemoryList((prev) => prev.map((m) => (m.id === memoryId ? { ...m, imageUrls: data.imageUrls } : m)));
                return true;
            }
            return false;
        } catch (e) {
            console.error('이미지 추가 보관 실패:', e);
            return false;
        }
    };

    const deleteSingleImage = async (memoryId: string, targetImageUrl: string): Promise<boolean> => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/memories/${memoryId}/image`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetImageUrl }),
            });
            if (res.ok) {
                const data = await res.json();
                setMemoryList((prev) =>
                    prev.map((m) =>
                        m.id === memoryId ? { ...m, imageUrls: data.imageUrls, fileNames: data.fileNames } : m,
                    ),
                );
                return true;
            }
            return false;
        } catch (e) {
            console.error('개별 사진 삭제 실패:', e);
            return false;
        }
    };

    const deleteHistoryVersion = async (memoryId: string, version: number): Promise<boolean> => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/memories/${memoryId}/history/${version}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                const data = await res.json();
                setMemoryList((prev) => prev.map((m) => (m.id === memoryId ? { ...m, history: data.history } : m)));
                return true;
            }
            return false;
        } catch (e) {
            console.error('히스토리 삭제 실패:', e);
            return false;
        }
    };

    const deleteMemoryItem = async (id: string): Promise<boolean> => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/memories/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setMemoryList((prev) => prev.filter((m) => m.id !== id));
                return true;
            }
            return false;
        } catch (e) {
            console.error('메모리 삭제 실패:', e);
            return false;
        }
    };

    const deleteMultipleMemoryItems = async (ids: string[]): Promise<boolean> => {
        try {
            for (const id of ids) {
                await fetch(`${BACKEND_URL}/api/memories/${id}`, { method: 'DELETE' });
            }
            setMemoryList((prev) => prev.filter((m) => !ids.includes(m.id)));
            return true;
        } catch (e) {
            console.error('다중 삭제 실패:', e);
            return false;
        }
    };

    const clearAllMemories = async (): Promise<boolean> => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/memories`, { method: 'DELETE' });
            if (res.ok) {
                setMemoryList([]);
                setSelectedEnhanceMemory(null);
                return true;
            }
            return false;
        } catch (e) {
            console.error('전체 삭제 실패:', e);
            return false;
        }
    };

    const appendActiveMemory = (memory: MemoryItem) => {
        setMemoryList((prev) => (prev.some((m) => m.id === memory.id) ? prev : [memory, ...prev]));
    };

    const appendActiveMemories = (memories: MemoryItem[]) => {
        setMemoryList((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const filtered = memories.filter((m) => !existingIds.has(m.id));
            return [...filtered, ...prev];
        });
    };

    const addToGeneratedNotes = (memory: MemoryItem) => {
        setGeneratedNotes((prev) => (prev.some((n) => n.id === memory.id) ? prev : [memory, ...prev]));
    };

    const addMultipleToGeneratedNotes = (memories: MemoryItem[]) => {
        setGeneratedNotes((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            return [...memories.filter((m) => !existingIds.has(m.id)), ...prev];
        });
    };

    const updateGeneratedNote = (id: string, updates: { title: string; story: string }) => {
        setGeneratedNotes((prev) =>
            prev.map((note) => {
                if (note.id !== id) return note;

                return {
                    ...note,
                    analysis: {
                        ...note.analysis,
                        title: updates.title,
                        description: updates.story,
                        storyCaption: updates.story,
                    },
                    generatedNote: note.generatedNote
                        ? {
                              ...note.generatedNote,
                              title: updates.title,
                              opening: '',
                              body: updates.story,
                              closing: '',
                          }
                        : note.generatedNote,
                };
            }),
        );
    };

    const deleteFromGeneratedNotes = (id: string) => {
        setGeneratedNotes((prev) => prev.filter((n) => n.id !== id));
    };

    const deleteMultipleFromGeneratedNotes = (ids: string[]) => {
        setGeneratedNotes((prev) => prev.filter((n) => !ids.includes(n.id)));
    };

    const clearSelectedGenerateMemory = () => {
        setSelectedGenerateMemory(null);
    };

    const createFolder = async (name: string, rootCategory?: '유년시절' | '여행'): Promise<boolean> => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/folders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, rootCategory: rootCategory || '여행' }),
            });
            if (res.ok) {
                await fetchFolders();
                return true;
            }
            return false;
        } catch (e) {
            console.error('폴더 생성 실패:', e);
            return false;
        }
    };

    const moveMemoryToFolder = async (memoryId: string, folderName: string): Promise<boolean> => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/folders/${memoryId}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoryFolder: folderName }),
            });
            if (res.ok) {
                return true;
            }
            return false;
        } catch (e) {
            console.error('폴더 이동 실패:', e);
            return false;
        }
    };

    const batchMoveMemoriesToFolder = async (albumIds: string[], folderName: string): Promise<boolean> => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/folders/batch-move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ albumIds, categoryFolder: folderName }),
            });
            if (res.ok) {
                return true;
            }
            return false;
        } catch (e) {
            console.error('일괄 이동 실패:', e);
            return false;
        }
    };

    return (
        <MemoryContext.Provider
            value={{
                memoryList,
                memories: memoryList,
                selectedEnhanceMemory,
                selectedGenerateMemory,
                folderList,
                categorizedFolders,
                generatedNotes,
                currentMode,
                setCurrentMode,
                fetchMemories,
                fetchFolders,
                setSelectedEnhanceMemory,
                setSelectedGenerateMemory,
                clearSelectedGenerateMemory,
                addMultiImageMemoryToServer,
                appendFilesToMemory,
                updateMemoryItem,
                deleteMemoryItem,
                deleteMultipleMemoryItems,
                clearAllMemories,
                appendActiveMemory,
                appendActiveMemories,
                addToGeneratedNotes,
                addMultipleToGeneratedNotes,
                updateGeneratedNote,
                deleteFromGeneratedNotes,
                deleteMultipleFromGeneratedNotes,
                swapAlbumImage,
                appendAlbumImage,
                deleteSingleImage,
                deleteHistoryVersion,
                createFolder,
                moveMemoryToFolder,
                batchMoveMemoriesToFolder,
            }}
        >
            {children}
        </MemoryContext.Provider>
    );
};

export const useMemory = () => {
    const context = useContext(MemoryContext);
    if (!context) {
        throw new Error('useMemory must be used within a MemoryProvider');
    }
    return context;
};

export default MemoryProvider;
