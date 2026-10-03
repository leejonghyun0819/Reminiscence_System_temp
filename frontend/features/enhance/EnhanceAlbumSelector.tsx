// frontend/features/enhance/EnhanceAlbumSelector.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { MemoryItem } from '../../context/MemoryContext';
import { MouseDragHorizontalScroll } from '../backup/MouseDragHorizontalScroll';

interface EnhanceAlbumSelectorProps {
    albums: MemoryItem[];
    selectedId?: string;
    onSelectAlbum: (album: MemoryItem) => void;
    onDismissAlbum: (albumId: string) => void;
    onResetDismissed?: () => void;
    hasDismissed?: boolean;
}

export const EnhanceAlbumSelector: React.FC<EnhanceAlbumSelectorProps> = ({
    albums,
    selectedId,
    onSelectAlbum,
    onDismissAlbum,
    onResetDismissed,
    hasDismissed,
}) => {
    return (
        <View style={styles.listSection}>
            <View style={styles.listHeaderRow}>
                <Text style={styles.listSectionTitle}>{`📚 작업 중인 앨범 선택 (${albums.length}개)`}</Text>
                {hasDismissed && onResetDismissed && (
                    <TouchableOpacity style={styles.resetBtn} onPress={onResetDismissed}>
                        <Text style={styles.resetBtnText}>🔄 제외된 앨범 모두 다시 표시</Text>
                    </TouchableOpacity>
                )}
            </View>

            {albums.length > 0 ? (
                <MouseDragHorizontalScroll contentContainerStyle={styles.albumScroll}>
                    {albums.map((album) => {
                        const isSelected = selectedId === album.id;
                        return (
                            <View key={album.id} style={styles.albumCardWrapper}>
                                <TouchableOpacity
                                    style={[styles.albumCard, isSelected && styles.albumCardSelected]}
                                    onPress={() => onSelectAlbum(album)}
                                >
                                    <Image source={{ uri: album.imageUrls[0] }} style={styles.albumCardThumb} />
                                    <Text style={styles.albumCardTitle} numberOfLines={1}>
                                        {album.analysis?.title || '추억 앨범'}
                                    </Text>
                                    <Text style={styles.albumCardCount}>{`사진 ${album.imageUrls.length}장`}</Text>
                                </TouchableOpacity>

                                {/* 🌟 enhance 탭 선택지에서만 제외하는 버튼 */}
                                <TouchableOpacity
                                    style={styles.dismissAlbumBtn}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        onDismissAlbum(album.id);
                                    }}
                                    accessibilityLabel="목록에서 제외"
                                >
                                    <Text style={styles.dismissAlbumBtnText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </MouseDragHorizontalScroll>
            ) : (
                <Text style={styles.emptyText}>선택 가능한 앨범이 모두 제외되었습니다.</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    listSection: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    listHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        flexWrap: 'wrap',
        gap: 8,
    },
    listSectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    resetBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 6,
    },
    resetBtnText: { fontSize: 12, color: '#475569', fontWeight: '700' },
    albumScroll: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
    albumCardWrapper: { position: 'relative' },
    albumCard: {
        width: 140,
        padding: 8,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
    },
    albumCardSelected: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
    albumCardThumb: { width: 120, height: 85, borderRadius: 6, marginBottom: 6 },
    albumCardTitle: { fontSize: 12, fontWeight: '700', color: '#1E293B', width: '100%', textAlign: 'center' },
    albumCardCount: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
    dismissAlbumBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#64748B',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        zIndex: 10,
    },
    dismissAlbumBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
    emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 12 },
});
