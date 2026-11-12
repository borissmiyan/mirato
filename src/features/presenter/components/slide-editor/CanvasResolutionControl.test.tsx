import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasResolutionControl } from './CanvasResolutionControl';
import { Provider } from 'jotai';

describe('CanvasResolutionControl', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('renders the control button with default resolution', () => {
        render(
            <Provider>
                <CanvasResolutionControl />
            </Provider>
        );

        const button = screen.getByRole('button', { name: /canvas_resolution|разрешение/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent('1/2');
    });

    it('opens the portal popover menu on click and allows selecting a resolution', () => {
        render(
            <Provider>
                <CanvasResolutionControl />
            </Provider>
        );

        const button = screen.getByRole('button', { name: /canvas_resolution|разрешение/i });
        fireEvent.click(button);

        // Popover should be mounted in document.body via Portal
        const popover = screen.getByRole('dialog');
        expect(popover).toBeInTheDocument();
        expect(popover).toHaveClass('fixed', 'z-[9999]');

        // Options should exist (1x, 1/2, 1/4)
        const fullOption = screen.getByText('1x');
        expect(fullOption).toBeInTheDocument();

        // Select 1x (Full)
        fireEvent.click(fullOption);

        // Popover should close
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        // Button text should now be '1x'
        expect(button).toHaveTextContent('1x');
    });

    it('closes the popover on Escape key', () => {
        render(
            <Provider>
                <CanvasResolutionControl />
            </Provider>
        );

        const button = screen.getByRole('button', { name: /canvas_resolution|разрешение/i });
        fireEvent.click(button);

        expect(screen.getByRole('dialog')).toBeInTheDocument();

        fireEvent.keyDown(window, { key: 'Escape' });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
