export type MemoryOwner = 'self' | 'family' | 'unknown';

export type MemoryPurpose =
    | 'personal_record'
    | 'family_archive'
    | 'gift'
    | 'organize';

export interface MemoryContextData {
    memoryOwner?: MemoryOwner;
    purpose?: MemoryPurpose;
    approximateTime?: string;
    placeHint?: string;
    peopleHint?: string;
    additionalContext?: string;
}

export const DEFAULT_MEMORY_CONTEXT: MemoryContextData = {
    memoryOwner: 'self',
    purpose: 'personal_record',
    approximateTime: '',
    placeHint: '',
    peopleHint: '',
    additionalContext: '',
};

export const MEMORY_OWNER_LABELS: Record<MemoryOwner, string> = {
    self: '내가 겪은 기억',
    family: '가족에게 들은 기억',
    unknown: '아직 잘 모름',
};

export const MEMORY_PURPOSE_LABELS: Record<MemoryPurpose, string> = {
    personal_record: '나를 위한 기록',
    family_archive: '가족과 보관',
    gift: '누군가에게 선물',
    organize: '사진 정리',
};

export function hasMeaningfulMemoryContext(context?: MemoryContextData): boolean {
    if (!context) return false;

    return Boolean(
        context.memoryOwner ||
            context.purpose ||
            context.approximateTime?.trim() ||
            context.placeHint?.trim() ||
            context.peopleHint?.trim() ||
            context.additionalContext?.trim(),
    );
}
