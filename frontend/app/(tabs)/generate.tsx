// frontend/app/(tabs)/generate.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useMemory, MemoryItem } from '../../context/MemoryContext';
import { GenerateTabStrip } from '../../features/generate/GenerateTabStrip';
import { MagazineBookViewer } from '../../features/generate/MagazineBookViewer';

export default function GenerateScreen() {
    const {
        generatedNotes,
        selectedGenerateMemory,
        clearSelectedGenerateMemory,
        deleteFromGeneratedNotes,
        deleteMultipleFromGeneratedNotes,
        updateMemoryItem,
    } = useMemory();

    const [activeNote, setActiveNote] = useState<MemoryItem | null>(null);
    const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
    const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());

    // 편집 모드 상태
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [editTitle, setEditTitle] = useState<string>('');
    const [editLocation, setEditLocation] = useState<string>('');
    const [editYear, setEditYear] = useState<string>('');
    const [editStory, setEditStory] = useState<string>('');

    useEffect(() => {
        if (selectedGenerateMemory) {
            setActiveNote(selectedGenerateMemory);
            setActivePhotoIdx(0);
            clearSelectedGenerateMemory();
        } else if (!activeNote && generatedNotes.length > 0) {
            setActiveNote(generatedNotes[0]);
            setActivePhotoIdx(0);
        }
    }, [selectedGenerateMemory, generatedNotes]);

    useEffect(() => {
        if (activeNote && activeNote.analysis) {
            setEditTitle(activeNote.analysis.title || '');
            setEditLocation(activeNote.analysis.location || '');
            setEditYear(activeNote.analysis.yearEstimate || '');
            setEditStory(activeNote.analysis.storyCaption || activeNote.analysis.description || '');
            setIsEditing(false);
            setActivePhotoIdx(0);
        }
    }, [activeNote]);

    // 키보드 방향키 이동
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const targetTag = (document.activeElement?.tagName || '').toLowerCase();
            if (targetTag === 'input' || targetTag === 'textarea') return;

            if (activeNote && activeNote.imageUrls && activeNote.imageUrls.length > 0) {
                const total = activeNote.imageUrls.length;
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setActivePhotoIdx((prev) => (prev + 1 < total ? prev + 1 : 0));
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setActivePhotoIdx((prev) => (prev - 1 >= 0 ? prev - 1 : total - 1));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeNote]);

    const toggleSelectNote = (id: string, e?: any) => {
        if (e && e.stopPropagation) e.stopPropagation();
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
        const ok =
            Platform.OS === 'web' ? window.confirm(`선택한 ${count}개의 노트를 목록에서 제외하시겠습니까?`) : true;
        if (!ok) return;

        deleteMultipleFromGeneratedNotes(Array.from(selectedNoteIds));
        if (activeNote && selectedNoteIds.has(activeNote.id)) {
            const remaining = generatedNotes.filter((n) => !selectedNoteIds.has(n.id));
            setActiveNote(remaining.length > 0 ? remaining[0] : null);
        }
        setSelectedNoteIds(new Set());
    };

    const handleDeleteSingle = (id: string, e?: any) => {
        if (e && e.stopPropagation) e.stopPropagation();
        deleteFromGeneratedNotes(id);
        if (activeNote?.id === id) {
            const remaining = generatedNotes.filter((n) => n.id !== id);
            setActiveNote(remaining.length > 0 ? remaining[0] : null);
        }
        setSelectedNoteIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const handleSaveEdit = async () => {
        if (!activeNote) return;

        await updateMemoryItem(activeNote.id, {
            title: editTitle,
            location: editLocation,
            yearEstimate: editYear,
            storyCaption: editStory,
        });

        setActiveNote((prev) =>
            prev
                ? {
                      ...prev,
                      analysis: {
                          ...prev.analysis!,
                          title: editTitle,
                          location: editLocation,
                          yearEstimate: editYear,
                          storyCaption: editStory,
                      },
                  }
                : null,
        );

        setIsEditing(false);
    };

    const handlePrint = () => {
        if (Platform.OS === 'web') {
            window.print();
        }
    };

    const isAllSelected = generatedNotes.length > 0 && generatedNotes.every((item) => selectedNoteIds.has(item.id));

    return (
        <View style={styles.container}>
            {/* 상단 탭 네비게이터 및 액션 바 */}
            <View style={styles.headerBar}>
                <View style={styles.headerLeft}>
                    <Text style={styles.pageTitle}>📖 감성 추억 포토북 & 매거진</Text>
                    <Text style={styles.pageSubtitle}>
                        내보낸 추억 노트들을 매거진 형태로 감상하고 PDF로 저장하거나 인쇄할 수 있습니다.
                    </Text>
                </View>

                {generatedNotes.length > 0 && (
                    <View style={styles.headerRightActions}>
                        <TouchableOpacity style={styles.selectAllBtn} onPress={handleToggleSelectAll}>
                            <Text style={styles.selectAllBtnText}>{isAllSelected ? '선택 해제 ✕' : '전체 선택 ✓'}</Text>
                        </TouchableOpacity>

                        {selectedNoteIds.size > 0 && (
                            <TouchableOpacity style={styles.batchDeleteBtn} onPress={handleBatchDelete}>
                                <Text style={styles.batchDeleteBtnText}>
                                    {`🗑️ 선택 삭제 (${selectedNoteIds.size}개)`}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
                            <Text style={styles.printBtnText}>🖨️ 포토북 인쇄 / PDF 저장</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* 상단 앨범 선택 탭 스트립 */}
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

            {/* 중앙 메인 포토북 에세이 뷰어 */}
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
                        <Text style={styles.emptyStateTitle}>선택된 완성 노트가 없습니다</Text>
                        <Text style={styles.emptyStateSub}>
                            1번 홈 탭에서 사진 앨범을 생성한 후 '선택 노트 내보내기'를 누르면 여기에 추가됩니다.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAF5EE' },
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
    headerLeft: { flex: 1 },
    pageTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
    pageSubtitle: { fontSize: 13, color: '#64748B', marginTop: 3 },
    headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
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
    printBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#F5933C',
        borderRadius: 8,
    },
    printBtnText: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
    mainScrollView: { flex: 1 },
    mainContentContainer: { padding: 32, alignItems: 'center' },
    emptyStateBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
    emptyStateIcon: { fontSize: 56, marginBottom: 16 },
    emptyStateTitle: { fontSize: 20, fontWeight: '800', color: '#475569' },
    emptyStateSub: { fontSize: 14, color: '#94A3B8', marginTop: 6, textAlign: 'center', maxWidth: 460 },
});
