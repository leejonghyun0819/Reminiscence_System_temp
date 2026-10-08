import React from 'react';
import { ScrollView, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { memoryColors, memoryFontFamily, memoryLayout } from '../constants/memoryTheme';

type AppRoute = '/' | '/(tabs)/enhance' | '/(tabs)/generate' | '/backup';

const NAV_ITEMS: { label: string; route: AppRoute; match: string }[] = [
    { label: '추억 수집', route: '/', match: '/' },
    { label: '화질 개선', route: '/(tabs)/enhance', match: '/enhance' },
    { label: '노트 생성', route: '/(tabs)/generate', match: '/generate' },
];

export function MemoryAppHeader() {
    const router = useRouter();
    const pathname = usePathname();
    const { width } = useWindowDimensions();
    const compact = width < 760;

    if (Platform.OS !== 'web') return null;

    const isActive = (match: string) => {
        if (match === '/') return pathname === '/' || pathname === '/index';
        return pathname.endsWith(match);
    };

    return (
        <View style={styles.header}>
            <View style={[styles.inner, compact && styles.innerCompact]}>
                <TouchableOpacity onPress={() => router.push('/')} activeOpacity={0.75}>
                    <Text style={styles.logo}>Reminiscence Note</Text>
                </TouchableOpacity>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.navScrollContent}
                    style={styles.navScroll}
                >
                    <View style={styles.navGroup}>
                        {NAV_ITEMS.map((item) => {
                            const active = isActive(item.match);
                            return (
                                <TouchableOpacity
                                    key={item.route}
                                    style={[styles.navButton, active && styles.navButtonActive]}
                                    onPress={() => router.push(item.route)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <TouchableOpacity
                        style={[styles.backupButton, pathname === '/backup' && styles.backupButtonActive]}
                        onPress={() => router.push('/backup')}
                        activeOpacity={0.75}
                    >
                        <Text style={[styles.backupText, pathname === '/backup' && styles.backupTextActive]}>
                            보관함
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        height: memoryLayout.headerHeight,
        backgroundColor: memoryColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: memoryColors.subtle,
        justifyContent: 'center',
        zIndex: 20,
    },
    inner: {
        width: '100%',
        maxWidth: 1440,
        alignSelf: 'center',
        paddingHorizontal: memoryLayout.desktopPadding,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 28,
    },
    innerCompact: {
        paddingHorizontal: memoryLayout.mobilePadding,
        gap: 16,
    },
    logo: {
        color: memoryColors.brand,
        fontSize: 20,
        lineHeight: 28,
        fontWeight: '700',
        fontFamily: memoryFontFamily,
    },
    navScroll: { flex: 1 },
    navScrollContent: { alignItems: 'center', gap: 24 },
    navGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    navButton: {
        minHeight: 34,
        paddingHorizontal: 14,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: memoryColors.subtle,
    },
    navButtonActive: { backgroundColor: memoryColors.brandLight },
    navText: {
        color: memoryColors.textSecondary,
        fontSize: 13,
        lineHeight: 20,
        fontWeight: '500',
        fontFamily: memoryFontFamily,
    },
    navTextActive: { color: memoryColors.brand, fontWeight: '700' },
    backupButton: {
        minWidth: 164,
        minHeight: 40,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: memoryColors.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: memoryColors.surface,
    },
    backupButtonActive: {
        borderColor: memoryColors.brandBorder,
        backgroundColor: memoryColors.brandLight,
    },
    backupText: {
        color: memoryColors.textSecondary,
        fontSize: 13,
        fontWeight: '500',
        fontFamily: memoryFontFamily,
    },
    backupTextActive: { color: memoryColors.brand, fontWeight: '700' },
});
