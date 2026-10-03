// frontend/features/generate/MagazineBookViewer.tsx
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { MemoryItem } from '../../context/MemoryContext';
import { MouseDragHorizontalScroll } from '../backup/MouseDragHorizontalScroll';

interface MagazineBookViewerProps {
    note: MemoryItem;
    activePhotoIdx: number;
    setActivePhotoIdx: (idx: number) => void;
    isEditing: boolean;
    setIsEditing: (editing: boolean) => void;
    editTitle: string;
    setEditTitle: (val: string) => void;
    editStory: string;
    setEditStory: (val: string) => void;
    onSaveEdit: () => void;
}

export const MagazineBookViewer: React.FC<MagazineBookViewerProps> = ({
    note,
    activePhotoIdx,
    setActivePhotoIdx,
    isEditing,
    setIsEditing,
    editTitle,
    setEditTitle,
    editStory,
    setEditStory,
    onSaveEdit,
}) => {
    return (
        <View style={styles.bookWrapper}>
            <View style={styles.bookHeaderRow}>
                <View style={styles.tagGroup}>
                    <Text style={styles.locationTag}>{`📍 ${note.analysis?.location || '장소 미정'}`}</Text>
                    <Text style={styles.yearTag}>{`⏳ ${note.analysis?.yearEstimate || '시기 미정'}`}</Text>
                    {note.categoryFolder ? <Text style={styles.folderTag}>{`📁 ${note.categoryFolder}`}</Text> : null}
                </View>

                <View style={styles.cardHeaderBtnGroup}>
                    {isEditing ? (
                        <TouchableOpacity style={styles.saveBtn} onPress={onSaveEdit}>
                            <Text style={styles.saveBtnText}>💾 편집 완료 저장</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(true)}>
                            <Text style={styles.editBtnText}>✏️ 직접 편집</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {isEditing ? (
                <TextInput
                    style={styles.editTitleInput}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="추억 제목을 입력하세요"
                />
            ) : (
                <Text style={styles.bookMainTitle}>{note.analysis?.title || '제목 없음'}</Text>
            )}

            <View style={styles.mainPhotoBox}>
                {note.imageUrls && note.imageUrls.length > 0 ? (
                    <Image
                        source={{ uri: note.imageUrls[activePhotoIdx] }}
                        style={styles.mainPhotoImage}
                        resizeMode="contain"
                    />
                ) : null}
                <Text style={styles.photoCounterBadge}>{`${activePhotoIdx + 1} / ${note.imageUrls?.length || 0}`}</Text>
            </View>

            <View style={styles.thumbStripWrapper}>
                <MouseDragHorizontalScroll contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {note.imageUrls?.map((url: string, idx: number) => (
                        <TouchableOpacity
                            key={idx}
                            onPress={() => setActivePhotoIdx(idx)}
                            style={[styles.thumbItem, activePhotoIdx === idx && styles.thumbItemActive]}
                        >
                            <Image source={{ uri: url }} style={styles.thumbImg} />
                            <Text style={styles.thumbNumberBadge}>{`${idx + 1}`}</Text>
                        </TouchableOpacity>
                    ))}
                </MouseDragHorizontalScroll>
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.storySection}>
                <Text style={styles.storySectionTitle}>📖 그날의 이야기</Text>
                {isEditing ? (
                    <TextInput
                        style={styles.editStoryInput}
                        value={editStory}
                        onChangeText={setEditStory}
                        multiline
                        placeholder="마음을 울리는 따뜻한 추억 이야기를 적어주세요"
                    />
                ) : (
                    <Text style={styles.storyContentText}>
                        {note.analysis?.storyCaption || note.analysis?.description || ''}
                    </Text>
                )}
            </View>

            {note.analysis?.audioTranscriptSummary ? (
                <View style={styles.audioVoiceBox}>
                    <Text style={styles.audioVoiceTitle}>🎙️ 그날의 음성 기록</Text>
                    <Text style={styles.audioVoiceContent}>{`"${note.analysis.audioTranscriptSummary}"`}</Text>
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    bookWrapper: {
        maxWidth: 820,
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 36,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
    },
    bookHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 10,
    },
    tagGroup: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    locationTag: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    yearTag: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    folderTag: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        fontSize: 12,
        fontWeight: '700',
        color: '#B45309',
    },
    cardHeaderBtnGroup: { flexDirection: 'row', gap: 8 },
    editBtn: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    editBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },
    saveBtn: {
        backgroundColor: '#16A34A',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 6,
    },
    saveBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
    bookMainTitle: {
        fontSize: 26,
        fontWeight: '900',
        color: '#1E293B',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 34,
    },
    editTitleInput: {
        fontSize: 22,
        fontWeight: '900',
        color: '#1E293B',
        textAlign: 'center',
        borderBottomWidth: 2,
        borderBottomColor: '#F5933C',
        paddingBottom: 6,
        marginBottom: 24,
    },
    mainPhotoBox: {
        width: '100%',
        height: 380,
        backgroundColor: '#18181B',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainPhotoImage: { width: '100%', height: '100%' },
    photoCounterBadge: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.65)',
        color: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        fontSize: 12,
        fontWeight: '700',
    },
    thumbStripWrapper: { marginTop: 14, width: '100%' },
    thumbItem: {
        position: 'relative',
        width: 75,
        height: 55,
        borderRadius: 6,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#E2E8F0',
    },
    thumbItemActive: { borderColor: '#F5933C' },
    thumbImg: { width: '100%', height: '100%' },
    thumbNumberBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: 'rgba(0,0,0,0.65)',
        color: '#FFFFFF',
        fontSize: 9,
        paddingHorizontal: 3,
        borderRadius: 3,
        fontWeight: '700',
    },
    sectionDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 28 },
    storySection: { gap: 12 },
    storySectionTitle: { fontSize: 18, fontWeight: '800', color: '#7E22CE' },
    storyContentText: {
        fontSize: 15,
        color: '#334155',
        lineHeight: 28,
        fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : undefined,
    },
    editStoryInput: {
        fontSize: 15,
        color: '#1E293B',
        lineHeight: 26,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        padding: 14,
        height: 160,
        textAlignVertical: 'top',
        backgroundColor: '#F8FAFC',
    },
    audioVoiceBox: {
        marginTop: 24,
        backgroundColor: '#F0FDF4',
        borderLeftWidth: 4,
        borderLeftColor: '#22C55E',
        padding: 16,
        borderRadius: 8,
        gap: 6,
    },
    audioVoiceTitle: { fontSize: 13, fontWeight: '800', color: '#15803D' },
    audioVoiceContent: { fontSize: 14, color: '#166534', fontStyle: 'italic', lineHeight: 22 },
});
