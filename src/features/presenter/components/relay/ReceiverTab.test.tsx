import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReceiverTab } from './ReceiverTab';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue || key,
        i18n: { language: 'ru' }
    })
}));

describe('ReceiverTab', () => {
    const defaultProps = {
        isReceiverActive: true,
        pin: '5829',
        receiverIp: '192.168.1.100',
        connectedSpeaker: null,
        onToggleReceiver: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders receiver status and PIN when active', () => {
        render(<ReceiverTab {...defaultProps} />);

        expect(screen.getByText(/Приём трансляций на проектор/i)).toBeInTheDocument();
        expect(screen.getByText('5829')).toBeInTheDocument();
        expect(screen.getByText(/Ожидание подключения спикера/i)).toBeInTheDocument();
    });

    it('displays connected speaker name when a speaker connects', () => {
        render(
            <ReceiverTab
                {...defaultProps}
                connectedSpeaker={{
                    name: 'Иван Иванов',
                    ip: '192.168.1.105',
                    connectedAt: Date.now()
                }}
            />
        );

        expect(screen.getByText(/Спикер в эфире:/i)).toBeInTheDocument();
        expect(screen.getByText('Иван Иванов')).toBeInTheDocument();
    });

    it('renders inactive notice when receiver is turned off', () => {
        render(<ReceiverTab {...defaultProps} isReceiverActive={false} />);

        expect(screen.getByText(/Приёмник не активен/i)).toBeInTheDocument();
    });

    it('triggers onToggleReceiver when switch is toggled', () => {
        render(<ReceiverTab {...defaultProps} />);

        const switchEl = screen.getByRole('switch');
        fireEvent.click(switchEl);
        expect(defaultProps.onToggleReceiver).toHaveBeenCalledTimes(1);
    });
});
