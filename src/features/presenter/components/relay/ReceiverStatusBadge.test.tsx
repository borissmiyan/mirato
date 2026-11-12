import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReceiverStatusBadge } from './ReceiverStatusBadge';
import { useRelayStore } from '@/core/store/relayStore';

describe('ReceiverStatusBadge Component', () => {
    beforeEach(() => {
        useRelayStore.setState({
            isReceiverActive: false,
            pin: '',
            connectedSpeaker: null,
            isPrivacyActive: false
        });
    });

    it('renders nothing when receiver is inactive', () => {
        const { container } = render(<ReceiverStatusBadge onStop={vi.fn()} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders waiting status and pin when active without speaker', () => {
        useRelayStore.setState({
            isReceiverActive: true,
            pin: '4821',
            connectedSpeaker: null
        });

        render(<ReceiverStatusBadge onStop={vi.fn()} />);
        expect(screen.getByText('4821')).toBeInTheDocument();
        expect(screen.getByText(/ожидание спикера/i)).toBeInTheDocument();
    });

    it('renders connected speaker and privacy badge when speaker connected', () => {
        useRelayStore.setState({
            isReceiverActive: true,
            pin: '4821',
            connectedSpeaker: { name: 'MacBook Спикера' },
            isPrivacyActive: true
        });

        render(<ReceiverStatusBadge onStop={vi.fn()} />);
        expect(screen.getByText('MacBook Спикера')).toBeInTheDocument();
        expect(screen.getByText(/конфиденциально/i)).toBeInTheDocument();
    });

    it('triggers onStop when clicking close button', () => {
        const handleStop = vi.fn();
        useRelayStore.setState({
            isReceiverActive: true,
            pin: '4821'
        });

        render(<ReceiverStatusBadge onStop={handleStop} />);
        const closeBtn = screen.getByRole('button', { name: /завершить|отмена/i });
        fireEvent.click(closeBtn);
        expect(handleStop).toHaveBeenCalledTimes(1);
    });
});
