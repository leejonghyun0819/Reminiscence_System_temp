import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { MemoryItem } from '../../context/MemoryContext';
import {
    GeneratedNoteSourceItem,
    GeneratedNoteStyle,
    generateMemoryBookNote,
} from '../../services/geminiService';

interface NoteGenerationPanelProps {
    memories: MemoryItem[];
    onGenerated: (note: MemoryItem) => void;
    onCancel: () => void;
}

const MAX_SELECTED_MEMORIES = 6;

function limitText(value: string | undefined, maxLength: number): string {
    return (value || '').trim().slice(0, maxLength);
}

export const NoteGenerationPanel: React.FC<NoteGenerationPanelProps> = ({
    memories,
    onGenerated,
    onCancel,
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [style, setStyle] = useState<GeneratedNoteStyle>('warm');
    const [isGenerating, setIsGenerating] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const selectedMemories = useMemo(
        () => memories.filter((memory) => selectedIds.has(memory.id)),
        [memories, selectedIds],
    );

    const toggleMemory = (memoryId: string) => {
        setErrorMessage('');
        setSelectedIds((prev) => {
            const next = new Set(prev);

            if (next.has(memoryId)) {
                next.delete(memoryId);
                return next;
            }

            if (next.size >= MAX_SELECTED_MEMORIES) {
                setErrorMessage(`베타 버전에서는 최대 ${MAX_SELECTED_MEMORIES}개의 추억을 선택할 수 있습니다.`);
                return prev;
            }

            next.add(memoryId);
            return next;
        });
    };

    const handleGenerate = async () => {
        if (selectedMemories.length === 0) {
            setErrorMessage('노트에 담을 추억을 한 개 이상 선택해주세요.');
            return;
        }

        setIsGenerating(true);
        setErrorMessage('');

        try {
            const sources: GeneratedNoteSourceItem[] = selectedMemories.map((memory) => ({
                id: memory.id,
                mode: memory.mode,
                title: limitText(memory.curatedNote?.title || memory.analysis?.title, 240),
                location: limitText(memory.analysis?.location, 320),
                yearEstimate: limitText(memory.analysis?.yearEstimate, 240),
                categoryFolder: limitText(memory.categoryFolder, 160),
                sceneDescription: limitText(
                    memory.curatedNote?.sceneDescription || memory.analysis?.description,
                    4000,
                ),
                remembered: limitText(
                    memory.curatedNote?.remembered || memory.analysis?.storyCaption,
                    6000,
                ),
                unremembered: limitText(memory.curatedNote?.unremembered, 3000),
                reflection: limitText(memory.curatedNote?.reflection, 4000),
                interviewAnswers: (memory.interviewData?.questions || [])
                    .filter((item) => item.answer?.trim())
                    .slice(0, 30)
                    .map((item) =>
                        limitText(`${item.question}\n답변: ${item.answer}`, 1200),
                    ),
            }));

            const generated = await generateMemoryBookNote(sources, style);
            const imageUrls = Array.from(
                new Set(selectedMemories.flatMap((memory) => memory.imageUrls || []).filter(Boolean)),
            );
            const fileNames = Array.from(
                new Set(selectedMemories.flatMap((memory) => memory.fileNames || []).filter(Boolean)),
            );
            const modeValues = Array.from(
                new Set(selectedMemories.map((memory) => memory.mode).filter(Boolean)),
            );
            const rootValues = Array.from(
                new Set(selectedMemories.map((memory) => memory.rootCategory).filter(Boolean)),
            );
            const fullStory = [generated.opening, generated.body, generated.closing]
                .filter(Boolean)
                .join('\n\n');

            const note: MemoryItem = {
                id: `generated-note-${Date.now()}`,
                mode: modeValues.length === 1 ? modeValues[0] : undefined,
                rootCategory: rootValues.length === 1 ? rootValues[0] : undefined,
                fileNames,
                imageUrls,
                categoryFolder: 'AI 생성 노트',
                createdAt: Date.now(),
                analysis: {
                    title: generated.title,
                    location: generated.placeSummary,
                    yearEstimate: generated.periodSummary,
                    description: generated.opening,
                    storyCaption: fullStory,
                },
                generatedNote: generated,
            };

            onGenerated(note);
        } catch (error: any) {
            setErrorMessage(error?.message || '노트를 생성하는 중 오류가 발생했습니다.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <View style={styles.panel}>
            <View style={styles.panelHeader}>
                <View style={styles.headerCopy}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>새 AI 추억 노트 만들기</Text>
                        <Text style={styles.betaBadge}>BETA</Text>
                    </View>
                    <Text style={styles.description}>
                        인터뷰와 사진 분석이 끝난 추억들을 골라 한 편의 포토북 이야기로 엮습니다.
                    </Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={onCancel} disabled={isGenerating}>
                    <Text style={styles.closeButtonText}>닫기</Text>
                </TouchableOpacity>
            </View>

            {memories.length === 0 ? (
                <View style={styles.noMemoryBox}>
                    <Text style={styles.noMemoryTitle}>아직 선택할 수 있는 추억이 없습니다.</Text>
                    <Text style={styles.noMemoryDescription}>
                        추억 수집 탭에서 사진 인터뷰를 완료한 후 다시 시도해주세요.
                    </Text>
                </View>
            ) : (
                <>
                    <Text style={styles.sectionLabel}>
                        1. 노트에 담을 추억 선택 · 최대 {MAX_SELECTED_MEMORIES}개
                    </Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.memoryList}
                    >
                        {memories.map((memory) => {
                            const isSelected = selectedIds.has(memory.id);
                            const title = memory.curatedNote?.title || memory.analysis?.title || '제목 없는 추억';

                            return (
                                <TouchableOpacity
                                    key={memory.id}
                                    style={[styles.memoryCard, isSelected && styles.memoryCardSelected]}
                                    onPress={() => toggleMemory(memory.id)}
                                    activeOpacity={0.8}
                                >
                                    {memory.imageUrls?.[0] ? (
                                        <Image source={{ uri: memory.imageUrls[0] }} style={styles.thumbnail} />
                                    ) : (
                                        <View style={[styles.thumbnail, styles.thumbnailFallback]}>
                                            <Text style={styles.thumbnailFallbackText}>📷</Text>
                                        </View>
                                    )}
                                    <View style={styles.memoryCopy}>
                                        <Text style={styles.memoryTitle} numberOfLines={2}>
                                            {title}
                                        </Text>
                                        <Text style={styles.memoryMeta} numberOfLines={1}>
                                            {memory.mode === 'travel' ? '✈️ 여행' : '🧸 유년시절'}
                                            {' · '}
                                            {memory.imageUrls?.length || 0}장
                                        </Text>
                                    </View>
                                    <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                                        <Text style={styles.checkText}>{isSelected ? '✓' : ''}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <Text style={styles.sectionLabel}>2. 글의 분위기</Text>
                    <View style={styles.styleOptions}>
                        <TouchableOpacity
                            style={[styles.styleCard, style === 'warm' && styles.styleCardActive]}
                            onPress={() => setStyle('warm')}
                            disabled={isGenerating}
                        >
                            <Text style={styles.styleTitle}>🌿 따뜻한 에세이</Text>
                            <Text style={styles.styleDescription}>기억의 장면과 여운을 차분하게 연결합니다.</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.styleCard, style === 'documentary' && styles.styleCardActive]}
                            onPress={() => setStyle('documentary')}
                            disabled={isGenerating}
                        >
                            <Text style={styles.styleTitle}>🗂️ 기록 중심</Text>
                            <Text style={styles.styleDescription}>시기와 장소, 사건을 중심으로 담백하게 정리합니다.</Text>
                        </TouchableOpacity>
                    </View>

                    {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                    <View style={styles.footer}>
                        <Text style={styles.selectionText}>{selectedMemories.length}개 선택됨</Text>
                        <TouchableOpacity
                            style={[
                                styles.generateButton,
                                (selectedMemories.length === 0 || isGenerating) && styles.generateButtonDisabled,
                            ]}
                            onPress={handleGenerate}
                            disabled={selectedMemories.length === 0 || isGenerating}
                        >
                            {isGenerating ? (
                                <View style={styles.loadingRow}>
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                    <Text style={styles.generateButtonText}>노트를 엮는 중...</Text>
                                </View>
                            ) : (
                                <Text style={styles.generateButtonText}>✨ AI 노트 생성하기</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    panel: {
        marginHorizontal: 24,
        marginTop: 18,
        padding: 22,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#BFDBFE',
        shadowColor: '#1E3A8A',
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 5 },
    },
    panelHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20,
    },
    headerCopy: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    title: { fontSize: 19, fontWeight: '900', color: '#172554' },
    betaBadge: {
        fontSize: 10,
        fontWeight: '900',
        color: '#1D4ED8',
        backgroundColor: '#DBEAFE',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 999,
        overflow: 'hidden',
    },
    description: { marginTop: 5, fontSize: 13, lineHeight: 19, color: '#64748B' },
    closeButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#F1F5F9' },
    closeButtonText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    sectionLabel: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 9 },
    memoryList: { gap: 10, paddingBottom: 18 },
    memoryCard: {
        width: 245,
        minHeight: 82,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    memoryCardSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
    thumbnail: { width: 62, height: 62, borderRadius: 8, backgroundColor: '#E2E8F0' },
    thumbnailFallback: { alignItems: 'center', justifyContent: 'center' },
    thumbnailFallbackText: { fontSize: 22 },
    memoryCopy: { flex: 1, gap: 6 },
    memoryTitle: { fontSize: 13, lineHeight: 18, fontWeight: '800', color: '#1E293B' },
    memoryMeta: { fontSize: 11, color: '#64748B' },
    checkCircle: {
        width: 21,
        height: 21,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: '#94A3B8',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    checkCircleSelected: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
    checkText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
    styleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    styleCard: {
        flexGrow: 1,
        flexBasis: 240,
        padding: 13,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
    },
    styleCardActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
    styleTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
    styleDescription: { marginTop: 4, fontSize: 11, lineHeight: 17, color: '#64748B' },
    errorText: { marginBottom: 12, fontSize: 12, color: '#DC2626', fontWeight: '700' },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
    },
    selectionText: { fontSize: 12, color: '#475569', fontWeight: '700' },
    generateButton: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 9, backgroundColor: '#2563EB' },
    generateButtonDisabled: { backgroundColor: '#94A3B8' },
    generateButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    noMemoryBox: { paddingVertical: 26, alignItems: 'center' },
    noMemoryTitle: { fontSize: 15, fontWeight: '800', color: '#475569' },
    noMemoryDescription: { marginTop: 5, fontSize: 12, color: '#94A3B8', textAlign: 'center' },
});
