import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DeckCastTab } from './DeckCastTab';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue || key,
        i18n: { language: 'ru' }
    })
}));

// Mock Dexie
vi.mock('@/core/db', () => ({
    db: {
        presentationFiles: {
            filter: vi.fn(() => ({
                reverse: vi.fn(() => ({
                    toArray: vi.fn().mockResolvedValue([
                        {
                            id: 'pres-1',
                            name: 'Тестовая проповедь',
                            slides: [
                                { id: 's1', content: 'Первый слайд' },
                                { id: 's2', content: 'Второй слайд' }
                            ]
                        }
                    ])
                }))
            }))
        }
    }
}));

// Mock dexie-react-hooks
vi.mock('dexie-react-hooks', () => ({
    useLiveQuery: (fn: any) => [
        {
            id: 'pres-1',
            name: 'Тестовая проповедь',
            slides: [
                { id: 's1', content: 'Первый слайд' },
                { id: 's2', content: 'Второй слайд' }
            ]
        }
    ]
}));

describe('DeckCastTab', () => {
    const mockProps = {
        isConnected: false,
        isConnecting: false,
        enteredPin: '1234',
        onPinChange: vi.fn(),
        receiverHost: '127.0.0.1',
        onHostChange: vi.fn(),
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
        isPrivacyActive: false,
        onTogglePrivacy: vi.fn(),
        sendCommand: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders connection prompt and PIN input when disconnected', () => {
        render(<DeckCastTab {...mockProps} isConnected={false} />);

        expect(screen.getByText(/Кастинг презентации/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Подключиться к проектору/i })).toBeInTheDocument();
    });

    it('triggers onConnect when clicking connect button', () => {
        render(<DeckCastTab {...mockProps} isConnected={false} enteredPin="4821" />);

        const connectBtn = screen.getByRole('button', { name: /Подключиться к проектору/i });
        fireEvent.click(connectBtn);
        expect(mockProps.onConnect).toHaveBeenCalledTimes(1);
    });

    it('renders connected bar, privacy mode toggle and presentation list when connected', () => {
        render(<DeckCastTab {...mockProps} isConnected={true} />);

        expect(screen.getByText(/Подключено к проектору/i)).toBeInTheDocument();
        expect(screen.getByText(/Конфиденциальный режим/i)).toBeInTheDocument();
        expect(screen.getByText('Тестовая проповедь')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Запустить презентацию на проекторе/i })).toBeInTheDocument();
    });

    it('launches presentation and switches to live mode with controls', () => {
        render(<DeckCastTab {...mockProps} isConnected={true} />);

        const launchBtn = screen.getByRole('button', { name: /Запустить презентацию на проекторе/i });
        fireEvent.click(launchBtn);

        expect(mockProps.sendCommand).toHaveBeenCalledWith(
            'CAST_PRESENTATION',
            expect.objectContaining({
                startSlideIndex: 0,
                speakerName: 'Спикер на сцене'
            })
        );

        // Now in live mode
        expect(screen.getByText(/В эфире на проекторе/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Завершить показ/i })).toBeInTheDocument();

        // Navigate forward
        const nextBtn = screen.getByRole('button', { name: /Вперёд/i });
        fireEvent.click(nextBtn);
        expect(mockProps.sendCommand).toHaveBeenCalledWith(
            'CAST_NAVIGATE_SLIDE',
            expect.objectContaining({
                slideId: 's2',
                presentationId: 'pres-1'
            })
        );

        // Stop presentation
        const stopBtn = screen.getByRole('button', { name: /Завершить показ/i });
        fireEvent.click(stopBtn);
        expect(mockProps.sendCommand).toHaveBeenCalledWith('CAST_STOP');
    });
});
