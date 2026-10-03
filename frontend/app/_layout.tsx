// frontend/app/_layout.tsx
import { useEffect } from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { MemoryProvider } from '../context/MemoryContext';
import { Platform } from 'react-native';

export default function RootLayout() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // 🌟 웹 브라우저 새로고침 시 무조건 메인 탭(index) 화면으로 리셋
        if (Platform.OS === 'web') {
            document.title = 'Memory-Tracer';
        }
    }, []);

    return (
        <MemoryProvider>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                    name="modal"
                    options={{
                        presentation: 'modal',
                        headerShown: false,
                    }}
                />
            </Stack>
        </MemoryProvider>
    );
}
