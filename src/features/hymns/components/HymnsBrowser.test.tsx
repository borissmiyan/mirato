import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HymnsBrowser } from './HymnsBrowser';

vi.mock('react-i18next', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, fallback: string) => fallback,
            i18n: { language: 'en' },
        }),
    };
});

vi.mock('jotai', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        useAtom: (atom: any) => [atom.initialValue ?? null, vi.fn()],
    };
});

vi.mock('dexie-react-hooks', () => ({
    useLiveQuery: vi.fn(() => {
        return [
            { id: 'hymnal-1', name: 'Songs of Faith', language: 'en', itemCount: 100 },
        ];
    }),
}));

vi.mock('@/core/db', () => ({
    db: {
        hymnals: { toArray: vi.fn().mockResolvedValue([]) },
        hymnThemes: { toArray: vi.fn().mockResolvedValue([]) },
        presentationFiles: {
            where: vi.fn(() => ({ equals: vi.fn(() => ({ sortBy: vi.fn().mockResolvedValue([]) })) })),
        },
    },
}));

vi.mock('@/features/hymns/hooks/useHymnLiveState', () => ({
    useHymnLiveState: vi.fn(() => ({ isLive: false, isPreview: false })),
}));

vi.mock('@/features/presenter/store/presenterStore', () => ({
    usePresentationStore: vi.fn((selector) => {
        const state = {
            setLiveSlide: vi.fn(),
            setPreviewSlide: vi.fn(),
        };
        return selector(state);
    }),
}));

describe('HymnsBrowser Component', () => {
    it('renders empty selection state when no active hymnal is selected', () => {
        render(<HymnsBrowser />);
        expect(screen.getByText('Выберите сборник гимнов')).toBeDefined();
    });
});
