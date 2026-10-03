// frontend/features/index/EditMemoryModal.tsx
import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { MemoryItem, useMemory } from '../../context/MemoryContext';

interface EditMemoryModalProps {
    visible: boolean;
    album: MemoryItem | null;
    onClose: () => void;
    onSaveSuccess?: () => void;
}

export const EditMemoryModal: React.FC<EditMemoryModalProps> = ({ visible, album, onClose, onSaveSuccess }) => {
    const { updateMemoryItem } = useMemory();

    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('');
    const [yearEstimate, setYearEstimate] = useState('');
    const [description, setDescription] = useState('');
    const [storyCaption, setStoryCaption] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (album) {
            setTitle(album.analysis?.title || '');
            setLocation(album.analysis?.location || '');
            setYearEstimate(album.analysis?.yearEstimate || '');
            setDescription(album.analysis?.description || '');
            setStoryCaption(album.analysis?.storyCaption || '');
        }
    }, [album, visible]);

    if (!album) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateMemoryItem(album.id, {
                title,
                location,
                yearEstimate,
                description,
                storyCaption,
            });
            alert('앨범 정보가 수정되었습니다.');
            if (onSaveSuccess) onSaveSuccess();
            onClose();
        } catch (e: any) {
            alert(`수정 실패: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.modalCard}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>✏️ 추억 정보 상세 편집</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Text style={styles.closeBtnText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.body}>
                        <Text style={styles.label}>제목</Text>
                        <TextInput
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="추억 앨범 제목"
                        />

                        <View style={styles.rowInputs}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>장소</Text>
                                <TextInput
                                    style={styles.input}
                                    value={location}
                                    onChangeText={setLocation}
                                    placeholder="예: 경주 불국사"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>시기 (연도/계절)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={yearEstimate}
                                    onChangeText={setYearEstimate}
                                    placeholder="예: 1985년 가을"
                                />
                            </View>
                        </View>

                        <Text style={styles.label}>상황 요약</Text>
                        <TextInput
                            style={[styles.input, styles.multilineInput]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="사진 속 상황 요약"
                            multiline
                        />

                        <Text style={styles.label}>회상록 / 에세이</Text>
                        <TextInput
                            style={[styles.input, styles.multilineInput, { height: 110 }]}
                            value={storyCaption}
                            onChangeText={setStoryCaption}
                            placeholder="기억 에세이"
                            multiline
                        />
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSaving}>
                            <Text style={styles.cancelBtnText}>취소</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
                            {isSaving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.saveBtnText}>저장하기</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 620,
        maxHeight: '90%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
        paddingBottom: 10,
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    closeBtn: { padding: 6 },
    closeBtnText: { fontSize: 16, color: '#64748B', fontWeight: '700' },
    body: { marginVertical: 6 },
    label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6, marginTop: 10 },
    input: {
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 14,
        color: '#0F172A',
        backgroundColor: '#F8FAFC',
    },
    rowInputs: { flexDirection: 'row', gap: 12 },
    multilineInput: { height: 75, textAlignVertical: 'top' },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 16,
        borderTopWidth: 1,
        borderColor: '#E2E8F0',
        paddingTop: 12,
    },
    cancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
    },
    cancelBtnText: { color: '#475569', fontWeight: '700' },
    saveBtn: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#4F46E5',
    },
    saveBtnText: { color: '#FFFFFF', fontWeight: '700' },
});
