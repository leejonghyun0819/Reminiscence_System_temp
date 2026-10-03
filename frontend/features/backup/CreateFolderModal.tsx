// frontend/features/CreateFolderModal.tsx
import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

interface CreateFolderModalProps {
    visible: boolean;
    onClose: () => void;
    onCreate: (folderName: string) => Promise<void>;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({ visible, onClose, onCreate }) => {
    const [folderName, setFolderName] = useState('');

    const handleConfirm = async () => {
        const trimmed = folderName.trim();
        if (!trimmed) return;
        await onCreate(trimmed);
        setFolderName('');
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.smallModalOverlay}>
                <View style={styles.smallModalCard}>
                    <Text style={styles.smallModalTitle}>📁 새 폴더 만들기</Text>
                    <Text style={styles.smallModalSub}>
                        여행 일정이나 테마별 폴더를 입력해주세요 (예: 오사카 3박4일, 1일차 교토 등)
                    </Text>
                    <TextInput
                        style={styles.smallModalInput}
                        placeholder="폴더 이름 입력..."
                        value={folderName}
                        onChangeText={setFolderName}
                        autoFocus
                    />
                    <View style={styles.smallModalBtnRow}>
                        <TouchableOpacity style={styles.smallModalCancelBtn} onPress={onClose}>
                            <Text style={styles.smallModalCancelBtnText}>취소</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.smallModalConfirmBtn} onPress={handleConfirm}>
                            <Text style={styles.smallModalConfirmBtnText}>생성하기</Text>
                        </TouchableOpacity>
                    </View>
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
    smallModalInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
    },
    smallModalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
    smallModalCancelBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
    },
    smallModalCancelBtnText: { color: '#475569', fontSize: 13, fontWeight: '700' },
    smallModalConfirmBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        backgroundColor: '#F5933C',
        alignItems: 'center',
    },
    smallModalConfirmBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
