import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { memoryColors, memoryFontFamily } from '../constants/memoryTheme';

interface MemoryPageHeaderProps {
    title: string;
    subtitle: string;
    children?: React.ReactNode;
}

export function MemoryPageHeader({ title, subtitle, children }: MemoryPageHeaderProps) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { paddingBottom: 24 },
    title: {
        color: memoryColors.text,
        fontSize: 28,
        lineHeight: 40,
        fontWeight: '700',
        fontFamily: memoryFontFamily,
    },
    subtitle: {
        color: memoryColors.textMuted,
        fontSize: 14,
        lineHeight: 24,
        fontFamily: memoryFontFamily,
        marginTop: 2,
    },
});
