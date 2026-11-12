import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TransmitterStatusBadge } from './TransmitterStatusBadge';
import { useRelayStore } from '@/core/store/relayStore';
import { relayTransmitterService } from '@/core/services/RelayTransmitterService';

describe('TransmitterStatusBadge', () => {
    beforeEach(() => {
        useRelayStore.getState().reset();
        vi.clearAllMocks();
    });

    it('renders nothing when transmitter is not connected', () => {
        const { container } = render(<TransmitterStatusBadge />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders badge when transmitter is connected', () => {
        useRelayStore.getState().setTransmitterConnected(true, '192.168.1.120');

        render(<TransmitterStatusBadge />);
        expect(screen.getByText('В эфире на проекторе')).toBeInTheDocument();
    });

    it('triggers onOpenModal when clicking the badge', () => {
        useRelayStore.getState().setTransmitterConnected(true, '192.168.1.120');
        const handleOpen = vi.fn();

        render(<TransmitterStatusBadge onOpenModal={handleOpen} />);
        const badge = screen.getByRole('button', { name: 'Статус трансляции на проектор' });
        fireEvent.click(badge);

        expect(handleOpen).toHaveBeenCalledTimes(1);
    });

    it('calls disconnect on close button click', () => {
        useRelayStore.getState().setTransmitterConnected(true, '192.168.1.120');
        const disconnectSpy = vi.spyOn(relayTransmitterService, 'disconnect');

        render(<TransmitterStatusBadge />);
        const closeBtn = screen.getByRole('button', { name: 'Отключиться от проектора' });
        fireEvent.click(closeBtn);

        expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });
});
