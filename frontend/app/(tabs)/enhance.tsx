// frontend/app/(tabs)/enhance.tsx
import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    useWindowDimensions,
} from 'react-native';
import { useMemory } from '../../context/MemoryContext';
import { MouseDragHorizontalScroll } from '../../features/backup/MouseDragHorizontalScroll';
import { EnhanceCompareViewer } from '../../features/enhance/EnhanceCompareViewer';
import { EnhanceAlbumSelector } from '../../features/enhance/EnhanceAlbumSelector';
import { MemoryAppHeader } from '../../components/MemoryAppHeader';
import { MemoryPageHeader } from '../../components/MemoryPageHeader';
import { memoryColors, memoryLayout } from '../../constants/memoryTheme';

const BACKEND_URL = 'http://localhost:8000';

export default function EnhanceScreen() {
    const { width } = useWindowDimensions();
    const isNarrow = width < 940;
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
        <View style={styles.screen}>
            <MemoryAppHeader />
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                <View style={[styles.wrapper, isNarrow && styles.wrapperNarrow]}>
                    <MemoryPageHeader
                        title="오래된 사진을 선명하게, 다시 만나세요"
                        subtitle="YouCam AI 사진 복원실 · 초고화질 개선과 흑백 사진 컬러 복원"
                    >
                        <View style={styles.modeTabContainer}>
                            <TouchableOpacity
                                style={[styles.modeTabBtn, activeMode === 'enhance' && styles.modeTabBtnActive]}
                                onPress={() => setActiveMode('enhance')}
                            >
                                <Text
                                    style={[
                                        styles.modeTabBtnText,
                                        activeMode === 'enhance' && styles.modeTabBtnTextActive,
                                    ]}
                                >
                                    ⚡ 초고화질 개선 (Super Resolution)
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.modeTabBtn,
                                    activeMode === 'colorize' && styles.modeTabBtnActiveColorize,
                                ]}
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
                    </MemoryPageHeader>

                    <View style={[styles.workspace, isNarrow && styles.workspaceNarrow]}>
                        <View style={[styles.selectorColumn, isNarrow && styles.selectorColumnNarrow]}>
                            <EnhanceAlbumSelector
                                albums={visibleAlbums}
                                selectedId={selectedEnhanceMemory?.id}
                                onSelectAlbum={setSelectedEnhanceMemory}
                                onDismissAlbum={handleDismissAlbum}
                                hasDismissed={dismissedAlbumIds.size > 0}
                                onResetDismissed={() => setDismissedAlbumIds(new Set())}
                                vertical={!isNarrow}
                            />
                        </View>

                        <View style={styles.viewerColumn}>
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
                                                        style={[
                                                            styles.statusBadge,
                                                            { backgroundColor: 'rgba(217, 119, 6, 0.9)' },
                                                        ]}
                                                    >
                                                        <Text style={styles.statusBadgeText}>
                                                            🎨 YouCam AI 컬러 복원본 적용됨
                                                        </Text>
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
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: memoryColors.canvas },
    container: { flex: 1, backgroundColor: memoryColors.canvas },
    contentContainer: { paddingBottom: 64, alignItems: 'center' },
    wrapper: {
        width: '100%',
        maxWidth: 1440,
        paddingHorizontal: memoryLayout.desktopPadding,
        paddingTop: 28,
    },
    wrapperNarrow: {
        paddingHorizontal: memoryLayout.mobilePadding,
        paddingTop: 22,
    },
    workspace: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
    workspaceNarrow: { flexDirection: 'column' },
    selectorColumn: { width: 300, flexShrink: 0 },
    selectorColumnNarrow: { width: '100%' },
    viewerColumn: { flex: 1, minWidth: 0, width: '100%' },
    modeTabContainer: {
        flexDirection: 'row',
        gap: 12,
        width: 480,
        maxWidth: '100%',
        marginTop: 16,
    },
    modeTabBtn: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: memoryColors.surface,
        borderWidth: 1,
        borderColor: memoryColors.border,
    },
    modeTabBtnActive: {
        backgroundColor: memoryColors.brand,
        borderColor: memoryColors.brand,
    },
    modeTabBtnActiveColorize: {
        backgroundColor: memoryColors.brand,
        borderColor: memoryColors.brand,
    },
    modeTabBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: memoryColors.textSecondary,
    },
    modeTabBtnTextActive: { color: memoryColors.surface },
    modeTabBtnTextActiveColorize: { color: memoryColors.surface },
    mainCard: {
        backgroundColor: memoryColors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: memoryColors.border,
        padding: 24,
    },
    albumSelectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        flexWrap: 'wrap',
        gap: 8,
    },
    albumTitleText: {
        fontSize: 20,
        lineHeight: 30,
        fontWeight: '700',
        color: memoryColors.text,
    },
    albumSubText: { fontSize: 13, color: memoryColors.textMuted, marginTop: 2 },
    restorePhotosBtn: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        backgroundColor: memoryColors.brandLight,
        borderRadius: 6,
    },
    restorePhotosBtnText: {
        fontSize: 12,
        color: memoryColors.brand,
        fontWeight: '700',
    },
    thumbStrip: {
        flexDirection: 'row',
        marginBottom: 20,
        gap: 10,
        paddingVertical: 4,
    },
    thumbWrapper: { position: 'relative' },
    thumbBox: {
        width: 80,
        height: 60,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#E2E8F0',
    },
    thumbBoxActive: { borderColor: memoryColors.brand },
    thumbBoxActiveColorize: { borderColor: memoryColors.brand },
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
        height: 430,
        backgroundColor: memoryColors.subtle,
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
        backgroundColor: memoryColors.brand,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    colorizeActionBtn: {
        backgroundColor: memoryColors.brand,
    },
    dismissActionBtn: {
        backgroundColor: memoryColors.surface,
        borderWidth: 1,
        borderColor: memoryColors.border,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dismissActionBtnText: {
        color: memoryColors.textSecondary,
        fontSize: 14,
        fontWeight: '700',
    },
    btnLoadingRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    actionBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    emptyCard: {
        backgroundColor: memoryColors.surface,
        padding: 40,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: memoryColors.border,
    },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: memoryColors.text,
        marginBottom: 6,
    },
    emptyDesc: {
        fontSize: 13,
        color: memoryColors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
});
