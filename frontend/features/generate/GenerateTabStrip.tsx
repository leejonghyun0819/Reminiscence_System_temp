// frontend/features/generate/GenerateTabStrip.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MemoryItem } from '../../context/MemoryContext';
import { MouseDragHorizontalScroll } from '../backup/MouseDragHorizontalScroll';
import { memoryColors } from '../../constants/memoryTheme';

interface GenerateTabStripProps {
    generatedNotes: MemoryItem[];
    activeNoteId?: string;
    selectedNoteIds: Set<string>;
    onSelectNote: (note: MemoryItem) => void;
    onToggleCheck: (id: string, e?: any) => void;
    onDeleteNote: (id: string, e?: any) => void;
}

export const GenerateTabStrip: React.FC<GenerateTabStripProps> = ({
    generatedNotes,
    activeNoteId,
    selectedNoteIds,
    onSelectNote,
    onToggleCheck,
    onDeleteNote,
}) => {
    if (generatedNotes.length === 0) return null;

    return (
        <View style={styles.noteTabStrip}>
            <MouseDragHorizontalScroll contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {generatedNotes.map((note, idx) => {
                    const isActive = activeNoteId === note.id;
                    const isSelected = selectedNoteIds.has(note.id);

                    return (
                        <View
                            key={note.id}
                            style={[
                                styles.tabCard,
                                isActive && styles.tabCardActive,
                                isSelected && styles.tabCardSelected,
                            ]}
                        >
                            <TouchableOpacity
                                style={[styles.checkbox, isSelected && styles.checkboxActive]}
                                onPress={(e) => onToggleCheck(note.id, e)}
                            >
                                <Text style={[styles.checkmark, isSelected && styles.checkmarkActive]}>
                                    {isSelected ? '✓' : ''}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{ flex: 1 }} onPress={() => onSelectNote(note)}>
                                <Text
                                    style={[styles.tabCardTitle, isActive && styles.tabCardTitleActive]}
                                    numberOfLines={1}
                                >
                                    {`${idx + 1}. ${note.analysis?.title || '제목 없음'}`}
                                </Text>
                                <Text style={styles.tabCardSub} numberOfLines={1}>
                                    {`📍 ${note.analysis?.location || '장소'} · ⏳ ${note.analysis?.yearEstimate || '시기'}`}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.tabDeleteBtn} onPress={(e) => onDeleteNote(note.id, e)}>
                                <Text style={styles.tabDeleteBtnText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </MouseDragHorizontalScroll>
        </View>
    );
};

const styles = StyleSheet.create({
    noteTabStrip: {
        paddingVertical: 8,
    },
    tabCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: memoryColors.border,
        width: 220,
        gap: 8,
    },
    tabCardActive: {
        borderColor: memoryColors.brand,
        backgroundColor: memoryColors.brandLight,
    },
    tabCardSelected: {
        borderColor: memoryColors.brand,
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#94A3B8',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    checkboxActive: {
        backgroundColor: memoryColors.brand,
        borderColor: memoryColors.brand,
    },
    checkmark: { fontSize: 10, color: 'transparent', fontWeight: '800' },
    checkmarkActive: { color: '#FFFFFF' },
    tabCardTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
    tabCardTitleActive: { color: memoryColors.brand },
    tabCardSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
    tabDeleteBtn: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabDeleteBtnText: { fontSize: 10, color: '#64748B', fontWeight: '800' },
});
