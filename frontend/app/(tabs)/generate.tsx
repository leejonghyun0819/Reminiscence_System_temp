import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MemoryItem, useMemory } from '../../context/MemoryContext';
import { GenerateTabStrip } from '../../features/generate/GenerateTabStrip';
import { MagazineBookViewer } from '../../features/generate/MagazineBookViewer';
import { NoteGenerationPanel } from '../../features/generate/NoteGenerationPanel';
import { MemoryAppHeader } from '../../components/MemoryAppHeader';
import { MemoryPageHeader } from '../../components/MemoryPageHeader';
import { memoryColors, memoryLayout } from '../../constants/memoryTheme';

export default function GenerateScreen() {
    const {
        memoryList,
        generatedNotes,
        selectedGenerateMemory,
        clearSelectedGenerateMemory,
        addToGeneratedNotes,
        updateGeneratedNote,
        deleteFromGeneratedNotes,
        deleteMultipleFromGeneratedNotes,
        updateMemoryItem,
    } = useMemory();

    const [activeNote, setActiveNote] = useState<MemoryItem | null>(null);
    const [activePhotoIdx, setActivePhotoIdx] = useState(0);
    const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
    const [showBuilder, setShowBuilder] = useState(generatedNotes.length === 0);

    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editStory, setEditStory] = useState('');

    useEffect(() => {
        if (selectedGenerateMemory) {
            setActiveNote(selectedGenerateMemory);
            setActivePhotoIdx(0);
            clearSelectedGenerateMemory();
        } else if (!activeNote && generatedNotes.length > 0) {
            setActiveNote(generatedNotes[0]);
            setActivePhotoIdx(0);
        }
    }, [selectedGenerateMemory, generatedNotes, activeNote, clearSelectedGenerateMemory]);

    useEffect(() => {
        if (!activeNote) return;

        const generatedStory = activeNote.generatedNote
            ? [activeNote.generatedNote.opening, activeNote.generatedNote.body, activeNote.generatedNote.closing]
                  .filter(Boolean)
                  .join('\n\n')
            : activeNote.analysis?.storyCaption || activeNote.analysis?.description || '';

        setEditTitle(activeNote.analysis?.title || '');
        setEditStory(generatedStory);
        setIsEditing(false);
        setActivePhotoIdx(0);
    }, [activeNote]);

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const targetTag = (document.activeElement?.tagName || '').toLowerCase();
            if (targetTag === 'input' || targetTag === 'textarea') return;

            if (activeNote?.imageUrls?.length) {
                const total = activeNote.imageUrls.length;
                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    setActivePhotoIdx((prev) => (prev + 1 < total ? prev + 1 : 0));
                } else if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    setActivePhotoIdx((prev) => (prev - 1 >= 0 ? prev - 1 : total - 1));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeNote]);

    const handleGenerated = (note: MemoryItem) => {
        addToGeneratedNotes(note);
        setActiveNote(note);
        setActivePhotoIdx(0);
        setShowBuilder(false);
    };

    const toggleSelectNote = (id: string, event?: any) => {
        event?.stopPropagation?.();
        setSelectedNoteIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleToggleSelectAll = () => {
        const isAll = generatedNotes.length > 0 && generatedNotes.every((item) => selectedNoteIds.has(item.id));
        setSelectedNoteIds(isAll ? new Set() : new Set(generatedNotes.map((item) => item.id)));
    };

    const handleBatchDelete = () => {
        if (selectedNoteIds.size === 0) return;

        const count = selectedNoteIds.size;
        const confirmed = Platform.OS === 'web' ? window.confirm(`선택한 ${count}개의 노트를 삭제하시겠습니까?`) : true;
        if (!confirmed) return;

        deleteMultipleFromGeneratedNotes(Array.from(selectedNoteIds));
        if (activeNote && selectedNoteIds.has(activeNote.id)) {
            const remaining = generatedNotes.filter((note) => !selectedNoteIds.has(note.id));
            setActiveNote(remaining[0] || null);
        }
        setSelectedNoteIds(new Set());
    };

    const handleDeleteSingle = (id: string, event?: any) => {
        event?.stopPropagation?.();
        deleteFromGeneratedNotes(id);

        if (activeNote?.id === id) {
            const remaining = generatedNotes.filter((note) => note.id !== id);
            setActiveNote(remaining[0] || null);
        }

        setSelectedNoteIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const handleSaveEdit = async () => {
        if (!activeNote) return;

        if (activeNote.generatedNote) {
            updateGeneratedNote(activeNote.id, {
                title: editTitle,
                story: editStory,
            });

            setActiveNote((prev) =>
                prev
                    ? {
                          ...prev,
                          analysis: {
                              ...prev.analysis,
                              title: editTitle,
                              description: editStory,
                              storyCaption: editStory,
                          },
                          generatedNote: prev.generatedNote
                              ? {
                                    ...prev.generatedNote,
                                    title: editTitle,
                                    opening: '',
                                    body: editStory,
                                    closing: '',
                                }
                              : prev.generatedNote,
                      }
                    : null,
            );
        } else {
            await updateMemoryItem(activeNote.id, {
                title: editTitle,
                storyCaption: editStory,
            });
            setActiveNote((prev) =>
                prev
                    ? {
                          ...prev,
                          analysis: {
                              ...prev.analysis,
                              title: editTitle,
                              storyCaption: editStory,
                          },
                      }
                    : null,
            );
        }

        setIsEditing(false);
    };

    const handlePrint = () => {
        if (Platform.OS === 'web') window.print();
    };

    const isAllSelected = generatedNotes.length > 0 && generatedNotes.every((item) => selectedNoteIds.has(item.id));

    return (
        <View style={styles.container}>
            <MemoryAppHeader />
            <ScrollView style={styles.pageScroll} contentContainerStyle={styles.pageScrollContent}>
                <View style={styles.pageShell}>
                    <View style={styles.headerBar}>
                        <MemoryPageHeader
                            title={
                                showBuilder
                                    ? '완성된 추억들을 한 권의 이야기로 엮으세요'
                                    : '내 기억으로 완성한 추억 노트'
                            }
                            subtitle={
                                showBuilder
                                    ? 'AI 추억 노트 · 사진 분석과 인터뷰 답변을 바탕으로 포토북 이야기를 만듭니다.'
                                    : '완성된 노트의 제목과 이야기를 다듬고 인쇄하거나 PDF로 남기세요.'
                            }
                        />

                        <View style={styles.headerRightActions}>
                            <TouchableOpacity
                                style={[styles.createButton, showBuilder && styles.createButtonActive]}
                                onPress={() => setShowBuilder((prev) => !prev)}
                            >
                                <Text style={styles.createButtonText}>
                                    {showBuilder ? '선택창 닫기' : '+ 새 노트 만들기'}
                                </Text>
                            </TouchableOpacity>

                            {generatedNotes.length > 0 ? (
                                <>
                                    <TouchableOpacity style={styles.selectAllBtn} onPress={handleToggleSelectAll}>
                                        <Text style={styles.selectAllBtnText}>
                                            {isAllSelected ? '선택 해제' : '전체 선택'}
                                        </Text>
                                    </TouchableOpacity>

                                    {selectedNoteIds.size > 0 ? (
                                        <TouchableOpacity style={styles.batchDeleteBtn} onPress={handleBatchDelete}>
                                            <Text style={styles.batchDeleteBtnText}>
                                                {`선택 삭제 (${selectedNoteIds.size}개)`}
                                            </Text>
                                        </TouchableOpacity>
                                    ) : null}

                                    <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
                                        <Text style={styles.printBtnText}>인쇄 / PDF</Text>
                                    </TouchableOpacity>
                                </>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.betaNotice}>
                        <Text style={styles.betaBadge}>BETA</Text>
                        <View style={styles.betaNoticeCopy}>
                            <Text style={styles.betaNoticeTitle}>
                                생성한 노트는 베타 기간 동안 현재 앱 실행 세션에 보관됩니다.
                            </Text>
                            <Text style={styles.sessionNotice}>원본 추억은 백업 보관함에서 관리합니다.</Text>
                        </View>
                    </View>

                    {showBuilder ? (
                        <NoteGenerationPanel
                            memories={memoryList}
                            onGenerated={handleGenerated}
                            onCancel={() => setShowBuilder(false)}
                        />
                    ) : null}

                    <GenerateTabStrip
                        generatedNotes={generatedNotes}
                        activeNoteId={activeNote?.id}
                        selectedNoteIds={selectedNoteIds}
                        onSelectNote={(note) => {
                            setActiveNote(note);
                            setActivePhotoIdx(0);
                        }}
                        onToggleCheck={toggleSelectNote}
                        onDeleteNote={handleDeleteSingle}
                    />

                    <View style={styles.mainContentContainer}>
                        {activeNote ? (
                            <MagazineBookViewer
                                note={activeNote}
                                activePhotoIdx={activePhotoIdx}
                                setActivePhotoIdx={setActivePhotoIdx}
                                isEditing={isEditing}
                                setIsEditing={setIsEditing}
                                editTitle={editTitle}
                                setEditTitle={setEditTitle}
                                editStory={editStory}
                                setEditStory={setEditStory}
                                onSaveEdit={handleSaveEdit}
                            />
                        ) : (
                            <View style={styles.emptyStateBox}>
                                <Text style={styles.emptyStateIcon}>📖</Text>
                                <Text style={styles.emptyStateTitle}>아직 생성된 노트가 없습니다</Text>
                                <Text style={styles.emptyStateSub}>
                                    ‘새 노트 만들기’에서 기존 추억을 선택하면 AI가 한 편의 이야기로 엮어줍니다.
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: memoryColors.canvas },
    pageScroll: { flex: 1 },
    pageScrollContent: { paddingBottom: 64 },
    pageShell: {
        width: '100%',
        maxWidth: 1440,
        alignSelf: 'center',
        paddingHorizontal: memoryLayout.desktopPadding,
        paddingTop: 28,
    },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 20,
    },
    betaBadge: {
        fontSize: 12,
        fontWeight: '700',
        color: memoryColors.brand,
        backgroundColor: memoryColors.brandLight,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
        overflow: 'hidden',
    },
    betaNotice: {
        minHeight: 80,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 18,
        backgroundColor: memoryColors.brandLight,
        borderWidth: 1,
        borderColor: memoryColors.brandBorder,
        borderRadius: 16,
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    betaNoticeCopy: { flex: 1 },
    betaNoticeTitle: {
        fontSize: 13,
        lineHeight: 20,
        color: memoryColors.textSecondary,
        fontWeight: '500',
    },
    sessionNotice: {
        fontSize: 12,
        lineHeight: 20,
        color: memoryColors.textMuted,
        marginTop: 2,
    },
    headerRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        paddingTop: 4,
    },
    createButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: memoryColors.brand,
        borderRadius: 8,
    },
    createButtonActive: { backgroundColor: memoryColors.textSecondary },
    createButtonText: {
        fontSize: 13,
        color: memoryColors.surface,
        fontWeight: '700',
    },
    selectAllBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: memoryColors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: memoryColors.border,
    },
    selectAllBtnText: { fontSize: 13, color: '#475569', fontWeight: '700' },
    batchDeleteBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },
    batchDeleteBtnText: { fontSize: 13, color: '#DC2626', fontWeight: '700' },
    printBtn: {
        paddingVertical: 9,
        paddingHorizontal: 16,
        backgroundColor: memoryColors.surface,
        borderWidth: 1,
        borderColor: memoryColors.border,
        borderRadius: 8,
    },
    printBtnText: {
        fontSize: 13,
        color: memoryColors.textSecondary,
        fontWeight: '700',
    },
    mainContentContainer: { paddingTop: 16, alignItems: 'center' },
    emptyStateBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
    },
    emptyStateIcon: { fontSize: 56, marginBottom: 16 },
    emptyStateTitle: { fontSize: 20, fontWeight: '800', color: '#475569' },
    emptyStateSub: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 6,
        textAlign: 'center',
        maxWidth: 500,
    },
});
