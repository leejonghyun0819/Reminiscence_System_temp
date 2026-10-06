import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MemoryItem, useMemory } from '../../context/MemoryContext';
import { GenerateTabStrip } from '../../features/generate/GenerateTabStrip';
import { MagazineBookViewer } from '../../features/generate/MagazineBookViewer';
import { NoteGenerationPanel } from '../../features/generate/NoteGenerationPanel';

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
            ? [
                  activeNote.generatedNote.opening,
                  activeNote.generatedNote.body,
                  activeNote.generatedNote.closing,
              ]
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
        const confirmed =
            Platform.OS === 'web' ? window.confirm(`선택한 ${count}개의 노트를 삭제하시겠습니까?`) : true;
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
            <View style={styles.headerBar}>
                <View style={styles.headerLeft}>
                    <View style={styles.titleRow}>
                        <Text style={styles.pageTitle}>📖 AI 추억 노트</Text>
                        <Text style={styles.betaBadge}>BETA</Text>
                    </View>
                    <Text style={styles.pageSubtitle}>
                        완성된 추억 여러 개를 골라 하나의 포토북 이야기로 엮고 미리 볼 수 있습니다.
                    </Text>
                    <Text style={styles.sessionNotice}>생성한 노트는 베타 기간 동안 현재 앱 실행 세션에 보관됩니다.</Text>
                </View>

                <View style={styles.headerRightActions}>
                    <TouchableOpacity
                        style={[styles.createButton, showBuilder && styles.createButtonActive]}
                        onPress={() => setShowBuilder((prev) => !prev)}
                    >
                        <Text style={styles.createButtonText}>{showBuilder ? '선택창 닫기' : '+ 새 노트 만들기'}</Text>
                    </TouchableOpacity>

                    {generatedNotes.length > 0 ? (
                        <>
                            <TouchableOpacity style={styles.selectAllBtn} onPress={handleToggleSelectAll}>
                                <Text style={styles.selectAllBtnText}>
                                    {isAllSelected ? '선택 해제 ✕' : '전체 선택 ✓'}
                                </Text>
                            </TouchableOpacity>

                            {selectedNoteIds.size > 0 ? (
                                <TouchableOpacity style={styles.batchDeleteBtn} onPress={handleBatchDelete}>
                                    <Text style={styles.batchDeleteBtnText}>
                                        {`🗑️ 선택 삭제 (${selectedNoteIds.size}개)`}
                                    </Text>
                                </TouchableOpacity>
                            ) : null}

                            <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
                                <Text style={styles.printBtnText}>🖨️ 인쇄 / PDF 저장</Text>
                            </TouchableOpacity>
                        </>
                    ) : null}
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

            <ScrollView style={styles.mainScrollView} contentContainerStyle={styles.mainContentContainer}>
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
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F6F8FC' },
    headerBar: {
        paddingHorizontal: 28,
        paddingVertical: 18,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
    },
    headerLeft: { flex: 1, minWidth: 280 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pageTitle: { fontSize: 20, fontWeight: '900', color: '#172554' },
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
    pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
    sessionNotice: { fontSize: 11, color: '#94A3B8', marginTop: 3 },
    headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    createButton: { paddingVertical: 9, paddingHorizontal: 15, backgroundColor: '#2563EB', borderRadius: 8 },
    createButtonActive: { backgroundColor: '#475569' },
    createButtonText: { fontSize: 13, color: '#FFFFFF', fontWeight: '800' },
    selectAllBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#F1F5F9',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#CBD5E1',
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
    printBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#0F766E', borderRadius: 8 },
    printBtnText: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
    mainScrollView: { flex: 1 },
    mainContentContainer: { padding: 32, alignItems: 'center' },
    emptyStateBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
    emptyStateIcon: { fontSize: 56, marginBottom: 16 },
    emptyStateTitle: { fontSize: 20, fontWeight: '800', color: '#475569' },
    emptyStateSub: { fontSize: 14, color: '#94A3B8', marginTop: 6, textAlign: 'center', maxWidth: 500 },
});
