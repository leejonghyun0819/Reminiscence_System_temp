// frontend/features/index/DroppableAlbumCard.tsx
import React, { useState } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { MemoryItem } from '../../context/MemoryContext';

interface DroppableAlbumCardProps {
    item: MemoryItem;
    isSelected?: boolean;
    onDropFiles?: (targetItem: MemoryItem, files: File[]) => void;
    children: React.ReactNode;
}

export const DroppableAlbumCard: React.FC<DroppableAlbumCardProps> = ({ item, isSelected, onDropFiles, children }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = (e: any) => {
        // 필수: 기본 동작(새 탭 열기)을 막아야 drop 이벤트가 발생함
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'copy';
        }
        if (!isDragOver) {
            setIsDragOver(true);
        }
    };

    const handleDragEnter = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        // 부모 div를 벗어났을 때만 해제
        if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget)) {
            setIsDragOver(false);
        }
    };

    const handleDrop = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files) as File[];
            if (onDropFiles) {
                onDropFiles(item, filesArray);
            }
        }
    };

    if (Platform.OS === 'web') {
        return (
            // @ts-ignore
            <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    width: '100%',
                    position: 'relative',
                    boxSizing: 'border-box',
                }}
            >
                <View style={[styles.card, isSelected && styles.cardSelected, isDragOver && styles.cardDragOver]}>
                    {children}

                    {/* 드래그 중일 때 자식 컴포넌트들의 마우스 간섭을 100% 차단하고 시각 피드백을 주는 오버레이 */}
                    {isDragOver && (
                        // @ts-ignore
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(2, 132, 199, 0.08)',
                                border: '2px dashed #0284C7',
                                borderRadius: 14,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none',
                                zIndex: 999,
                            }}
                        >
                            <span style={{ fontSize: 16, fontWeight: 700, color: '#0284C7' }}>
                                📥 여기에 사진을 놓으세요!
                            </span>
                        </div>
                    )}
                </View>
            </div>
        );
    }

    return <View style={styles.card}>{children}</View>;
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 18,
        position: 'relative',
        marginBottom: 16,
    },
    cardSelected: {
        borderColor: '#0284C7',
        backgroundColor: '#F8FAFC',
    },
    cardDragOver: {
        borderColor: '#0284C7',
        backgroundColor: '#F0F9FF',
    },
});
