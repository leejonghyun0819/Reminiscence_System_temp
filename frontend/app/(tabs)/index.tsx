// frontend/app/(tabs)/index.tsx
import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
    Alert,
    Platform,
    useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemory, MemoryItem } from '../../context/MemoryContext';
import {
    generateMemoryInterview,
    generateInterviewFromExistingAlbum,
    detectMemoryMode,
    InterviewAnswerItem,
    InterviewResponseData,
    CuratedNoteData,
} from '../../services/geminiService';
import { MemoryInterviewModal } from '../../components/MemoryInterviewModal';
import { MemoryContextForm } from '../../components/MemoryContextForm';
import { DEFAULT_MEMORY_CONTEXT, MemoryContextData } from '../../types/memoryContext';
import { DroppableAlbumCard } from '../../features/index/DroppableAlbumCard';
import { GalleryViewerModal } from '../../features/index/GalleryViewerModal';
import { EditMemoryModal } from '../../features/index/EditMemoryModal';
import { MemoryAppHeader } from '../../components/MemoryAppHeader';
import { MemoryPageHeader } from '../../components/MemoryPageHeader';
import { memoryColors, memoryFontFamily, memoryLayout } from '../../constants/memoryTheme';

export default function IndexScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isNarrow = width < 920;
    const {
        memoryList,
        folderList,
        addMultiImageMemoryToServer,
        appendFilesToMemory,
        updateMemoryItem,
        deleteMemoryItem,
        selectedEnhanceMemory,
        setSelectedEnhanceMemory,
    } = useMemory();

    const [selectedImages, setSelectedImages] = useState<any[]>([]);
    const [selectedAudio, setSelectedAudio] = useState<any | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<string>('미분류');
    const [memoryContext, setMemoryContext] = useState<MemoryContextData>({
        ...DEFAULT_MEMORY_CONTEXT,
    });
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    // 인터뷰 모달 상태
    const [interviewModalVisible, setInterviewModalVisible] = useState<boolean>(false);
    const [interviewData, setInterviewData] = useState<InterviewResponseData | null>(null);
    const [activeEditingMemory, setActiveEditingMemory] = useState<MemoryItem | null>(null);
    const [initialAnswers, setInitialAnswers] = useState<Record<string, string>>({});
    const [initialExtraStory, setInitialExtraStory] = useState<string>('');

    // 미디어 갤러리 뷰어 및 상세 편집 모달 상태
    const [viewingGalleryAlbum, setViewingGalleryAlbum] = useState<MemoryItem | null>(null);
    const [editingAlbum, setEditingAlbum] = useState<MemoryItem | null>(null);

    // 홈 화면 다중 선택 상태 (홈에서 없애기용)
    const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(new Set());

    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const audioInputRef = useRef<HTMLInputElement | null>(null);

    // 파일 객체 배열을 Base64 에셋으로 변환
    const convertFilesToAssets = async (files: File[]) => {
        const imageFiles = files.filter((f) => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return [];

        return await Promise.all(
            imageFiles.map(async (file: File) => {
                return new Promise<any>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        resolve({
                            file,
                            name: file.name,
                            uri: reader.result as string,
                            base64: (reader.result as string).split(',')[1],
                            mimeType: file.type || 'image/jpeg',
                        });
                    };
                    reader.readAsDataURL(file);
                });
            }),
        );
    };

    const handlePickImages = async () => {
        if (Platform.OS === 'web') {
            imageInputRef.current?.click();
            return;
        }
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
            base64: true,
        });
        if (!result.canceled && result.assets) {
            setSelectedImages((prev) => [...prev, ...result.assets]);
        }
    };

    const handleWebImageChange = async (e: any) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const converted = await convertFilesToAssets(Array.from(files));
        setSelectedImages((prev) => [...prev, ...converted]);
        e.target.value = '';
    };

    // 🌟 신규 등록 카드에 드롭되었을 때 실행되는 함수
    const handleDropFilesOnNewUploadCard = async (_targetItem: any, files: File[]) => {
        const converted = await convertFilesToAssets(files);
        if (converted.length > 0) {
            setSelectedImages((prev) => [...prev, ...converted]);
        } else {
            Alert.alert('안내', '이미지 파일(JPG, PNG, WEBP 등)만 등록 가능합니다.');
        }
    };

    // 기존 개별 앨범 카드에 드롭되었을 때 실행되는 함수
    const handleDropFilesOnAlbum = async (targetItem: MemoryItem, files: File[]) => {
        const imageFiles = files.filter((f) => f.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            Alert.alert('안내', '이미지 파일만 추가 가능합니다.');
            return;
        }
        setIsProcessing(true);
        setStatusMessage('사진 추가 보관 중...');
        try {
            const ok = await appendFilesToMemory(targetItem.id, imageFiles);
            if (ok) {
                Alert.alert('완료', `${imageFiles.length}장의 사진이 추가되었습니다.`);
            }
        } finally {
            setIsProcessing(false);
            setStatusMessage('');
        }
    };

    const handlePickAudio = () => {
        if (Platform.OS === 'web') {
            audioInputRef.current?.click();
        } else {
            Alert.alert('알림', '음성 파일 첨부는 웹 환경에서 지원됩니다.');
        }
    };

    const handleWebAudioChange = (e: any) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            setSelectedAudio({
                file,
                name: file.name,
                uri: reader.result as string,
                base64: (reader.result as string).split(',')[1],
                mimeType: file.type || 'audio/mp3',
            });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // AI 모드 분석 및 신규 등록 처리
    const handleStartProcess = async () => {
        if (selectedImages.length === 0) {
            Alert.alert('안내', '사진을 1장 이상 등록해주세요.');
            return;
        }

        setIsProcessing(true);
        try {
            const imagePayload = selectedImages.map((image) => ({
                base64: image.base64,
                mimeType: image.mimeType || 'image/jpeg',
            }));

            setStatusMessage('사진과 입력한 기억의 단서를 함께 분석 중입니다...');
            const modeDetection = await detectMemoryMode(imagePayload);
            const detectedMode = modeDetection.mode;

            setStatusMessage(
                detectedMode === 'childhood'
                    ? '유년 시절 사진의 구체적인 기억 질문을 구성 중입니다...'
                    : '여행 사진의 장소와 순간을 되짚는 질문을 구성 중입니다...',
            );

            const interviewResult = await generateMemoryInterview(
                imagePayload,
                modeDetection.photoAnalyses,
                detectedMode,
                memoryContext,
            );

            setActiveEditingMemory(null);
            setInitialAnswers({});
            setInitialExtraStory('');
            setInterviewData({
                ...interviewResult,
                detectedMode,
                memoryContext: interviewResult.memoryContext || memoryContext,
            });
            setInterviewModalVisible(true);
        } catch (error: any) {
            Alert.alert('실패', error?.message || '사진별 기억 질문을 만드는 중 문제가 발생했습니다.');
        } finally {
            setIsProcessing(false);
            setStatusMessage('');
        }
    };

    // 기존 앨범 인터뷰 수정/재분석
    const handleOpenInterviewForExistingAlbum = async (item: MemoryItem) => {
        setIsProcessing(true);
        setStatusMessage('과거 사진의 단서를 전수 조사하여 기억 질문을 구성하는 중...');
        setActiveEditingMemory(item);

        try {
            const interviewRes = await generateInterviewFromExistingAlbum(
                item.id,
                item.imageUrls,
                item.interviewData?.memoryContext,
            );

            const prevAnswers: Record<string, string> = {};
            let prevExtra = '';
            if (item.interviewData && Array.isArray(item.interviewData.questions)) {
                item.interviewData.questions.forEach((q: any) => {
                    if (q.id === 'extra_memory') {
                        prevExtra = q.answer || '';
                    } else if (q.id) {
                        prevAnswers[q.id] = q.answer || '';
                    }
                });
            }

            setInterviewData(interviewRes);
            setInitialAnswers(prevAnswers);
            setInitialExtraStory(prevExtra);
            setInterviewModalVisible(true);
        } catch (err: any) {
            Alert.alert('인터뷰 분석 오류', err.message || '사진을 분석하지 못했습니다.');
        } finally {
            setIsProcessing(false);
            setStatusMessage('');
        }
    };

    // 인터뷰 결과 큐레이션 완료 저장
    const handleInterviewComplete = async (
        curatedNote: CuratedNoteData,
        qaPairs: InterviewAnswerItem[],
        _extraStory: string,
    ) => {
        if (!interviewData) return;
        setIsProcessing(true);
        setStatusMessage('인터뷰 답변을 바탕으로 추억 노트를 갱신 중...');

        const finalMode = interviewData.detectedMode || activeEditingMemory?.mode || 'childhood';

        try {
            const updatedInterviewData = {
                estimatedEra: interviewData.estimatedEra,
                sceneFacts: interviewData.sceneFacts,
                visualClues: interviewData.visualClues,
                questions: qaPairs,
                memoryContext: interviewData.memoryContext || {},
            };

            if (activeEditingMemory) {
                await updateMemoryItem(activeEditingMemory.id, {
                    title: curatedNote.title,
                    description: curatedNote.sceneDescription,
                    storyCaption: `${curatedNote.remembered}\n\n${curatedNote.reflection}`,
                    mode: finalMode,
                    curatedNote: curatedNote,
                    // @ts-ignore
                    interviewData: updatedInterviewData,
                });

                Alert.alert(
                    '재분석 완료',
                    `수정된 인터뷰 내용을 반영하여 [${finalMode === 'travel' ? '✈️ 여행' : '🧸 유년시절'}] 추억 노트가 다시 작성되었습니다.`,
                );
            } else {
                const payload = {
                    mode: finalMode,
                    curatedNote,
                    interviewData: updatedInterviewData,
                    analysis: {
                        title: curatedNote.title,
                        location: interviewData.sceneFacts.slice(0, 30),
                        yearEstimate: interviewData.estimatedEra,
                        description: curatedNote.sceneDescription,
                        storyCaption: `${curatedNote.remembered}\n\n${curatedNote.reflection}`,
                    },
                };
                await addMultiImageMemoryToServer(selectedImages, selectedAudio, payload, selectedFolder);
                setSelectedImages([]);
                setSelectedAudio(null);
                setMemoryContext({ ...DEFAULT_MEMORY_CONTEXT });
                Alert.alert(
                    '완료',
                    `${finalMode === 'travel' ? '✈️ 여행' : '🧸 유년시절'} 추억 노트가 완성되었습니다.`,
                );
            }

            setInterviewModalVisible(false);
            setInterviewData(null);
            setActiveEditingMemory(null);
            setInitialAnswers({});
            setInitialExtraStory('');
        } catch (err: any) {
            Alert.alert('저장 실패', err.message || '저장 오류');
        } finally {
            setIsProcessing(false);
            setStatusMessage('');
        }
    };

    const handleRemoveSingleFromHome = (id: string, title?: string) => {
        const ok =
            Platform.OS === 'web'
                ? window.confirm(
                      `'${title || '이 추억'}'을(를) 홈 작업 화면에서 없애시겠습니까?\n(추억 보관함에는 안전하게 유지됩니다.)`,
                  )
                : true;
        if (!ok) return;

        deleteMemoryItem(id);
        setSelectedAlbumIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const handleBatchRemoveFromHome = () => {
        if (selectedAlbumIds.size === 0) return;
        const count = selectedAlbumIds.size;
        const ok =
            Platform.OS === 'web'
                ? window.confirm(
                      `선택한 ${count}개의 앨범을 홈 작업 목록에서 없애시겠습니까?\n(추억 보관함에는 안전하게 보존됩니다.)`,
                  )
                : true;
        if (!ok) return;

        selectedAlbumIds.forEach((id) => {
            deleteMemoryItem(id);
        });
        setSelectedAlbumIds(new Set());
        Alert.alert('완료', `${count}개의 앨범이 홈 화면에서 정리되었습니다.`);
    };

    const isAllSelected = memoryList.length > 0 && memoryList.every((item) => selectedAlbumIds.has(item.id));

    return (
        <View style={styles.container}>
            {Platform.OS === 'web' && (
                <>
                    <input
                        type="file"
                        ref={imageInputRef}
                        style={{ display: 'none' }}
                        multiple
                        accept="image/*"
                        onChange={handleWebImageChange}
                    />
                    <input
                        type="file"
                        ref={audioInputRef}
                        style={{ display: 'none' }}
                        accept="audio/*"
                        onChange={handleWebAudioChange}
                    />
                </>
            )}

            <MemoryAppHeader />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={[styles.pageShell, isNarrow && styles.pageShellNarrow]}>
                    <MemoryPageHeader
                        title="사진 속 순간에, 나의 기억을 더하세요"
                        subtitle="사진과 기억의 단서를 바탕으로 AI가 질문하고, 확인된 답변으로 추억 노트를 만듭니다."
                    />

                    <View style={[styles.uploadWorkspace, isNarrow && styles.uploadWorkspaceNarrow]}>
                        <View style={[styles.uploadColumn, isNarrow && styles.fullWidthColumn]}>
                            <DroppableAlbumCard
                                item={{ id: 'new_upload_card', fileNames: [], imageUrls: [] }}
                                onDropFiles={handleDropFilesOnNewUploadCard}
                            >
                                <View style={styles.cardHeaderRow}>
                                    <Text style={styles.cardTitle}>새 추억 사진 등록</Text>
                                </View>

                                <View style={styles.largeDropZone}>
                                    {selectedImages.length === 0 ? (
                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            style={styles.dropZoneEmptyClickable}
                                            onPress={handlePickImages}
                                        >
                                            <Text style={styles.dropZoneIcon}>＋</Text>
                                            <Text style={styles.dropZonePrimaryText}>사진을 끌어놓거나 선택하세요</Text>
                                            <Text style={styles.dropZoneSubText}>앨범 사진 표시 영역</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={styles.previewGridContainer}>
                                            {selectedImages.map((img, idx) => (
                                                <View key={idx} style={styles.previewGridItem}>
                                                    <Image source={{ uri: img.uri }} style={styles.previewGridImage} />
                                                    <TouchableOpacity
                                                        style={styles.removeBadge}
                                                        onPress={() =>
                                                            setSelectedImages((prev) =>
                                                                prev.filter((_, i) => i !== idx),
                                                            )
                                                        }
                                                    >
                                                        <Text style={styles.removeBadgeText}>✕</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                            <TouchableOpacity style={styles.addMoreGridBtn} onPress={handlePickImages}>
                                                <Text style={styles.addMoreGridIcon}>＋</Text>
                                                <Text style={styles.addMoreGridText}>사진 추가</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                <Text style={styles.fileTypeHint}>JPG · PNG · WEBP / 여러 장 선택 가능</Text>
                                <TouchableOpacity style={styles.fileSelectBtn} onPress={handlePickImages}>
                                    <Text style={styles.fileSelectBtnText}>사진 선택</Text>
                                </TouchableOpacity>

                                <View style={styles.optionRow}>
                                    {selectedAudio ? (
                                        <View style={styles.audioChip}>
                                            <Text style={styles.audioChipText}>🎤 {selectedAudio.name}</Text>
                                            <TouchableOpacity onPress={() => setSelectedAudio(null)}>
                                                <Text style={styles.audioRemoveText}>✕</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity style={styles.audioAddBtn} onPress={handlePickAudio}>
                                            <Text style={styles.audioAddBtnText}>음성 파일 첨부 · 선택</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <Text style={styles.folderLabel}>보관 폴더</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.folderRow}
                                >
                                    {folderList.map((f) => (
                                        <TouchableOpacity
                                            key={f}
                                            style={[styles.folderChip, selectedFolder === f && styles.folderChipActive]}
                                            onPress={() => setSelectedFolder(f)}
                                        >
                                            <Text
                                                style={[
                                                    styles.folderChipText,
                                                    selectedFolder === f && styles.folderChipTextActive,
                                                ]}
                                            >
                                                {f}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </DroppableAlbumCard>
                        </View>

                        <View style={[styles.contextCard, isNarrow && styles.fullWidthColumn]}>
                            <MemoryContextForm
                                value={memoryContext}
                                onChange={setMemoryContext}
                                disabled={isProcessing}
                            />

                            <TouchableOpacity
                                style={[
                                    styles.actionSubmitBtn,
                                    (isProcessing || selectedImages.length === 0) && styles.actionSubmitBtnDisabled,
                                ]}
                                onPress={handleStartProcess}
                                disabled={isProcessing || selectedImages.length === 0}
                            >
                                {isProcessing ? (
                                    <View style={styles.loadingRow}>
                                        <ActivityIndicator color="#fff" size="small" />
                                        <Text style={styles.actionSubmitBtnText}>{statusMessage || '분석 중...'}</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.actionSubmitBtnText}>
                                        {selectedImages.length > 0
                                            ? `${selectedImages.length}장의 사진으로 AI 기억 인터뷰 시작`
                                            : 'AI 기억 인터뷰 시작'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* 현재 작업 중인 앨범 카드 목록 섹션 */}
                    <View style={styles.albumSection}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>현재 작업 목록 ({memoryList.length})</Text>

                            {memoryList.length > 0 && (
                                <View style={styles.toolbarGroup}>
                                    <TouchableOpacity
                                        style={styles.selectToggleBtn}
                                        onPress={() => {
                                            if (isAllSelected) setSelectedAlbumIds(new Set());
                                            else setSelectedAlbumIds(new Set(memoryList.map((m) => m.id)));
                                        }}
                                    >
                                        <Text style={styles.selectToggleBtnText}>
                                            {isAllSelected ? '전체 해제' : '전체 선택'}
                                        </Text>
                                    </TouchableOpacity>

                                    {selectedAlbumIds.size > 0 && (
                                        <TouchableOpacity
                                            style={styles.batchRemoveBtn}
                                            onPress={handleBatchRemoveFromHome}
                                        >
                                            <Text style={styles.batchRemoveBtnText}>
                                                {`✕ 홈에서 없애기 (${selectedAlbumIds.size})`}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>

                        {memoryList.length === 0 ? (
                            <View style={styles.emptyBox}>
                                <Text style={styles.emptyText}>현재 작업 중인 추억 앨범이 없습니다.</Text>
                                <Text style={[styles.emptyText, { fontSize: 11, marginTop: 4, color: '#94a3b8' }]}>
                                    새 사진을 등록하거나 보관함 탭에서 앨범을 복원해보세요.
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.albumGrid}>
                                {memoryList.map((item) => {
                                    const isSelected = selectedAlbumIds.has(item.id);

                                    return (
                                        <View key={item.id} style={styles.albumItemOuter}>
                                            <DroppableAlbumCard
                                                item={item}
                                                isSelected={selectedEnhanceMemory?.id === item.id}
                                                onDropFiles={handleDropFilesOnAlbum}
                                            >
                                                <View style={styles.albumHeaderRow}>
                                                    <View style={styles.leftMetaGroup}>
                                                        <TouchableOpacity
                                                            style={[
                                                                styles.checkbox,
                                                                isSelected && styles.checkboxActive,
                                                            ]}
                                                            onPress={() => {
                                                                setSelectedAlbumIds((prev) => {
                                                                    const next = new Set(prev);
                                                                    if (next.has(item.id)) next.delete(item.id);
                                                                    else next.add(item.id);
                                                                    return next;
                                                                });
                                                            }}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.checkmark,
                                                                    isSelected && styles.checkmarkActive,
                                                                ]}
                                                            >
                                                                {isSelected ? '✓' : ''}
                                                            </Text>
                                                        </TouchableOpacity>

                                                        <View style={styles.badgeGroup}>
                                                            <Text
                                                                style={[
                                                                    styles.modeBadge,
                                                                    item.mode === 'travel' && styles.modeBadgeTravel,
                                                                ]}
                                                            >
                                                                {item.mode === 'travel'
                                                                    ? '✈️ 여행'
                                                                    : item.mode === 'childhood'
                                                                      ? '🧸 유년시절'
                                                                      : '❓ 분류 미정'}
                                                            </Text>
                                                            <Text style={styles.categoryBadge}>
                                                                {item.categoryFolder || '미분류'}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    <View style={styles.cardActions}>
                                                        <TouchableOpacity
                                                            style={[styles.miniBtn, styles.galleryBtn]}
                                                            onPress={() => setViewingGalleryAlbum(item)}
                                                        >
                                                            <Text style={styles.galleryBtnText}>🖼️ 사진 관리</Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={[styles.miniBtn, styles.editDetailBtn]}
                                                            onPress={() => setEditingAlbum(item)}
                                                        >
                                                            <Text style={styles.editDetailBtnText}>✏️ 상세 편집</Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={[styles.miniBtn, styles.interviewBtn]}
                                                            onPress={() => handleOpenInterviewForExistingAlbum(item)}
                                                        >
                                                            <Text style={styles.interviewBtnText}>
                                                                💬 인터뷰 수정/재분석
                                                            </Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={styles.miniBtn}
                                                            onPress={() => {
                                                                setSelectedEnhanceMemory(item);
                                                                router.push('/(tabs)/enhance');
                                                            }}
                                                        >
                                                            <Text style={styles.miniBtnText}>🎨 화질 복원</Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={[styles.miniBtn, styles.deleteBtn]}
                                                            onPress={() =>
                                                                handleRemoveSingleFromHome(
                                                                    item.id,
                                                                    item.curatedNote?.title || item.analysis?.title,
                                                                )
                                                            }
                                                        >
                                                            <Text style={[styles.miniBtnText, { color: '#ef4444' }]}>
                                                                ✕ 홈에서 없애기
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>

                                                <Text style={styles.albumTitle}>
                                                    {item.curatedNote?.title || item.analysis?.title || '추억의 순간'}
                                                </Text>

                                                <ScrollView
                                                    horizontal
                                                    showsHorizontalScrollIndicator={false}
                                                    style={styles.thumbStrip}
                                                >
                                                    {item.imageUrls?.map((url, i) => (
                                                        <TouchableOpacity
                                                            key={i}
                                                            activeOpacity={0.8}
                                                            onPress={() => setViewingGalleryAlbum(item)}
                                                        >
                                                            <Image
                                                                source={{ uri: url }}
                                                                style={styles.albumThumbImage}
                                                            />
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>

                                                <Text style={styles.albumDesc} numberOfLines={3}>
                                                    {item.curatedNote
                                                        ? `[그날의 장면] ${item.curatedNote.sceneDescription}\n[나의 기억] ${item.curatedNote.remembered}`
                                                        : item.analysis?.description ||
                                                          item.analysis?.storyCaption ||
                                                          '내용 없음'}
                                                </Text>
                                            </DroppableAlbumCard>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* 인터뷰 모달 */}
            {interviewData && (
                <MemoryInterviewModal
                    visible={interviewModalVisible}
                    onClose={() => {
                        setInterviewModalVisible(false);
                        setInterviewData(null);
                        setActiveEditingMemory(null);
                    }}
                    factsAndClues={{
                        estimatedEra: interviewData.estimatedEra,
                        sceneFacts: interviewData.sceneFacts,
                        visualClues: interviewData.visualClues,
                        memoryContext: interviewData.memoryContext,
                    }}
                    questions={interviewData.interviewQuestions}
                    imageUrls={
                        activeEditingMemory
                            ? activeEditingMemory.imageUrls
                            : selectedImages.map((image) => image.uri).filter((uri): uri is string => Boolean(uri))
                    }
                    initialAnswers={initialAnswers}
                    initialExtraStory={initialExtraStory}
                    onComplete={handleInterviewComplete}
                />
            )}

            {/* 미디어 갤러리 조회 및 사진 삭제 모달 */}
            <GalleryViewerModal
                visible={viewingGalleryAlbum !== null}
                album={viewingGalleryAlbum}
                onClose={() => setViewingGalleryAlbum(null)}
            />

            {/* 추억 정보 상세 편집 모달 */}
            <EditMemoryModal
                visible={editingAlbum !== null}
                album={editingAlbum}
                onClose={() => setEditingAlbum(null)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: memoryColors.canvas },
    scrollContent: { paddingBottom: 64 },
    pageShell: {
        width: '100%',
        maxWidth: 1440,
        alignSelf: 'center',
        paddingHorizontal: memoryLayout.desktopPadding,
        paddingTop: 28,
    },
    pageShellNarrow: {
        paddingHorizontal: memoryLayout.mobilePadding,
        paddingTop: 22,
    },
    uploadWorkspace: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 24,
        marginBottom: 24,
    },
    uploadWorkspaceNarrow: { flexDirection: 'column' },
    uploadColumn: { width: 420, flexShrink: 0 },
    fullWidthColumn: { width: '100%' },
    contextCard: {
        flex: 1,
        minWidth: 0,
        backgroundColor: memoryColors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: memoryColors.border,
        padding: 24,
    },
    cardHeaderRow: { marginBottom: 16 },
    cardTitle: {
        fontSize: 20,
        lineHeight: 30,
        fontWeight: '700',
        color: memoryColors.text,
        fontFamily: memoryFontFamily,
    },
    largeDropZone: {
        minHeight: 200,
        borderRadius: 12,
        backgroundColor: memoryColors.brandLight,
        padding: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    dropZoneEmptyClickable: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 168,
    },
    dropZoneIcon: { fontSize: 22, color: memoryColors.brand, marginBottom: 8 },
    dropZonePrimaryText: {
        fontSize: 14,
        lineHeight: 24,
        fontWeight: '700',
        color: memoryColors.brand,
        marginBottom: 4,
        fontFamily: memoryFontFamily,
    },
    dropZoneSubText: {
        fontSize: 12,
        lineHeight: 20,
        color: memoryColors.textMuted,
        fontFamily: memoryFontFamily,
    },
    previewGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        width: '100%',
    },
    previewGridItem: {
        width: 90,
        height: 90,
        borderRadius: 10,
        position: 'relative',
        borderWidth: 1,
        borderColor: memoryColors.border,
    },
    previewGridImage: { width: '100%', height: '100%', borderRadius: 10 },
    removeBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: memoryColors.danger,
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        borderWidth: 1.5,
        borderColor: memoryColors.surface,
    },
    removeBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    addMoreGridBtn: {
        width: 90,
        height: 90,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: memoryColors.textFaint,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: memoryColors.surface,
    },
    addMoreGridIcon: { fontSize: 24, color: memoryColors.textMuted },
    addMoreGridText: {
        fontSize: 11,
        color: memoryColors.textMuted,
        fontWeight: '600',
        marginTop: 2,
    },
    fileTypeHint: {
        fontSize: 12,
        lineHeight: 20,
        color: memoryColors.textMuted,
        marginBottom: 12,
        fontFamily: memoryFontFamily,
    },
    fileSelectBtn: {
        minHeight: 40,
        borderWidth: 1,
        borderColor: memoryColors.border,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        backgroundColor: memoryColors.surface,
    },
    fileSelectBtnText: {
        fontSize: 13,
        color: memoryColors.textSecondary,
        fontWeight: '500',
    },
    optionRow: { marginBottom: 16 },
    audioChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: memoryColors.brandLight,
        minHeight: 40,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    audioChipText: { fontSize: 12, color: memoryColors.brandDark },
    audioRemoveText: {
        color: memoryColors.danger,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    audioAddBtn: {
        minHeight: 40,
        borderWidth: 1,
        borderColor: memoryColors.border,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: memoryColors.surface,
    },
    audioAddBtnText: {
        fontSize: 12,
        color: memoryColors.textSecondary,
        fontWeight: '500',
    },
    folderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 8,
    },
    folderLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: memoryColors.textSecondary,
    },
    folderChip: {
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: memoryColors.subtle,
    },
    folderChipActive: { backgroundColor: memoryColors.brandLight },
    folderChipText: { fontSize: 12, color: memoryColors.textSecondary },
    folderChipTextActive: { color: memoryColors.brand, fontWeight: '700' },
    actionSubmitBtn: {
        width: 260,
        maxWidth: '100%',
        backgroundColor: memoryColors.brand,
        paddingVertical: 13,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
    },
    actionSubmitBtnDisabled: { backgroundColor: memoryColors.textFaint },
    actionSubmitBtnText: {
        color: memoryColors.surface,
        fontWeight: '700',
        fontSize: 14,
    },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    albumSection: { marginTop: 2 },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
        flexWrap: 'wrap',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 20,
        lineHeight: 30,
        fontWeight: '700',
        color: memoryColors.text,
    },
    toolbarGroup: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    selectToggleBtn: {
        backgroundColor: memoryColors.surface,
        borderWidth: 1,
        borderColor: memoryColors.border,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    selectToggleBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: memoryColors.textSecondary,
    },
    batchRemoveBtn: {
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    batchRemoveBtnText: { fontSize: 11, fontWeight: '700', color: '#dc2626' },
    emptyBox: {
        backgroundColor: memoryColors.surface,
        padding: 24,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: memoryColors.border,
    },
    emptyText: { fontSize: 13, color: memoryColors.textFaint },
    albumGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    albumItemOuter: { flexGrow: 1, flexBasis: 400, minWidth: 300, maxWidth: 664 },
    albumHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        flexWrap: 'wrap',
        gap: 8,
    },
    leftMetaGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: memoryColors.textFaint,
        backgroundColor: memoryColors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxActive: {
        backgroundColor: memoryColors.brand,
        borderColor: memoryColors.brand,
    },
    checkmark: { fontSize: 11, color: 'transparent', fontWeight: 'bold' },
    checkmarkActive: { color: '#fff' },
    badgeGroup: { flexDirection: 'row', gap: 6 },
    modeBadge: {
        fontSize: 11,
        fontWeight: '700',
        color: '#9a3412',
        backgroundColor: '#ffedd5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    modeBadgeTravel: {
        color: memoryColors.brandDark,
        backgroundColor: memoryColors.brandLight,
    },
    categoryBadge: {
        fontSize: 11,
        color: memoryColors.textSecondary,
        backgroundColor: memoryColors.subtle,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    cardActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    miniBtn: {
        paddingVertical: 6,
        paddingHorizontal: 9,
        borderRadius: 6,
        backgroundColor: memoryColors.subtle,
    },
    galleryBtn: {
        backgroundColor: memoryColors.surface,
        borderWidth: 1,
        borderColor: memoryColors.border,
    },
    galleryBtnText: {
        fontSize: 11,
        color: memoryColors.textSecondary,
        fontWeight: '700',
    },
    editDetailBtn: {
        backgroundColor: memoryColors.brandLight,
        borderWidth: 1,
        borderColor: memoryColors.brandBorder,
    },
    editDetailBtnText: {
        fontSize: 11,
        color: memoryColors.brand,
        fontWeight: '700',
    },
    interviewBtn: {
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    interviewBtnText: { fontSize: 11, color: '#1d4ed8', fontWeight: '700' },
    deleteBtn: { backgroundColor: memoryColors.dangerLight },
    miniBtnText: {
        fontSize: 11,
        color: memoryColors.textSecondary,
        fontWeight: '600',
    },
    albumTitle: {
        fontSize: 16,
        lineHeight: 24,
        color: memoryColors.text,
        fontWeight: '700',
        marginBottom: 8,
    },
    thumbStrip: { flexDirection: 'row', marginBottom: 8 },
    albumThumbImage: {
        width: 76,
        height: 64,
        borderRadius: 8,
        marginRight: 8,
        backgroundColor: memoryColors.border,
    },
    albumDesc: { fontSize: 13, color: memoryColors.textMuted, lineHeight: 20 },
});
