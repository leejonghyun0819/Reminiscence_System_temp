// frontend/components/MemoryInterviewModal.tsx
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import {
    buildCuratedMemoryNote,
    CuratedNoteData,
    InterviewAnswerItem,
    InterviewQuestionItem,
} from '../services/geminiService';
import {
    hasMeaningfulMemoryContext,
    MemoryContextData,
    MEMORY_OWNER_LABELS,
    MEMORY_PURPOSE_LABELS,
} from '../types/memoryContext';
import { memoryColors, memoryFontFamily } from '../constants/memoryTheme';

interface FactsAndClues {
    estimatedEra?: string;
    sceneFacts?: string;
    visualClues?: string[];
    memoryContext?: MemoryContextData;
}

interface PreviewImage {
    url: string;
    photoNumber: number;
}

interface MemoryInterviewModalProps {
    visible: boolean;
    onClose: () => void;
    factsAndClues: FactsAndClues;
    questions: InterviewQuestionItem[];
    imageUrls: string[];
    initialAnswers?: Record<string, string>;
    initialExtraStory?: string;
    onComplete: (curatedNote: CuratedNoteData, qaPairs: InterviewAnswerItem[], extraStory: string) => void;
}

function getValidPhotoIndexes(question: InterviewQuestionItem, imageUrls: string[]): number[] {
    const rawIndexes = Array.isArray(question.targetPhotoIndexes) ? question.targetPhotoIndexes : [];

    return Array.from(
        new Set(
            rawIndexes.filter(
                (photoIndex) => Number.isInteger(photoIndex) && photoIndex >= 1 && photoIndex <= imageUrls.length,
            ),
        ),
    );
}

