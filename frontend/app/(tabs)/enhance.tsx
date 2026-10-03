// frontend/app/(tabs)/enhance.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useMemory } from '../../context/MemoryContext';
import { MouseDragHorizontalScroll } from '../../features/backup/MouseDragHorizontalScroll';
import { EnhanceCompareViewer } from '../../features/enhance/EnhanceCompareViewer';
import { EnhanceAlbumSelector } from '../../features/enhance/EnhanceAlbumSelector';

const BACKEND_URL = 'http://localhost:8000';

export default function EnhanceScreen() {
    const { selectedEnhanceMemory, memoryList, setSelectedEnhanceMemory, swapAlbumImage, appendAlbumImage } =
        useMemory();

    // 작업 모드: 'enhance'(화질 개선) 또는 'colorize'(흑백 컬러 복원)
    const [activeMode, setActiveMode] = useState<'enhance' | 'colorize'>('enhance');

    const [dismissedAlbumIds, setDismissedAlbumIds] = useState<Set<string>>(new Set());
    const [dismissedPhotoUrls, setDismissedPhotoUrls] = useState<Set<string>>(new Set());

    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [enhancedResultUrl, setEnhancedResultUrl] = useState<string | null>(null);

    useEffect(() => {
        setSelectedPhotoIndex(0);
        setEnhancedResultUrl(null);
        setIsProcessing(false);
        setDismissedPhotoUrls(new Set());
    }, [selectedEnhanceMemory?.id, activeMode]);

    const visibleAlbums = memoryList.filter((a) => !dismissedAlbumIds.has(a.id));
    const visiblePhotos = (selectedEnhanceMemory?.imageUrls || []).filter((url) => !dismissedPhotoUrls.has(url));

    const currentImageUrl = visiblePhotos[selectedPhotoIndex] || null;

    // AI 처리 실행 (화질 개선 또는 흑백 복원 분기)
    const handleProcessSinglePhoto = async () => {
        if (!selectedEnhanceMemory || !currentImageUrl) return;

        setIsProcessing(true);
        try {
            const formData = new FormData();
            formData.append('targetImageUrl', currentImageUrl);

            const endpoint =
                activeMode === 'colorize'
                    ? `${BACKEND_URL}/api/memories/${selectedEnhanceMemory.id}/colorize-image`
                    : `${BACKEND_URL}/api/memories/${selectedEnhanceMemory.id}/enhance-image`;

            const res = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.detail || `서버 응답 오류 (${res.status})`);
            }

            const data = await res.json();
            setEnhancedResultUrl(data.newUrl);
        } catch (e: any) {
            const modeName = activeMode === 'colorize' ? '흑백 컬러 복원' : '화질 개선';
            alert(`YouCam AI ${modeName} 중 오류가 발생했습니다:\n${e.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApplyEnhanced = async () => {
        if (!selectedEnhanceMemory || !currentImageUrl || !enhancedResultUrl) return;

        await swapAlbumImage(selectedEnhanceMemory.id, currentImageUrl, enhancedResultUrl);
        const actionText = activeMode === 'colorize' ? '컬러 복원본' : '화질 개선본';
        alert(`✨ ${actionText}이(가) 추억 노트에 교체 적용되었습니다!`);
        setEnhancedResultUrl(null);
    };

    const handleKeepBoth = async () => {
        if (!selectedEnhanceMemory || !enhancedResultUrl) return;

        await appendAlbumImage(selectedEnhanceMemory.id, enhancedResultUrl);
        alert('🎉 원본과 작업 결과본이 모두 앨범에 보관되었습니다!');
        setEnhancedResultUrl(null);
    };

    const handleKeepOriginal = () => {
        setEnhancedResultUrl(null);
    };

    const handleDismissPhoto = (url: string, e?: any) => {
        if (e && e.stopPropagation) e.stopPropagation();

        if (visiblePhotos.length <= 1) {
            alert('⚠️ 최소 1장의 사진은 뷰어에 남아있어야 합니다.');
            return;
        }

        setDismissedPhotoUrls((prev) => {
            const next = new Set(prev);
            next.add(url);
            return next;
        });

        setEnhancedResultUrl(null);
        if (selectedPhotoIndex >= visiblePhotos.length - 1) {
            setSelectedPhotoIndex(Math.max(0, visiblePhotos.length - 2));
        }
    };

    const handleDismissAlbum = (albumId: string) => {
        setDismissedAlbumIds((prev) => {
            const next = new Set(prev);
            next.add(albumId);
            return next;
        });

        if (selectedEnhanceMemory?.id === albumId) {
            const nextRemaining = visibleAlbums.filter((a) => a.id !== albumId);
            setSelectedEnhanceMemory(nextRemaining.length > 0 ? nextRemaining[0] : null);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.wrapper}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>✨ YouCam AI 사진 복원실</Text>
                    <Text style={styles.headerSubtitle}>
                        흐릿한 사진을 초고화질로 개선하거나, 흑백 사진을 생생한 컬러로 복원할 수 있습니다.
                    </Text>

                    {/* 모드 선택 탭 */}
                    <View style={styles.modeTabContainer}>
                        <TouchableOpacity
                            style={[styles.modeTabBtn, activeMode === 'enhance' && styles.modeTabBtnActive]}
                            onPress={() => setActiveMode('enhance')}
                        >
                            <Text
                                style={[styles.modeTabBtnText, activeMode === 'enhance' && styles.modeTabBtnTextActive]}
                            >
                                ⚡ 초고화질 개선 (Super Resolution)
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modeTabBtn, activeMode === 'colorize' && styles.modeTabBtnActiveColorize]}
                            onPress={() => setActiveMode('colorize')}
                        >
                            <Text
                                style={[
                                    styles.modeTabBtnText,
                                    activeMode === 'colorize' && styles.modeTabBtnTextActiveColorize,
                                ]}
                            >
                                🎨 흑백 사진 컬러 복원 (Colorize)
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {selectedEnhanceMemory && visiblePhotos.length > 0 ? (
                    <View style={styles.mainCard}>
                        <View style={styles.albumSelectHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.albumTitleText}>
                                    {`📁 ${selectedEnhanceMemory.analysis?.title || '추억 앨범'}`}
                                </Text>
                                <Text style={styles.albumSubText}>
                                    {`작업할 사진을 선택하세요 (${selectedPhotoIndex + 1} / ${visiblePhotos.length})`}
                                </Text>
                            </View>

                            {dismissedPhotoUrls.size > 0 && (
                                <TouchableOpacity
                                    style={styles.restorePhotosBtn}
                                    onPress={() => setDismissedPhotoUrls(new Set())}
                                >
                                    <Text style={styles.restorePhotosBtnText}>
                                        {`🔄 제외된 사진 복구 (${dismissedPhotoUrls.size}장)`}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <MouseDragHorizontalScroll contentContainerStyle={styles.thumbStrip}>
                            {visiblePhotos.map((url, idx) => {
                                const isSelected = selectedPhotoIndex === idx;
                                const isEnhanced = url.includes('_enhanced_');
                                const isColorized = url.includes('_colorized_');

                                return (
                                    <View key={idx} style={styles.thumbWrapper}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedPhotoIndex(idx);
                                                setEnhancedResultUrl(null);
                                            }}
                                            style={[
                                                styles.thumbBox,
                                                isSelected &&
                                                    (activeMode === 'colorize'
                                                        ? styles.thumbBoxActiveColorize
                                                        : styles.thumbBoxActive),
                                            ]}
                                        >
                                            <Image source={{ uri: url }} style={styles.thumbImage} />
                                            {isEnhanced && (
                                                <View style={styles.enhancedBadgeSmall}>
                                                    <Text style={styles.badgeTextSmall}>화질 개선됨</Text>
                                                </View>
                                            )}
                                            {isColorized && (
                                                <View style={styles.colorizedBadgeSmall}>
                                                    <Text style={styles.badgeTextSmall}>컬러 복원됨</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.thumbDismissBtn}
                                            onPress={(e) => handleDismissPhoto(url, e)}
                                        >
                                            <Text style={styles.thumbDismissBtnText}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </MouseDragHorizontalScroll>

                        {enhancedResultUrl && currentImageUrl ? (
                            <EnhanceCompareViewer
                                currentImageUrl={currentImageUrl}
                                enhancedResultUrl={enhancedResultUrl}
                                mode={activeMode}
                                onKeepOriginal={handleKeepOriginal}
                                onApplyEnhanced={handleApplyEnhanced}
                                onKeepBoth={handleKeepBoth}
                            />
                        ) : (
                            <View style={styles.singleViewContainer}>
                                <View style={styles.singleImageBox}>
                                    {currentImageUrl && (
                                        <Image
                                            source={{ uri: currentImageUrl }}
                                            style={styles.previewImg}
                                            resizeMode="contain"
                                        />
                                    )}
                                    {currentImageUrl?.includes('_enhanced_') && (
                                        <View style={styles.statusBadge}>
                                            <Text style={styles.statusBadgeText}>
                                                ✨ YouCam AI 초고화질 개선본 적용됨
                                            </Text>
                                        </View>
                                    )}
                                    {currentImageUrl?.includes('_colorized_') && (
                                        <View
                                            style={[styles.statusBadge, { backgroundColor: 'rgba(217, 119, 6, 0.9)' }]}
                                        >
                                            <Text style={styles.statusBadgeText}>🎨 YouCam AI 컬러 복원본 적용됨</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.actionBtnRow}>
                                    <TouchableOpacity
                                        style={[
                                            styles.enhanceActionBtn,
                                            activeMode === 'colorize' && styles.colorizeActionBtn,
                                            isProcessing && { opacity: 0.6 },
                                        ]}
                                        onPress={handleProcessSinglePhoto}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? (
                                            <View style={styles.btnLoadingRow}>
                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                                <Text style={styles.actionBtnText}>
                                                    {activeMode === 'colorize'
                                                        ? '흑백 사진 컬러 복원 중...'
                                                        : '초고화질 복원 처리 중...'}
                                                </Text>
                                            </View>
                                        ) : (
                                            <Text style={styles.actionBtnText}>
                                                {activeMode === 'colorize'
                                                    ? '🎨 YouCam AI 흑백 사진 컬러 복원 실행'
                                                    : '⚡ YouCam AI 초고화질 개선 실행'}
                                            </Text>
                                        )}
                                    </TouchableOpacity>

                                    {currentImageUrl && (
                                        <TouchableOpacity
                                            style={styles.dismissActionBtn}
                                            onPress={() => handleDismissPhoto(currentImageUrl)}
                                            disabled={isProcessing}
                                        >
                                            <Text style={styles.dismissActionBtnText}>✕ 닫기</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyIcon}>✨</Text>
                        <Text style={styles.emptyTitle}>선택된 추억 앨범이 없습니다.</Text>
                        <Text style={styles.emptyDesc}>
                            1번 홈 탭에서 사진을 등록하거나, 아래 목록에서 복원할 앨범을 선택해주세요.
                        </Text>
                    </View>
                )}

                <EnhanceAlbumSelector
                    albums={visibleAlbums}
                    selectedId={selectedEnhanceMemory?.id}
                    onSelectAlbum={setSelectedEnhanceMemory}
                    onDismissAlbum={handleDismissAlbum}
                    hasDismissed={dismissedAlbumIds.size > 0}
                    onResetDismissed={() => setDismissedAlbumIds(new Set())}
                />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    contentContainer: { paddingVertical: 40, alignItems: 'center' },
    wrapper: { width: '100%', maxWidth: 960, paddingHorizontal: 20 },
    header: { marginBottom: 24 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    headerSubtitle: { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 16 },
    modeTabContainer: {
        flexDirection: 'row',
        backgroundColor: '#E2E8F0',
        padding: 4,
        borderRadius: 10,
        gap: 6,
    },
    modeTabBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    modeTabBtnActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    modeTabBtnActiveColorize: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    modeTabBtnText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
    modeTabBtnTextActive: { color: '#4F46E5' },
    modeTabBtnTextActiveColorize: { color: '#D97706' },
    mainCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 24,
        marginBottom: 32,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
    },
    albumSelectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        flexWrap: 'wrap',
        gap: 8,
    },
    albumTitleText: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
    albumSubText: { fontSize: 13, color: '#64748B', marginTop: 2 },
    restorePhotosBtn: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        backgroundColor: '#EEF2FF',
        borderRadius: 6,
    },
    restorePhotosBtnText: { fontSize: 12, color: '#4F46E5', fontWeight: '700' },
    thumbStrip: { flexDirection: 'row', marginBottom: 20, gap: 10, paddingVertical: 4 },
    thumbWrapper: { position: 'relative' },
    thumbBox: {
        width: 80,
        height: 60,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#E2E8F0',
    },
    thumbBoxActive: { borderColor: '#6366F1' },
    thumbBoxActiveColorize: { borderColor: '#D97706' },
    thumbImage: { width: '100%', height: '100%' },
    thumbDismissBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#64748B',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        zIndex: 10,
    },
    thumbDismissBtnText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
    enhancedBadgeSmall: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: '#6366F1',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    colorizedBadgeSmall: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: '#D97706',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    badgeTextSmall: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
    singleViewContainer: { alignItems: 'center' },
    singleImageBox: {
        width: '100%',
        height: 380,
        backgroundColor: '#0F172A',
        borderRadius: 12,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        position: 'relative',
    },
    previewImg: { width: '100%', height: '100%' },
    statusBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: 'rgba(99, 102, 241, 0.9)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    actionBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
    enhanceActionBtn: {
        flex: 1,
        backgroundColor: '#4F46E5',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    colorizeActionBtn: {
        backgroundColor: '#D97706',
    },
    dismissActionBtn: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dismissActionBtnText: { color: '#475569', fontSize: 14, fontWeight: '700' },
    btnLoadingRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    emptyCard: {
        backgroundColor: '#FFFFFF',
        padding: 40,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 32,
    },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
    emptyDesc: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 },
});
