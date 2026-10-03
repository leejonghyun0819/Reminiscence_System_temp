import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
    Image,
} from 'react-native';
import { MemoryItem } from '../context/MemoryContext';

interface MemoryEditDetailModalProps {
    visible: boolean;
    memory: MemoryItem | null;
    onClose: () => void;
    onSaveSuccess: (updatedMemory: MemoryItem) => void;
}

const BACKEND_URL = 'http://localhost:8000';

export function MemoryEditDetailModal({ visible, memory, onClose, onSaveSuccess }: MemoryEditDetailModalProps) {
    const [isSaving, setIsSaving] = useState(false);

    // 편집 폼 상태
    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('');
    const [yearEstimate, setYearEstimate] = useState('');
    const [description, setDescription] = useState('');
    const [remembered, setRemembered] = useState('');
    const [reflection, setReflection] = useState('');

    useEffect(() => {
        if (memory) {
            setTitle(memory.curatedNote?.title || memory.analysis?.title || '');
            setLocation(memory.analysis?.location || '');
            setYearEstimate(memory.analysis?.yearEstimate || '');
            setDescription(memory.curatedNote?.sceneDescription || memory.analysis?.description || '');
            setRemembered(memory.curatedNote?.remembered || '');
            setReflection(memory.curatedNote?.reflection || '');
        }
    }, [memory]);

    if (!memory) return null;

    const isChildhood = memory.mode === 'childhood' || !!memory.curatedNote;

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert('알림', '추억 제목을 입력해주세요.');
            return;
        }

        setIsSaving(true);
        try {
            console.log(`📡 [메모리 상세 수정 요청 시작] Memory ID: ${memory.id}`);

            // payload 구성
            const payload: any = {
                title: title.trim(),
                location: location.trim(),
                yearEstimate: yearEstimate.trim(),
                description: description.trim(),
            };

            // 유년시절(큐레이션 노트) 모드인 경우 하위 구조도 최신화
            if (isChildhood) {
                payload.curatedNote = {
                    ...(memory.curatedNote || {}),
                    title: title.trim(),
                    sceneDescription: description.trim(),
                    remembered: remembered.trim(),
                    reflection: reflection.trim(),
                };
                payload.storyCaption = `${remembered.trim()}\n\n${reflection.trim()}`;
            } else {
                payload.storyCaption = memory.analysis?.storyCaption || '';
            }

            const res = await fetch(`${BACKEND_URL}/api/memories/${memory.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || '저장에 실패했습니다.');
            }

            const resData = await res.json();
            console.log(`✅ [메모리 상세 수정 성공] Server Response:`, resData);

            // 로컬 상태 동기화용 객체 조합
            const updated: MemoryItem = {
                ...memory,
                curatedNote: payload.curatedNote || memory.curatedNote,
                analysis: {
                    ...(memory.analysis || {}),
                    title: payload.title,
                    location: payload.location,
                    yearEstimate: payload.yearEstimate,
                    description: payload.description,
                    storyCaption: payload.storyCaption,
                },
            };

            Alert.alert('성공', '추억 정보가 수정되었습니다.');
            onSaveSuccess(updated);
            onClose();
        } catch (err: any) {
            console.error(`❌ [메모리 수정 오류]:`, err);
            Alert.alert('수정 실패', err.message || '서버 통신 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* 상단 헤더 */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>✏️ 추억 상세 보기 및 편집</Text>
                            <Text style={styles.subtitle}>사진 속 정보와 기록된 내용을 직접 확인하고 수정합니다.</Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={isSaving}>
                            <Text style={styles.closeBtnText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
                        {/* 사진 미리보기 */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScroll}>
                            {memory.imageUrls?.map((url, i) => (
                                <Image key={i} source={{ uri: url }} style={styles.thumbImage} />
                            ))}
                        </ScrollView>

                        {/* 기본 정보 폼 */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>제목</Text>
                            <TextInput
                                style={styles.input}
                                value={title}
                                onChangeText={setTitle}
                                placeholder="추억의 제목을 입력하세요"
                                placeholderTextColor="#94A3B8"
                            />
                        </View>

                        <View style={styles.rowGroup}>
                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.label}>위치 / 장소</Text>
                                <TextInput
                                    style={styles.input}
                                    value={location}
                                    onChangeText={setLocation}
                                    placeholder="예: 우리 집 안방, 놀이공원"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            <View style={[styles.inputGroup, { flex: 1 }]}>
                                <Text style={styles.label}>추정 시기 / 연대</Text>
                                <TextInput
                                    style={styles.input}
                                    value={yearEstimate}
                                    onChangeText={setYearEstimate}
                                    placeholder="예: 1990년대 초반"
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                                {isChildhood ? '[그날의 장면] 물리적 공간 및 단서 요약' : '기록 설명'}
                            </Text>
                            <TextInput
                                style={[styles.input, styles.multilineInput]}
                                value={description}
                                onChangeText={setDescription}
                                placeholder="사진 속 배경이나 장면에 대한 묘사"
                                placeholderTextColor="#94A3B8"
                                multiline
                            />
                        </View>

                        {/* 큐레이션 노트 확장 필드 (유년시절 모드 전용) */}
                        {isChildhood && (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>[나의 기억] 사용자가 기억해낸 내용</Text>
                                    <TextInput
                                        style={[styles.input, styles.multilineInput]}
                                        value={remembered}
                                        onChangeText={setRemembered}
                                        placeholder="인터뷰를 통해 떠올린 구체적인 기억"
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>[지금 다시 바라보니] 현재 시점의 성찰/소회</Text>
                                    <TextInput
                                        style={[styles.input, styles.multilineInput]}
                                        value={reflection}
                                        onChangeText={setReflection}
                                        placeholder="현재 어른의 시선에서 느끼는 감정이나 회고"
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                    />
                                </View>
                            </>
                        )}
                    </ScrollView>

                    {/* 하단 액션 버튼 */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={isSaving}>
                            <Text style={styles.cancelBtnText}>취소</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
                            {isSaving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.saveBtnText}>저장 완료</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 680,
        maxHeight: '90%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        paddingBottom: 14,
        marginBottom: 16,
    },
    title: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    subtitle: { fontSize: 12, color: '#64748B', marginTop: 4 },
    closeBtn: {
        padding: 6,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtnText: { fontSize: 14, fontWeight: '800', color: '#64748B' },
    scrollBody: { flexShrink: 1, marginBottom: 16 },
    thumbScroll: { flexDirection: 'row', marginBottom: 16 },
    thumbImage: { width: 72, height: 72, borderRadius: 8, marginRight: 8, backgroundColor: '#E2E8F0' },
    rowGroup: { flexDirection: 'row', gap: 12 },
    inputGroup: { marginBottom: 14 },
    label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 13,
        color: '#0F172A',
    },
    multilineInput: {
        minHeight: 64,
        textAlignVertical: 'top',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 14,
    },
    cancelBtn: {
        backgroundColor: '#F1F5F9',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 8,
    },
    cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    saveBtn: {
        backgroundColor: '#0284C7',
        paddingVertical: 10,
        paddingHorizontal: 22,
        borderRadius: 8,
        minWidth: 88,
        alignItems: 'center',
    },
    saveBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
