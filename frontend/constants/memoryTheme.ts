import { Platform } from 'react-native';

export const memoryColors = {
    canvas: '#F8FAFC',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#64748B',
    textFaint: '#94A3B8',
    subtle: '#F1F5F9',
    brand: '#0284C7',
    brandDark: '#0369A1',
    brandLight: '#F0F9FF',
    brandBorder: '#BAE6FD',
    danger: '#EF4444',
    dangerLight: '#FEF2F2',
    success: '#059669',
} as const;

export const memoryLayout = {
    maxWidth: 1360,
    desktopPadding: 40,
    mobilePadding: 20,
    headerHeight: 76,
} as const;

export const memoryFontFamily = Platform.select({
    web: '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
    default: undefined,
});
