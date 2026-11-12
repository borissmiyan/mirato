import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TransmitterTab } from './TransmitterTab';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue || key,
        i18n: { language: 'ru' }
    })
}));

describe('TransmitterTab', () => {
    const mockSources = [
        { id: 'screen:0:0', name: 'Основной дисплей', thumbnail: 'data:image/png;base64,mockScreen' },
        { id: 'screen:1:0', name: 'Второй дисплей', thumbnail: 'data:image/png;base64,mockScreen2' },
        { id: 'window:1234:0', name: 'Браузер Chrome', thumbnail: 'data:image/png;base64,mockWindow' }
    ];

    const defaultProps = {
        isTransmitterConnected: false,
        isPrivacyActive: false,
        onDisconnect: vi.fn(),
        onTogglePrivacy: vi.fn(),
        enteredPin: '1234',
        onPinChange: vi.fn(),
        receiverHost: '192.168.1.50',
        onHostChange: vi.fn(),
        sources: mockSources,
        selectedSourceId: 'screen:0:0',
        onSelectSource: vi.fn(),
        isLoadingSources: false,
        onRefreshSources: vi.fn(),
        isConnecting: false,
        onConnect: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders PIN and source tabs in disconnected state', () => {
        render(<TransmitterTab {...defaultProps} />);

        expect(screen.getByText(/Введите 4-значный PIN-код/i)).toBeInTheDocument();

        // Check tabs: Экраны (2) and Приложения (1)
        expect(screen.getByText(/Экраны \(2\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Приложения \(1\)/i)).toBeInTheDocument();

        // Default tab is screens -> shows screens, not chrome window
        expect(screen.getByText('Основной дисплей')).toBeInTheDocument();
        expect(screen.getByText('Второй дисплей')).toBeInTheDocument();
        expect(screen.queryByText('Браузер Chrome')).not.toBeInTheDocument();
    });

    it('switches between screens and applications sub-tabs', () => {
        render(<TransmitterTab {...defaultProps} />);

        // Click on Applications sub-tab
        const appsTab = screen.getByText(/Приложения \(1\)/i);
        fireEvent.click(appsTab);

        // Shows app window, hides screens
        expect(screen.getByText('Браузер Chrome')).toBeInTheDocument();
        expect(screen.queryByText('Основной дисплей')).not.toBeInTheDocument();
    });

    it('allows selecting a source and triggering connection', () => {
        render(<TransmitterTab {...defaultProps} />);

        const secondDisplay = screen.getByText('Второй дисплей');
        fireEvent.click(secondDisplay);
        expect(defaultProps.onSelectSource).toHaveBeenCalledWith('screen:1:0');

        const connectBtn = screen.getByRole('button', { name: /Подключиться и транслировать/i });
        fireEvent.click(connectBtn);
        expect(defaultProps.onConnect).toHaveBeenCalledTimes(1);
    });

    it('renders connected state bar with privacy switch and disconnect button', () => {
        render(<TransmitterTab {...defaultProps} isTransmitterConnected={true} />);

        expect(screen.getByText(/В эфире на проекторе/i)).toBeInTheDocument();
        expect(screen.getByText(/Конфиденциальный режим/i)).toBeInTheDocument();

        const disconnectBtn = screen.getByRole('button', { name: /Отключиться/i });
        fireEvent.click(disconnectBtn);
        expect(defaultProps.onDisconnect).toHaveBeenCalledTimes(1);
    });
});
