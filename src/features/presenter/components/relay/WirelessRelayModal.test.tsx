import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { WirelessRelayModal } from './WirelessRelayModal';
import { useRelayStore } from '@/core/store/relayStore';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue || key,
        i18n: { language: 'ru' }
    })
}));

describe('WirelessRelayModal', () => {
    beforeEach(() => {
        useRelayStore.getState().reset();
        vi.clearAllMocks();
    });

    it('renders nothing when isOpen is false', () => {
        const { container } = render(
            <WirelessRelayModal isOpen={false} onClose={vi.fn()} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders modal with mode selection when open', () => {
        render(
            <WirelessRelayModal isOpen={true} onClose={vi.fn()} />
        );

        expect(screen.getByText(/Беспроводной экран Deck.CE/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Принять трансляцию/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Транслировать экран/i })).toBeInTheDocument();
    });

    it('displays PIN code when in receiver mode', async () => {
        useRelayStore.getState().startReceiver('8421');

        render(
            <WirelessRelayModal isOpen={true} onClose={vi.fn()} initialTab="receiver" />
        );

        expect(screen.getByText('8421')).toBeInTheDocument();
        expect(screen.getByText(/Ожидание подключения спикера/i)).toBeInTheDocument();
    });

    it('displays 4-digit PIN input when in transmitter mode', () => {
        render(
            <WirelessRelayModal isOpen={true} onClose={vi.fn()} initialTab="transmitter" />
        );

        // PinInput slots and input element
        expect(screen.getByTestId('pin-slot-0')).toBeInTheDocument();
        expect(screen.getByTestId('pin-slot-1')).toBeInTheDocument();
        expect(screen.getByTestId('pin-slot-2')).toBeInTheDocument();
        expect(screen.getByTestId('pin-slot-3')).toBeInTheDocument();
        expect(screen.getByLabelText('PIN Code Input')).toBeInTheDocument();
    });
});
