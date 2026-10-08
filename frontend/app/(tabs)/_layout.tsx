// frontend/app/(tabs)/_layout.tsx
import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function TabLayout() {
    const colorScheme = useColorScheme();
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme].tint,
                headerShown: false,
                tabBarStyle: Platform.OS === 'web' ? { display: 'none' } : undefined,
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
