// frontend/app/(tabs)/_layout.tsx
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function TabLayout() {
    const colorScheme = useColorScheme();
    const router = useRouter();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme].tint,
                headerShown: useClientOnlyValue(false, true),
                headerRight: () => (
                    <TouchableOpacity style={styles.storageBtn} onPress={() => router.push('/backup')}>
                        <Text style={styles.storageBtnText}>📦 백업 보관함</Text>
                    </TouchableOpacity>
                ),
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: '추억 수집',
                    tabBarIcon: ({ color }) => (
                        <SymbolView
                            name={{
                                ios: 'photo.on.rectangle.angled',
                                android: 'photo_library',
                                web: 'photo_library',
                            }}
                            tintColor={color}
                            size={24}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="enhance"
                options={{
                    title: '화질 개선',
                    tabBarIcon: ({ color }) => (
                        <SymbolView
                            name={{
                                ios: 'wand.and.stars',
                                android: 'auto_fix_high',
                                web: 'auto_fix_high',
                            }}
                            tintColor={color}
                            size={24}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="generate"
                options={{
                    title: '노트 생성',
                    tabBarIcon: ({ color }) => (
                        <SymbolView
                            name={{
                                ios: 'square.and.pencil',
                                android: 'edit_note',
                                web: 'edit_note',
                            }}
                            tintColor={color}
                            size={24}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    storageBtn: {
        marginRight: 16,
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#F4F4F5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E4E4E7',
    },
    storageBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#3F3F46',
    },
});
