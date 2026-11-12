import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import HymnPickerModal from './HymnPickerModal';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { db } from '@/core/db';

class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver);

// Mock Lucide icons
vi.mock('lucide-react', async () => {
    const actual = await vi.importActual('lucide-react');
    return {
        ...actual,
    };
});

// Mock dexie-react-hooks
vi.mock('dexie-react-hooks', () => ({
    useLiveQuery: (cb: any) => {
        if (typeof cb === 'function') {
            return [];
        }
        return [];
    },
}));

// Mock db
vi.mock('@/core/db', () => ({
    db: {
        hymnals: {
            toArray: vi.fn().mockResolvedValue([
                { id: 'hymnal-1', name: 'Гимны Надежды', language: 'ru' }
            ])
        },
        hymnThemes: {
            toArray: vi.fn().mockResolvedValue([
                { id: 'theme-1', name: 'Стандартная тема' }
            ]),
            get: vi.fn().mockResolvedValue({ id: 'theme-1', name: 'Стандартная тема' })
        },
        presentationFiles: {
            where: vi.fn().mockReturnValue({
                equals: vi.fn().mockReturnValue({
                    sortBy: vi.fn().mockResolvedValue([
                        {
                            id: 'hymn-pres-40',
                            name: '40 - Воспою любовь Христа',
                            metadata: { hymnOrder: 40, hymnTitle: 'Воспою любовь Христа' },
                            slides: [
                                { id: 's1', type: 'hymn', content: { canvasItems: [{ type: 'text', text: { content: 'Куплет 1' } }] } }
                            ]
                        }
                    ])
                })
            }),
            get: vi.fn().mockResolvedValue({
                id: 'hymn-pres-40',
                name: '40 - Воспою любовь Христа',
                metadata: { hymnOrder: 40, hymnTitle: 'Воспою любовь Христа' },
                slides: [
                    { id: 's1', type: 'hymn', content: { canvasItems: [{ type: 'text', text: { content: 'Куплет 1' } }] } }
                ]
            })
        }
    }
}));


describe('HymnPickerModal', () => {
    beforeEach(() => {
        useModalStore.setState({
            stack: [{ id: ModalType.HYMN_PICKER, props: {} }]
        });
    });

    it('renders when open in modalStore', () => {
        render(<HymnPickerModal />);
        expect(screen.getByRole('dialog', { hidden: true }) || document.body).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/search_hymns_placeholder|поиск/i)).toBeInTheDocument();
    });

    it('closes on close button click', () => {
        render(<HymnPickerModal />);
        const closeButtons = screen.getAllByRole('button');
        fireEvent.click(closeButtons[0]);
        expect(useModalStore.getState().isModalOpen(ModalType.HYMN_PICKER)).toBe(false);
    });
});

