import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
    MemoryContextData,
    MemoryOwner,
    MemoryPurpose,
    MEMORY_OWNER_LABELS,
    MEMORY_PURPOSE_LABELS,
} from '../types/memoryContext';
import { memoryColors, memoryFontFamily } from '../constants/memoryTheme';

interface MemoryContextFormProps {
    value: MemoryContextData;
    onChange: (nextValue: MemoryContextData) => void;
    disabled?: boolean;
}

const MEMORY_OWNERS: MemoryOwner[] = ['self', 'family', 'unknown'];
const MEMORY_PURPOSES: MemoryPurpose[] = ['personal_record', 'family_archive', 'gift', 'organize'];

export function MemoryContextForm({ value, onChange, disabled = false }: MemoryContextFormProps) {
    const updateField = <Key extends keyof MemoryContextData>(key: Key, fieldValue: MemoryContextData[Key]) => {
        onChange({
            ...value,
            [key]: fieldValue,
        });
    };

    return (
        <View style={styles.container}>
            <View style={styles.headingRow}>
                <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>기억 단서</Text>
                </View>
                <View style={styles.headingTextArea}>
                    <Text style={styles.title}>AI가 길을 잃지 않도록 먼저 알려주세요</Text>
                    <Text style={styles.description}>
                        모르는 항목은 비워도 됩니다. 입력한 사실은 우선 반영하고, 비어 있는 부분은 사진별 질문으로
                        확인합니다.
                    </Text>
                </View>
            </View>

            <Text style={styles.label}>누구의 기억인가요?</Text>
            <View style={styles.chipRow}>
                {MEMORY_OWNERS.map((owner) => {
                    const selected = value.memoryOwner === owner;
                    return (
                        <TouchableOpacity
                            key={owner}
                            style={[styles.chip, selected && styles.chipSelected]}
                            onPress={() => updateField('memoryOwner', owner)}
                            disabled={disabled}
                            accessibilityRole="button"
                            accessibilityState={{ selected, disabled }}
                        >
                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                {MEMORY_OWNER_LABELS[owner]}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <Text style={styles.label}>이 노트를 만드는 목적은 무엇인가요?</Text>
            <View style={styles.chipRow}>
                {MEMORY_PURPOSES.map((purpose) => {
                    const selected = value.purpose === purpose;
                    return (
                        <TouchableOpacity
                            key={purpose}
                            style={[styles.chip, selected && styles.chipSelected]}
                            onPress={() => updateField('purpose', purpose)}
                            disabled={disabled}
                            accessibilityRole="button"
                            accessibilityState={{ selected, disabled }}
                        >
                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                {MEMORY_PURPOSE_LABELS[purpose]}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.inputGrid}>
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>대략적인 시기</Text>
                    <TextInput
                        style={styles.input}
                        value={value.approximateTime || ''}
                        onChangeText={(text) => updateField('approximateTime', text)}
                        placeholder="예: 2018년 여름, 초등학교 저학년 무렵"
                        placeholderTextColor="#94A3B8"
                        maxLength={120}
                        editable={!disabled}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>장소 단서</Text>
                    <TextInput
                        style={styles.input}
                        value={value.placeHint || ''}
                        onChangeText={(text) => updateField('placeHint', text)}
                        placeholder="예: 스페인 말라가, 할머니 집 마당"
                        placeholderTextColor="#94A3B8"
                        maxLength={160}
                        editable={!disabled}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>함께한 사람</Text>
                    <TextInput
                        style={styles.input}
                        value={value.peopleHint || ''}
                        onChangeText={(text) => updateField('peopleHint', text)}
                        placeholder="예: 어머니와 동생, 대학 친구 두 명"
                        placeholderTextColor="#94A3B8"
                        maxLength={240}
                        editable={!disabled}
                    />
                </View>
            </View>

            <Text style={styles.inputLabel}>사진을 고른 이유나 기억나는 사건</Text>
            <TextInput
                style={[styles.input, styles.multilineInput]}
                value={value.additionalContext || ''}
                onChangeText={(text) => updateField('additionalContext', text)}
                placeholder="예: 아버지가 처음 사준 카메라로 찍은 여행이고, 항구에서 길을 잃었던 일이 기억나요."
                placeholderTextColor="#94A3B8"
                maxLength={1200}
                multiline
                textAlignVertical="top"
                editable={!disabled}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 18,
    },
    headingRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 18,
    },
    stepBadge: {
        backgroundColor: memoryColors.brandLight,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    stepBadgeText: {
        color: memoryColors.brand,
        fontSize: 12,
        fontWeight: '700',
        fontFamily: memoryFontFamily,
    },
    headingTextArea: {
        flex: 1,
    },
    title: {
        color: memoryColors.text,
        fontSize: 20,
        lineHeight: 30,
        fontWeight: '700',
        fontFamily: memoryFontFamily,
    },
    description: {
        color: memoryColors.textMuted,
        fontSize: 12,
        lineHeight: 20,
        marginTop: 4,
        fontFamily: memoryFontFamily,
    },
    label: {
        color: memoryColors.text,
        fontSize: 13,
        lineHeight: 20,
        fontWeight: '500',
        marginBottom: 8,
        fontFamily: memoryFontFamily,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    chip: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: memoryColors.border,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    chipSelected: {
        backgroundColor: memoryColors.brandLight,
        borderColor: memoryColors.brandLight,
    },
    chipText: {
        color: memoryColors.textSecondary,
        fontSize: 12,
        fontWeight: '500',
        fontFamily: memoryFontFamily,
    },
    chipTextSelected: {
        color: memoryColors.brand,
        fontWeight: '700',
    },
    inputGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 14,
    },
    inputGroup: {
        flexGrow: 1,
        flexBasis: 190,
    },
    inputLabel: {
        color: memoryColors.textSecondary,
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 6,
        fontFamily: memoryFontFamily,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: memoryColors.border,
        borderRadius: 8,
        paddingHorizontal: 11,
        paddingVertical: 9,
        color: memoryColors.text,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: memoryFontFamily,
    },
    multilineInput: {
        minHeight: 48,
    },
});
