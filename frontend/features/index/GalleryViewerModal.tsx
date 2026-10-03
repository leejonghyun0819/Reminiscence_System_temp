// frontend/features/index/GalleryViewerModal.tsx
import React from 'react';
import { Modal, View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { MemoryItem, useMemory } from '../../context/MemoryContext';

interface GalleryViewerModalProps {
    visible: boolean;
    album: MemoryItem | null;
    onClose: () => void;
}

export const GalleryViewerModal: React.FC<GalleryViewerModalProps> = ({ visible, album, onClose }) => {
    const { deleteSingleImage } = useMemory();

    if (!album) return null;

    const handleDeletePhoto = (targetUrl: string, index: number) => {
        if (album.imageUrls.length <= 1) {
            alert('⚠️ 앨범에는 최소 1장 이상의 사진이 남아있어야 합니다.');
            return;
        }

        const confirmed = window.confirm ? window.confirm(`${index + 1}번째 사진을 앨범에서 삭제하시겠습니까?`) : true;

        if (confirmed) {
            deleteSingleImage(album.id, targetUrl)
                .then((success) => {
                    if (success) {
                        alert('사진이 삭제되었습니다.');
                    } else {
                        alert('사진 삭제에 실패했습니다.');
                    }
                })
                .catch((e) => {
                    alert(`삭제 중 오류 발생: ${e.message}`);
                });
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <View>
                            <Text style={styles.modalTitle}>
                                {`🖼️ ${album.analysis?.title || '앨범'} 미디어 갤러리`}
                            </Text>
                            <Text style={styles.modalSubTitle}>
                                {`총 ${album.imageUrls?.length || 0}개의 미디어가 등록되어 있습니다.`}
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Text style={styles.closeBtnText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.galleryGrid}>
                        {album.imageUrls?.map((url, idx) => (
                            <View key={idx} style={styles.mediaCard}>
                                <View style={styles.imageWrapper}>
                                    <Image source={{ uri: url }} style={styles.galleryImage} resizeMode="cover" />
                                    <TouchableOpacity
                                        style={styles.deletePhotoBtn}
                                        onPress={() => handleDeletePhoto(url, idx)}
                                    >
                                        <Text style={styles.deletePhotoBtnText}>🗑️ 삭제</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.mediaIndexText}>{`${idx + 1}번째 사진`}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 900,
        maxHeight: '85%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
        paddingBottom: 14,
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    modalSubTitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtnText: { fontSize: 14, color: '#475569', fontWeight: '800' },
    galleryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'flex-start',
        paddingVertical: 10,
    },
    mediaCard: {
        width: '30%',
        minWidth: 220,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
        paddingBottom: 8,
    },
    imageWrapper: {
        width: '100%',
        height: 180,
        position: 'relative',
        backgroundColor: '#0F172A',
    },
    galleryImage: { width: '100%', height: '100%' },
    deletePhotoBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    deletePhotoBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
    mediaIndexText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
        textAlign: 'center',
        marginTop: 8,
    },
});