export function MemoryInterviewModal({
    visible,
    onClose,
    factsAndClues,
    questions = [],
    imageUrls = [],
    initialAnswers = {},
    initialExtraStory = '',
    onComplete,
}: MemoryInterviewModalProps) {
    const { width } = useWindowDimensions();
    const isCompact = width < 900;
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [extraStory, setExtraStory] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusText, setStatusText] = useState<string>('');
    const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);

    useEffect(() => {
        if (visible) {
            setAnswers(initialAnswers || {});
            setExtraStory(initialExtraStory || '');
            setIsSubmitting(false);
            setStatusText('');
            setPreviewImage(null);
        }
    }, [visible, initialAnswers, initialExtraStory]);

    const handleOptionSelect = (questionId: string, option: string) => {
        setAnswers((previous) => ({
            ...previous,
            [questionId]: option,
        }));
    };

    const handleTextChange = (questionId: string, text: string) => {
        setAnswers((previous) => ({
            ...previous,
            [questionId]: text,
        }));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setStatusText('✍️ 사진별 답변을 바탕으로 추억 노트를 작성 중입니다...');

        try {
            const qaPairs: InterviewAnswerItem[] = questions.map((question) => {
                const targetPhotoIndexes = getValidPhotoIndexes(question, imageUrls);

                return {
                    id: question.id,
                    category: question.category,
                    targetClue: question.targetClue,
                    targetPhotoIndexes,
                    targetImageUrls: targetPhotoIndexes.map((photoIndex) => imageUrls[photoIndex - 1]),
                    question: question.question,
                    answer: answers[question.id]?.trim() || '기억 안 남',
                };
            });

            if (extraStory.trim()) {
                qaPairs.push({
                    id: 'extra_memory',
                    category: '자유 회상',
                    targetClue: '',
                    targetPhotoIndexes: [],
                    targetImageUrls: [],
                    question: '추가 사연',
                    answer: extraStory.trim(),
                });
            }

            const curatedNote = await buildCuratedMemoryNote(
                {
                    estimatedEra: factsAndClues.estimatedEra || '시기 미상',
                    sceneFacts: factsAndClues.sceneFacts || '',
                    visualClues: factsAndClues.visualClues || [],
                    memoryContext: factsAndClues.memoryContext || {},
                },
                qaPairs,
            );

            setStatusText('✨ 추억 노트 완성! 적용 중...');
            onComplete(curatedNote, qaPairs, extraStory);
        } catch (error: any) {
            Alert.alert('재분석 오류', error?.message || '답변을 반영하는 중 문제가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
            setStatusText('');
        }
    };

    if (!visible) return null;

    return (
        <>
            <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
                <View style={[styles.overlay, isCompact && styles.overlayCompact]}>
                    <View style={styles.container}>
                        <View style={styles.header}>
                            <View style={styles.headerTextArea}>
                                <Text style={styles.headerTitle}>사진을 보며, 떠오르는 기억을 들려주세요</Text>
                                <Text style={styles.headerSubtitle}>
                                    입력한 단서와 사진별 질문을 함께 확인합니다. 기억나지 않는 답변은 비워도 됩니다.
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={onClose}
                                disabled={isSubmitting}
                                accessibilityRole="button"
                                accessibilityLabel="인터뷰 닫기"
                            >
                                <Text style={styles.closeButtonText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.workspace, isCompact && styles.workspaceCompact]}>
                            <View style={[styles.photoPanel, isCompact && styles.photoPanelCompact]}>
                                <Text style={styles.photoPanelTitle}>연결된 사진</Text>
                                <ScrollView
                                    style={styles.photoPanelScroll}
                                    contentContainerStyle={styles.photoPanelGrid}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {imageUrls.map((imageUrl, index) => (
                                        <TouchableOpacity
                                            key={`${imageUrl}-${index}`}
                                            style={[styles.photoPanelItem, index === 0 && styles.photoPanelItemPrimary]}
                                            onPress={() =>
                                                setPreviewImage({
                                                    url: imageUrl,
                                                    photoNumber: index + 1,
                                                })
                                            }
                                            activeOpacity={0.82}
                                        >
                                            <Image source={{ uri: imageUrl }} style={styles.photoPanelImage} />
                                            <View style={styles.photoPanelNumberBadge}>
                                                <Text style={styles.photoPanelNumberText}>사진 {index + 1}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <View style={styles.clueSummary}>
                                    <Text style={styles.clueSummaryTitle}>사진 속 단서</Text>
                                    <Text style={styles.clueSummaryText} numberOfLines={3}>
                                        {(factsAndClues.visualClues || []).join(' · ') ||
                                            factsAndClues.sceneFacts ||
                                            '사진별 단서를 질문에서 확인할 수 있어요.'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.questionPane}>
                                <ScrollView
                                    style={styles.body}
                                    contentContainerStyle={styles.bodyContent}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {hasMeaningfulMemoryContext(factsAndClues.memoryContext) && (
                                        <View style={styles.contextBlock}>
                                            <Text style={styles.contextTitle}>먼저 제공한 기억의 단서</Text>
                                            <Text style={styles.contextGuide}>
                                                아래 내용은 AI가 사진을 해석하고 질문할 때 우선 참고한 정보입니다.
                                            </Text>
                                            <View style={styles.contextRows}>
                                                {factsAndClues.memoryContext?.memoryOwner && (
                                                    <Text style={styles.contextRowText}>
                                                        <Text style={styles.contextRowLabel}>기억 주인 · </Text>
                                                        {MEMORY_OWNER_LABELS[factsAndClues.memoryContext.memoryOwner]}
                                                    </Text>
                                                )}
                                                {factsAndClues.memoryContext?.purpose && (
                                                    <Text style={styles.contextRowText}>
                                                        <Text style={styles.contextRowLabel}>기록 목적 · </Text>
                                                        {MEMORY_PURPOSE_LABELS[factsAndClues.memoryContext.purpose]}
                                                    </Text>
                                                )}
                                                {factsAndClues.memoryContext?.approximateTime ? (
                                                    <Text style={styles.contextRowText}>
                                                        <Text style={styles.contextRowLabel}>시기 · </Text>
                                                        {factsAndClues.memoryContext.approximateTime}
                                                    </Text>
                                                ) : null}
                                                {factsAndClues.memoryContext?.placeHint ? (
                                                    <Text style={styles.contextRowText}>
                                                        <Text style={styles.contextRowLabel}>장소 · </Text>
                                                        {factsAndClues.memoryContext.placeHint}
                                                    </Text>
                                                ) : null}
                                                {factsAndClues.memoryContext?.peopleHint ? (
                                                    <Text style={styles.contextRowText}>
                                                        <Text style={styles.contextRowLabel}>사람 · </Text>
                                                        {factsAndClues.memoryContext.peopleHint}
                                                    </Text>
                                                ) : null}
                                                {factsAndClues.memoryContext?.additionalContext ? (
                                                    <Text style={styles.contextRowText}>
                                                        <Text style={styles.contextRowLabel}>추가 단서 · </Text>
                                                        {factsAndClues.memoryContext.additionalContext}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        </View>
                                    )}

                                    {questions.length === 0 && (
                                        <View style={styles.emptyBlock}>
                                            <Text style={styles.emptyText}>
                                                생성된 질문이 없습니다. 잠시 후 다시 시도해주세요.
                                            </Text>
                                        </View>
                                    )}

                                    {questions.map((question, questionIndex) => {
                                        const currentAnswer = answers[question.id] || '';
                                        const targetPhotoIndexes = getValidPhotoIndexes(question, imageUrls);
                                        const photoLabel = targetPhotoIndexes
                                            .map((photoIndex) => '사진 ' + photoIndex)
                                            .join(', ');

                                        return (
                                            <View
                                                key={question.id || String(questionIndex)}
                                                style={styles.questionBlock}
                                            >
                                                <View style={styles.badgeRow}>
                                                    <View style={styles.categoryBadge}>
                                                        <Text style={styles.categoryBadgeText}>
                                                            {question.category || '기억의 단서'}
                                                        </Text>
                                                    </View>
                                                    {targetPhotoIndexes.length > 0 && (
                                                        <View style={styles.photoBadge}>
                                                            <Text style={styles.photoBadgeText}>📷 {photoLabel}</Text>
                                                        </View>
                                                    )}
                                                </View>

                                                {question.targetClue ? (
                                                    <Text style={styles.targetClueText}>
                                                        살펴볼 단서 · {question.targetClue}
                                                    </Text>
                                                ) : null}

                                                {targetPhotoIndexes.length > 0 && (
                                                    <View style={styles.photoSection}>
                                                        <Text style={styles.photoGuideText}>
                                                            사진을 누르면 크게 볼 수 있어요
                                                        </Text>
                                                        <ScrollView
                                                            horizontal
                                                            showsHorizontalScrollIndicator={false}
                                                            contentContainerStyle={styles.photoStrip}
                                                        >
                                                            {targetPhotoIndexes.map((photoIndex) => {
                                                                const imageUrl = imageUrls[photoIndex - 1];

                                                                return (
                                                                    <TouchableOpacity
                                                                        key={photoIndex}
                                                                        style={styles.thumbnailButton}
                                                                        activeOpacity={0.82}
                                                                        onPress={() =>
                                                                            setPreviewImage({
                                                                                url: imageUrl,
                                                                                photoNumber: photoIndex,
                                                                            })
                                                                        }
                                                                        disabled={isSubmitting}
                                                                        accessibilityRole="button"
                                                                        accessibilityLabel={
                                                                            '사진 ' + photoIndex + ' 크게 보기'
                                                                        }
                                                                    >
                                                                        <Image
                                                                            source={{ uri: imageUrl }}
                                                                            style={styles.thumbnail}
                                                                            resizeMode="cover"
                                                                        />
                                                                        <View style={styles.thumbnailNumber}>
                                                                            <Text style={styles.thumbnailNumberText}>
                                                                                {photoIndex}
                                                                            </Text>
                                                                        </View>
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </ScrollView>
                                                    </View>
                                                )}

                                                <Text style={styles.questionText}>
                                                    {questionIndex + 1}. {question.question}
                                                </Text>

                                                {question.quickOptions && question.quickOptions.length > 0 && (
                                                    <View style={styles.optionsRow}>
                                                        {question.quickOptions.map((option, optionIndex) => {
                                                            const isSelected = currentAnswer === option;

                                                            return (
                                                                <TouchableOpacity
                                                                    key={option + String(optionIndex)}
                                                                    style={[
                                                                        styles.optionChip,
                                                                        isSelected && styles.optionChipActive,
                                                                    ]}
                                                                    onPress={() =>
                                                                        handleOptionSelect(question.id, option)
                                                                    }
                                                                    disabled={isSubmitting}
                                                                >
                                                                    <Text
                                                                        style={[
                                                                            styles.optionChipText,
                                                                            isSelected && styles.optionChipTextActive,
                                                                        ]}
                                                                    >
                                                                        {option}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                )}

                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="사진을 보며 떠오른 기억을 직접 적어주세요."
                                                    placeholderTextColor="#94A3B8"
                                                    value={currentAnswer}
                                                    onChangeText={(text) => handleTextChange(question.id, text)}
                                                    editable={!isSubmitting}
                                                />
                                            </View>
                                        );
                                    })}

                                    <View style={styles.questionBlock}>
                                        <View style={styles.freeRecallBadge}>
                                            <Text style={styles.freeRecallBadgeText}>자유 회상</Text>
                                        </View>
                                        <Text style={styles.questionText}>
                                            {questions.length + 1}. 그 외에 떠오르는 사연이나 꼭 남기고 싶은 이야기가
                                            있다면 자유롭게 적어주세요.
                                        </Text>
                                        <TextInput
                                            style={[styles.input, styles.multilineInput]}
                                            placeholder="예: 이 사진을 찍고 나서 가족과 함께 식사했던 기억이 나요."
                                            placeholderTextColor="#94A3B8"
                                            value={extraStory}
                                            onChangeText={setExtraStory}
                                            multiline
                                            editable={!isSubmitting}
                                        />
                                    </View>
                                </ScrollView>

                                <View style={styles.footer}>
                                    {isSubmitting && (
                                        <View style={styles.statusRow}>
                                            <ActivityIndicator size="small" color="#0284C7" />
                                            <Text style={styles.statusText}>{statusText}</Text>
                                        </View>
                                    )}

                                    <View style={styles.buttonRow}>
                                        <TouchableOpacity
                                            style={styles.cancelButton}
                                            onPress={onClose}
                                            disabled={isSubmitting}
                                        >
                                            <Text style={styles.cancelButtonText}>취소</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                                            onPress={handleSubmit}
                                            disabled={isSubmitting || questions.length === 0}
                                        >
                                            {isSubmitting ? (
                                                <View style={styles.loadingInner}>
                                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                                    <Text style={styles.submitButtonText}>노트 작성 중...</Text>
                                                </View>
                                            ) : (
                                                <Text style={styles.submitButtonText}>답변으로 추억 완성하기</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={previewImage !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setPreviewImage(null)}
            >
                <View style={styles.previewOverlay}>
                    <TouchableOpacity
                        style={styles.previewBackdrop}
                        activeOpacity={1}
                        onPress={() => setPreviewImage(null)}
                        accessibilityRole="button"
                        accessibilityLabel="사진 확대 보기 닫기"
                    />
                    <View style={styles.previewCard}>
                        <View style={styles.previewHeader}>
                            <Text style={styles.previewTitle}>사진 {previewImage?.photoNumber}</Text>
                            <TouchableOpacity style={styles.previewCloseButton} onPress={() => setPreviewImage(null)}>
                                <Text style={styles.previewCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        {previewImage && (
                            <Image
                                source={{ uri: previewImage.url }}
                                style={styles.previewImage}
                                resizeMode="contain"
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: memoryColors.canvas,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 28,
    },
    overlayCompact: { paddingHorizontal: 16, paddingVertical: 20 },
    container: {
        width: '100%',
        maxWidth: 1360,
        height: '100%',
        backgroundColor: memoryColors.canvas,
        flexDirection: 'column',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingBottom: 20,
        marginBottom: 0,
    },
    headerTextArea: {
        flex: 1,
        paddingRight: 16,
    },
    headerTitle: {
        fontSize: 28,
        lineHeight: 40,
        fontWeight: '700',
        color: memoryColors.text,
        fontFamily: memoryFontFamily,
    },
    headerSubtitle: {
        fontSize: 14,
        lineHeight: 24,
        color: memoryColors.textMuted,
        marginTop: 2,
        fontFamily: memoryFontFamily,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: memoryColors.subtle,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 14,
        fontWeight: '800',
        color: memoryColors.textMuted,
    },
    workspace: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 24,
        minHeight: 0,
    },
    workspaceCompact: { flexDirection: 'column' },
    photoPanel: {
        width: 380,
        flexShrink: 0,
        minHeight: 0,
        padding: 24,
        backgroundColor: memoryColors.surface,
        borderWidth: 1,
        borderColor: memoryColors.border,
        borderRadius: 16,
    },
    photoPanelCompact: { width: '100%', maxHeight: 300 },
    photoPanelTitle: {
        color: memoryColors.text,
        fontSize: 20,
        lineHeight: 30,
        fontWeight: '700',
        fontFamily: memoryFontFamily,
        marginBottom: 16,
    },
    photoPanelScroll: { flex: 1, minHeight: 120 },
    photoPanelGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        paddingBottom: 16,
    },
    photoPanelItem: {
        width: 154,
        height: 116,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: memoryColors.brandLight,
        position: 'relative',
    },
    photoPanelItemPrimary: { width: '100%', height: 250 },
    photoPanelImage: { width: '100%', height: '100%' },
    photoPanelNumberBadge: {
        position: 'absolute',
        left: 10,
        bottom: 10,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
    },
    photoPanelNumberText: {
        color: memoryColors.brand,
        fontSize: 12,
        fontWeight: '700',
    },
    clueSummary: {
        borderTopWidth: 1,
        borderTopColor: memoryColors.border,
        paddingTop: 16,
    },
    clueSummaryTitle: {
        color: memoryColors.text,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 6,
    },
    clueSummaryText: {
        color: memoryColors.textMuted,
        fontSize: 12,
        lineHeight: 20,
    },
    questionPane: { flex: 1, minWidth: 0, minHeight: 0 },
    body: {
        flex: 1,
    },
    bodyContent: {
        paddingRight: 2,
        paddingBottom: 8,
    },
    emptyBlock: {
        padding: 20,
        borderRadius: 12,
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#FED7AA',
        marginBottom: 18,
    },
    emptyText: {
        color: '#9A3412',
        fontSize: 13,
        fontWeight: '600',
    },
    contextBlock: {
        padding: 24,
        borderRadius: 16,
        backgroundColor: memoryColors.brandLight,
        borderWidth: 1,
        borderColor: memoryColors.brandBorder,
        marginBottom: 16,
    },
    contextTitle: {
        color: memoryColors.brand,
        fontSize: 14,
        fontWeight: '700',
    },
    contextGuide: {
        color: memoryColors.textMuted,
        fontSize: 12,
        lineHeight: 20,
        marginTop: 3,
        marginBottom: 9,
    },
    contextRows: {
        gap: 5,
    },
    contextRowText: {
        color: '#334155',
        fontSize: 12,
        lineHeight: 18,
    },
    contextRowLabel: {
        color: '#0369A1',
        fontWeight: '700',
    },
    questionBlock: {
        marginBottom: 16,
        backgroundColor: memoryColors.surface,
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: memoryColors.border,
    },
    badgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 7,
        marginBottom: 8,
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        backgroundColor: memoryColors.brandLight,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    categoryBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: memoryColors.brand,
    },
    photoBadge: {
        alignSelf: 'flex-start',
        backgroundColor: memoryColors.subtle,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 6,
    },
    photoBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: memoryColors.textSecondary,
    },
    freeRecallBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 9,
    },
    freeRecallBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#B45309',
    },
    targetClueText: {
        color: '#64748B',
        fontSize: 12,
        lineHeight: 18,
        marginBottom: 10,
    },
    photoSection: {
        marginBottom: 14,
    },
    photoGuideText: {
        fontSize: 11,
        color: '#64748B',
        marginBottom: 7,
    },
    photoStrip: {
        gap: 9,
        paddingRight: 2,
    },
    thumbnailButton: {
        width: 128,
        height: 92,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#E2E8F0',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    thumbnailNumber: {
        position: 'absolute',
        top: 7,
        left: 7,
        minWidth: 25,
        height: 25,
        borderRadius: 13,
        paddingHorizontal: 7,
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    thumbnailNumberText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    questionText: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '700',
        color: memoryColors.text,
        marginBottom: 12,
    },
    optionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    optionChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 17,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: memoryColors.border,
    },
    optionChipActive: {
        backgroundColor: memoryColors.brandLight,
        borderColor: memoryColors.brandBorder,
    },
    optionChipText: {
        fontSize: 12,
        color: memoryColors.textSecondary,
        fontWeight: '600',
    },
    optionChipTextActive: {
        color: memoryColors.brand,
        fontWeight: '700',
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: memoryColors.border,
        borderRadius: 9,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: '#0F172A',
    },
    multilineInput: {
        height: 84,
        textAlignVertical: 'top',
    },
    footer: {
        paddingTop: 8,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 10,
        backgroundColor: '#F0F9FF',
        paddingVertical: 7,
        borderRadius: 7,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0369A1',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 10,
        alignItems: 'center',
    },
    cancelButton: {
        minWidth: 120,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: memoryColors.surface,
        borderWidth: 1,
        borderColor: memoryColors.border,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: memoryColors.textSecondary,
    },
    submitButton: {
        backgroundColor: memoryColors.brand,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 8,
        minWidth: 260,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitButtonDisabled: {
        backgroundColor: '#7DD3FC',
    },
    submitButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    loadingInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    previewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    previewBackdrop: {
        ...StyleSheet.absoluteFill,
    },
    previewCard: {
        width: '100%',
        maxWidth: 960,
        height: '88%',
        backgroundColor: '#0F172A',
        borderRadius: 16,
        overflow: 'hidden',
    },
    previewHeader: {
        height: 52,
        paddingHorizontal: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    previewTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    previewCloseButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewCloseText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    previewImage: {
        flex: 1,
        width: '100%',
        backgroundColor: '#020617',
    },
});

export default MemoryInterviewModal;
