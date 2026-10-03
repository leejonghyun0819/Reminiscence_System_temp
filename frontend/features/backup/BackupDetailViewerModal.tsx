// frontend/features/BackupDetailViewerModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Image, StyleSheet, Platform } from 'react-native';
import { AnalysisVersion } from '../../context/MemoryContext';
import { MouseDragHorizontalScroll } from './MouseDragHorizontalScroll';
import { isVideoUrl } from '../../utils/mediaProcessUtils';

export interface BackupAlbumMeta {
    id: string;
    fileNames: string[];
    imageUrls: string[];
    audioFileName?: string;
    audioUrl?: string;
    categoryFolder?: string;
    history?: AnalysisVersion[];
    analysis: any;
    createdAt: number;
}

interface BackupDetailViewerModalProps {
    album: BackupAlbumMeta | null;
    isAlreadyInIndex: boolean;
    onClose: () => void;
    onRestoreToHome: (album: BackupAlbumMeta) => void;
    onRollbackVersion: (targetVer: AnalysisVersion) => void;
    onDeleteHistoryVersion: (versionNum: number, e?: any) => void;
}

export const BackupDetailViewerModal: React.FC<BackupDetailViewerModalProps> = ({
    album,
    isAlreadyInIndex,
    onClose,
    onRestoreToHome,
    onRollbackVersion,
    onDeleteHistoryVersion,
}) => {
    const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
    const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<AnalysisVersion | null>(null);

    useEffect(() => {
        setActivePhotoIdx(0);
        setSelectedHistoryVersion(null);
    }, [album]);

    useEffect(() => {
        if (Platform.OS !== 'web' || !album) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const total = album.imageUrls.length;
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                setActivePhotoIdx((prev) => (prev + 1 < total ? prev + 1 : 0));
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setActivePhotoIdx((prev) => (prev - 1 >= 0 ? prev - 1 : total - 1));
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [album, onClose]);

    if (!album) return null;

    const currentAnalysis = selectedHistoryVersion || album.analysis;

    return (
        <Modal visible={album !== null} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.detailOverlay}>
                <View style={styles.detailCard}>
                    <View style={styles.detailHeader}>
                        <View>
                            <Text style={styles.detailHeaderTitle}>
                                📖 {currentAnalysis?.title || '추억 상세 보기'}
                                {selectedHistoryVersion && (
                                    <Text style={{ fontSize: 13, color: '#7C3AED', fontWeight: '700' }}>
                                        {` (버전 ${selectedHistoryVersion.version} 미리보기 중)`}
                                    </Text>
                                )}
                            </Text>
                            <Text style={styles.detailHeaderSub}>
                                {`방향키(←, →)를 눌러 등록된 ${album.imageUrls.length}개의 미디어를 모두 열람하고 재생할 수 있습니다.`}
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.detailCloseBtn} onPress={onClose}>
                            <Text style={styles.detailCloseBtnText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.detailBody}>
                        <View style={styles.detailMainImgContainer}>
                            <TouchableOpacity
                                style={[styles.navArrowBtn, styles.navArrowBtnLeft]}
                                onPress={() =>
                                    setActivePhotoIdx((prev) => (prev - 1 >= 0 ? prev - 1 : album.imageUrls.length - 1))
                                }
                            >
                                <Text style={styles.navArrowText}>‹</Text>
                            </TouchableOpacity>

                            {isVideoUrl(album.imageUrls[activePhotoIdx]) && Platform.OS === 'web' ? (
                                <div
                                    style={{
                                        width: '100%',
                                        height: 300,
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                >
                                    <video
                                        key={album.imageUrls[activePhotoIdx]}
                                        src={album.imageUrls[activePhotoIdx]}
                                        controls
                                        autoPlay
                                        playsInline
                                        style={{
                                            width: '100%',
                                            maxHeight: 300,
                                            borderRadius: 8,
                                            backgroundColor: '#000',
                                        }}
                                    />
                                </div>
                            ) : (
                                <Image
                                    source={{ uri: album.imageUrls[activePhotoIdx] }}
                                    style={styles.detailMainImg}
                                    resizeMode="contain"
                                />
                            )}

                            <TouchableOpacity
                                style={[styles.navArrowBtn, styles.navArrowBtnRight]}
                                onPress={() =>
                                    setActivePhotoIdx((prev) => (prev + 1 < album.imageUrls.length ? prev + 1 : 0))
                                }
                            >
                                <Text style={styles.navArrowText}>›</Text>
                            </TouchableOpacity>

                            <Text style={styles.detailPhotoCounter}>
                                {`${isVideoUrl(album.imageUrls[activePhotoIdx]) ? '🎬 ' : '🖼️ '} ${activePhotoIdx + 1} / ${album.imageUrls.length}`}
                            </Text>
                        </View>

                        <MouseDragHorizontalScroll contentContainerStyle={{ paddingVertical: 4 }}>
                            {album.imageUrls.map((url, idx) => {
                                const isVid = isVideoUrl(url);
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        onPress={() => setActivePhotoIdx(idx)}
                                        style={[styles.detailThumb, activePhotoIdx === idx && styles.detailThumbActive]}
                                    >
                                        {isVid && Platform.OS === 'web' ? (
                                            <div
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    position: 'relative',
                                                    backgroundColor: '#000',
                                                }}
                                            >
                                                <video
                                                    src={url}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    muted
                                                />
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        inset: 0,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <span style={{ fontSize: 11 }}>🎬</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <Image source={{ uri: url }} style={styles.detailThumbImg} />
                                        )}
                                        <Text style={styles.detailThumbBadge}>{`${idx + 1}`}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </MouseDragHorizontalScroll>

                        {/* 히스토리 스트립 */}
                        {album.history && album.history.length > 0 && (
                            <View style={styles.backupHistoryBox}>
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: 6,
                                    }}
                                >
                                    <Text style={styles.backupHistoryTitle}>
                                        {`📜 AI 분석 버전 히스토리 (${album.history.length}개 보관)`}
                                    </Text>
                                    {selectedHistoryVersion && (
                                        <TouchableOpacity
                                            style={styles.rollbackApplyBtn}
                                            onPress={() => onRollbackVersion(selectedHistoryVersion)}
                                        >
                                            <Text style={styles.rollbackApplyBtnText}>
                                                {`↩️ 버전 ${selectedHistoryVersion.version} 내용으로 앨범 복원`}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <Text style={styles.backupHistorySub}>
                                    과거 버전을 클릭하면 그 당시의 제목과 에세이를 미리 볼 수 있습니다. (✕ 클릭 시 삭제
                                    및 번호 자동 재정렬)
                                </Text>

                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity
                                            style={[
                                                styles.backupHistoryTab,
                                                selectedHistoryVersion === null && styles.backupHistoryTabActive,
                                            ]}
                                            onPress={() => setSelectedHistoryVersion(null)}
                                        >
                                            <Text
                                                style={[
                                                    styles.backupHistoryTabText,
                                                    selectedHistoryVersion === null &&
                                                        styles.backupHistoryTabTextActive,
                                                ]}
                                            >
                                                ⭐ 최신 버전
                                            </Text>
                                        </TouchableOpacity>

                                        {album.history.map((ver, vIdx) => {
                                            const isTabActive = selectedHistoryVersion?.version === ver.version;
                                            return (
                                                <View key={vIdx} style={styles.backupHistoryTabWrapper}>
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.backupHistoryTab,
                                                            isTabActive && styles.backupHistoryTabActive,
                                                        ]}
                                                        onPress={() => setSelectedHistoryVersion(ver)}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.backupHistoryTabText,
                                                                isTabActive && styles.backupHistoryTabTextActive,
                                                            ]}
                                                        >
                                                            {`버전 ${ver.version} ('${ver.title.slice(0, 8)}...')`}
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.backupHistoryDelBtn}
                                                        onPress={(e) => onDeleteHistoryVersion(ver.version, e)}
                                                    >
                                                        <Text style={styles.backupHistoryDelBtnText}>✕</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                            </View>
                        )}

                        <View style={styles.detailMetaBox}>
                            <View style={styles.detailTagRow}>
                                <Text style={styles.detailTag}>{`📁 ${album.categoryFolder || '미분류'}`}</Text>
                                <Text style={styles.detailTag}>{`📍 ${currentAnalysis?.location || '장소 미정'}`}</Text>
                                <Text
                                    style={styles.detailTag}
                                >{`⏳ ${currentAnalysis?.yearEstimate || '시기 미정'}`}</Text>
                            </View>

                            <Text style={styles.detailLabel}>종합 상황 요약</Text>
                            <Text style={styles.detailDesc}>{currentAnalysis?.description}</Text>

                            <Text style={styles.detailLabel}>감성 에세이 스토리</Text>
                            <Text style={styles.detailStory}>{currentAnalysis?.storyCaption}</Text>
                        </View>
                    </ScrollView>

                    <View style={styles.detailFooter}>
                        <TouchableOpacity style={styles.detailCloseBottomBtn} onPress={onClose}>
                            <Text style={styles.detailCloseBottomBtnText}>닫기</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.detailRestoreBtn, isAlreadyInIndex && styles.restoreSingleBtnDisabled]}
                            onPress={() => onRestoreToHome(album)}
                        >
                            <Text
                                style={[
                                    styles.detailRestoreBtnText,
                                    isAlreadyInIndex && styles.restoreSingleBtnTextDisabled,
                                ]}
                            >
                                {isAlreadyInIndex ? '✓ 홈 화면에 존재' : '📥 홈으로 복원'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    detailOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    detailCard: {
        width: '100%',
        maxWidth: 820,
        maxHeight: '92%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
    },
    detailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        paddingBottom: 14,
        marginBottom: 16,
    },
    detailHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#18181B' },
    detailHeaderSub: { fontSize: 12, color: '#71717A', marginTop: 2 },
    detailCloseBtn: { padding: 6 },
    detailCloseBtnText: { fontSize: 18, color: '#71717A', fontWeight: '700' },
    detailBody: { flex: 1 },
    detailMainImgContainer: {
        position: 'relative',
        width: '100%',
        height: 300,
        backgroundColor: '#18181B',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    detailMainImg: { width: '100%', height: '100%' },
    navArrowBtn: {
        position: 'absolute',
        top: '50%',
        marginTop: -22,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    navArrowBtnLeft: { left: 14 },
    navArrowBtnRight: { right: 14 },
    navArrowText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', lineHeight: 30 },
    detailPhotoCounter: {
        position: 'absolute',
        bottom: 10,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        fontSize: 11,
        fontWeight: '700',
    },
    detailThumb: {
        position: 'relative',
        width: 65,
        height: 48,
        borderRadius: 6,
        overflow: 'hidden',
        marginRight: 8,
        borderWidth: 2,
        borderColor: '#E4E4E7',
    },
    detailThumbActive: { borderColor: '#F5933C' },
    detailThumbImg: { width: '100%', height: '100%' },
    detailThumbBadge: {
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
    backupHistoryBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        padding: 12,
        marginTop: 12,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    backupHistoryTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
    backupHistorySub: { fontSize: 11, color: '#64748B', marginTop: 2 },
    rollbackApplyBtn: {
        backgroundColor: '#7C3AED',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    rollbackApplyBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
    backupHistoryTabWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        overflow: 'hidden',
    },
    backupHistoryTab: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFFFFF' },
    backupHistoryTabActive: { backgroundColor: '#7C3AED' },
    backupHistoryTabText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    backupHistoryTabTextActive: { color: '#FFFFFF' },
    backupHistoryDelBtn: {
        paddingHorizontal: 7,
        paddingVertical: 6,
        backgroundColor: '#FEE2E2',
        borderLeftWidth: 1,
        borderLeftColor: '#FECACA',
    },
    backupHistoryDelBtnText: { fontSize: 10, color: '#DC2626', fontWeight: '800' },
    detailMetaBox: { gap: 8, marginTop: 8 },
    detailTagRow: { flexDirection: 'row', gap: 8 },
    detailTag: {
        backgroundColor: '#F4F4F5',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        fontSize: 12,
        color: '#52525B',
        fontWeight: '600',
    },
    detailLabel: { fontSize: 12, fontWeight: '700', color: '#71717A', marginTop: 6 },
    detailDesc: { fontSize: 14, color: '#3F3F46', lineHeight: 20 },
    detailStory: {
        fontSize: 14,
        color: '#6B21A8',
        lineHeight: 22,
        backgroundColor: '#FAF5FF',
        padding: 12,
        borderRadius: 8,
    },
    detailFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingTop: 16,
        marginTop: 14,
    },
    detailCloseBottomBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#F4F4F5',
        borderRadius: 8,
    },
    detailCloseBottomBtnText: { fontSize: 13, color: '#52525B', fontWeight: '700' },
    detailRestoreBtn: {
        paddingVertical: 8,
        paddingHorizontal: 18,
        backgroundColor: '#F5933C',
        borderRadius: 8,
    },
    detailRestoreBtnText: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
    restoreSingleBtnDisabled: { backgroundColor: '#E4E4E7' },
    restoreSingleBtnTextDisabled: { color: '#71717A' },
});
