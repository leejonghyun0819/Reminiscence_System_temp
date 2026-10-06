import React from 'react';
import { Image, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { MemoryItem } from '../../context/MemoryContext';
import { MouseDragHorizontalScroll } from '../backup/MouseDragHorizontalScroll';

interface MagazineBookViewerProps {
    note: MemoryItem;
    activePhotoIdx: number;
    setActivePhotoIdx: (idx: number) => void;
    isEditing: boolean;
    setIsEditing: (editing: boolean) => void;
    editTitle: string;
    setEditTitle: (value: string) => void;
    editStory: string;
    setEditStory: (value: string) => void;
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
    const generatedNote = note.generatedNote;
    const photoCount = note.imageUrls?.length || 0;

    return (
        <View style={styles.bookWrapper}>
            <View style={styles.bookHeaderRow}>
                <View style={styles.tagGroup}>
                    <Text style={styles.locationTag}>{`📍 ${note.analysis?.location || '장소 미정'}`}</Text>
                    <Text style={styles.yearTag}>{`⏳ ${note.analysis?.yearEstimate || '시기 미정'}`}</Text>
                    {note.categoryFolder ? <Text style={styles.folderTag}>{`📁 ${note.categoryFolder}`}</Text> : null}
                    {generatedNote ? (
                        <Text style={styles.sourceTag}>{`${generatedNote.sourceMemoryIds.length}개 추억 연결`}</Text>
                    ) : null}
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
                <>
                    <Text style={styles.bookMainTitle}>{note.analysis?.title || '제목 없음'}</Text>
                    {generatedNote?.subtitle ? <Text style={styles.bookSubtitle}>{generatedNote.subtitle}</Text> : null}
                </>
            )}

            <View style={styles.mainPhotoBox}>
                {photoCount > 0 ? (
                    <Image
                        source={{ uri: note.imageUrls[activePhotoIdx] }}
                        style={styles.mainPhotoImage}
                        resizeMode="contain"
                    />
                ) : (
                    <View style={styles.noPhotoBox}>
                        <Text style={styles.noPhotoIcon}>📷</Text>
                        <Text style={styles.noPhotoText}>연결된 사진이 없습니다.</Text>
                    </View>
                )}
                <Text style={styles.photoCounterBadge}>{`${photoCount > 0 ? activePhotoIdx + 1 : 0} / ${photoCount}`}</Text>
            </View>

            {photoCount > 0 ? (
                <View style={styles.thumbStripWrapper}>
                    <MouseDragHorizontalScroll contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                        {note.imageUrls.map((url, index) => (
                            <TouchableOpacity
                                key={`${url}-${index}`}
                                onPress={() => setActivePhotoIdx(index)}
                                style={[styles.thumbItem, activePhotoIdx === index && styles.thumbItemActive]}
                            >
                                <Image source={{ uri: url }} style={styles.thumbImg} />
                                <Text style={styles.thumbNumberBadge}>{index + 1}</Text>
                            </TouchableOpacity>
                        ))}
                    </MouseDragHorizontalScroll>
                </View>
            ) : null}

            <View style={styles.sectionDivider} />

            <View style={styles.storySection}>
                <Text style={styles.storySectionTitle}>
                    {generatedNote ? '✨ AI가 엮은 이야기' : '📖 그날의 이야기'}
                </Text>

                {isEditing ? (
                    <TextInput
                        style={styles.editStoryInput}
                        value={editStory}
                        onChangeText={setEditStory}
                        multiline
                        placeholder="추억 이야기를 적어주세요"
                    />
                ) : generatedNote ? (
                    <View style={styles.generatedStory}>
                        {generatedNote.opening ? <Text style={styles.openingText}>{generatedNote.opening}</Text> : null}
                        <Text style={styles.storyContentText}>{generatedNote.body}</Text>
                        {generatedNote.closing ? (
                            <View style={styles.closingBox}>
                                <Text style={styles.closingLabel}>마지막 페이지</Text>
                                <Text style={styles.closingText}>{generatedNote.closing}</Text>
                            </View>
                        ) : null}
                        {generatedNote.keywords.length > 0 ? (
                            <View style={styles.keywordRow}>
                                {generatedNote.keywords.map((keyword) => (
                                    <Text key={keyword} style={styles.keywordTag}>{`#${keyword}`}</Text>
                                ))}
                            </View>
                        ) : null}
                    </View>
                ) : (
                    <Text style={styles.storyContentText}>
                        {note.analysis?.storyCaption || note.analysis?.description || ''}
                    </Text>
                )}
            </View>

            {note.analysis?.audioTranscriptSummary ? (
                <View style={styles.audioVoiceBox}>
                    <Text style={styles.audioVoiceTitle}>🎙️ 그날의 음성 기록</Text>
                    <Text style={styles.audioVoiceContent}>{`“${note.analysis.audioTranscriptSummary}”`}</Text>
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    bookWrapper: {
        maxWidth: 860,
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 36,
        shadowColor: '#0F172A',
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
    tagGroup: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 },
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
    sourceTag: {
        backgroundColor: '#DBEAFE',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        fontSize: 12,
        fontWeight: '800',
        color: '#1D4ED8',
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
    saveBtn: { backgroundColor: '#16A34A', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
    saveBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
    bookMainTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#172554',
        textAlign: 'center',
        lineHeight: 37,
    },
    bookSubtitle: {
        marginTop: 8,
        marginBottom: 24,
        fontSize: 14,
        lineHeight: 21,
        color: '#64748B',
        textAlign: 'center',
    },
    editTitleInput: {
        fontSize: 22,
        fontWeight: '900',
        color: '#1E293B',
        textAlign: 'center',
        borderBottomWidth: 2,
        borderBottomColor: '#2563EB',
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
    noPhotoBox: { alignItems: 'center', gap: 7 },
    noPhotoIcon: { fontSize: 36 },
    noPhotoText: { color: '#CBD5E1', fontSize: 12 },
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
    thumbItemActive: { borderColor: '#2563EB' },
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
    sectionDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 28 },
    storySection: { gap: 13 },
    storySectionTitle: { fontSize: 18, fontWeight: '900', color: '#1D4ED8' },
    generatedStory: { gap: 18 },
    openingText: {
        fontSize: 16,
        color: '#334155',
        lineHeight: 29,
        fontWeight: '700',
        fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : undefined,
    },
    storyContentText: {
        fontSize: 15,
        color: '#334155',
        lineHeight: 29,
        fontFamily: Platform.OS === 'web' ? 'Georgia, serif' : undefined,
    },
    closingBox: {
        marginTop: 4,
        padding: 17,
        backgroundColor: '#EFF6FF',
        borderLeftWidth: 4,
        borderLeftColor: '#2563EB',
        borderRadius: 8,
        gap: 6,
    },
    closingLabel: { fontSize: 11, fontWeight: '900', color: '#1D4ED8' },
    closingText: { fontSize: 14, color: '#334155', lineHeight: 24 },
    keywordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    keywordTag: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 999,
    },
    editStoryInput: {
        fontSize: 15,
        color: '#1E293B',
        lineHeight: 26,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        padding: 14,
        height: 220,
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
