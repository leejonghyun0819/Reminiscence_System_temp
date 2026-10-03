// frontend/features/MoveFolderModal.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

interface MoveFolderModalProps {
    visible: boolean;
    title: string;
    subtitle: string;
    currentFolder?: string;
    folders: string[];
    onClose: () => void;
    onSelectFolder: (folderName: string) => void;
}

export const MoveFolderModal: React.FC<MoveFolderModalProps> = ({
    visible,
    title,
    subtitle,
    currentFolder,
    folders,
    onClose,
    onSelectFolder,
}) => {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.smallModalOverlay}>
                <View style={styles.smallModalCard}>
                    <Text style={styles.smallModalTitle}>{title}</Text>
                    <Text style={styles.smallModalSub}>{subtitle}</Text>

                    <ScrollView style={{ maxHeight: 220, marginVertical: 12 }}>
                        <TouchableOpacity
                            style={[
                                styles.folderSelectItem,
                                currentFolder === '미분류' && styles.folderSelectItemActive,
                            ]}
                            onPress={() => onSelectFolder('미분류')}
                        >
                            <Text style={styles.folderSelectItemText}>📄 미분류 (기본)</Text>
                        </TouchableOpacity>

                        {folders.map((f) => (
                            <TouchableOpacity
                                key={f}
                                style={[styles.folderSelectItem, currentFolder === f && styles.folderSelectItemActive]}
                                onPress={() => onSelectFolder(f)}
                            >
                                <Text style={styles.folderSelectItemText}>📁 {f}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <TouchableOpacity style={styles.smallModalCancelBtn} onPress={onClose}>
                        <Text style={styles.smallModalCancelBtnText}>닫기</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    smallModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    smallModalCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 20,
        gap: 12,
    },
    smallModalTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    smallModalSub: { fontSize: 12, color: '#64748B' },
    folderSelectItem: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 6,
        backgroundColor: '#F8FAFC',
    },
    folderSelectItemActive: { borderColor: '#F5933C', backgroundColor: '#FEF3C7' },
    folderSelectItemText: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
    smallModalCancelBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
    },
    smallModalCancelBtnText: { color: '#475569', fontSize: 13, fontWeight: '700' },
});
