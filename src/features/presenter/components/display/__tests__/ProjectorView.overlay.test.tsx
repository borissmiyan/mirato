import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import ProjectorView from '../ProjectorView';

vi.stubGlobal('electron', {
  ipcRenderer: {
    send: vi.fn(),
    on: vi.fn().mockReturnValue(() => {}),
  },
});

vi.mock('@/core/db', () => ({
  db: {
    verses: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      first: vi.fn(),
    },
  },
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => unknown) => fn(),
}));

vi.mock('@/core/hooks/useLogoUrl', () => ({
  useLogoUrl: (logo: { url?: string } | null) => logo?.url ?? null,
}));

vi.mock('../SlideDisplay', () => ({
  default: () => <div data-testid="slide-display" />,
}));

vi.mock('../SlideBackground', () => ({
  SlideBackground: () => <div data-testid="slide-background" />,
}));

describe('ProjectorView smooth overlay transitions', () => {
  let ipcHandler: (command: string, payload?: unknown) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (window.electron.ipcRenderer.on as ReturnType<typeof vi.fn>).mockImplementation(
      (channel: string, handler: typeof ipcHandler) => {
        if (channel === 'projector-command') {
          ipcHandler = handler;
        }
        return () => {};
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps SlideDisplay opaque and crossfades logo directly into slide without black flash', async () => {
    render(<ProjectorView />);

    const slideDisplay = screen.getByTestId('slide-display');
    const slideWrapper = slideDisplay.parentElement as HTMLElement;

    // Turn on logo overlay
    await act(async () => {
      ipcHandler('set-override', {
        type: 'logo',
        logo: { id: 'logo-1', name: 'Church Logo', url: 'https://example.com/logo.png' },
      });
    });

    // Slide underneath must remain visible (no opacity-0 black screen flash)
    expect(slideWrapper.className).not.toContain('opacity-0');
    const logoImg = screen.getByAltText('Church Logo') as HTMLImageElement;
    expect(logoImg.src).toBe('https://example.com/logo.png');

    // Turn off logo overlay -> should crossfade smoothly, keeping img mounted while fading out
    await act(async () => {
      ipcHandler('set-override', { type: null });
    });

    expect(slideWrapper.className).not.toContain('opacity-0');
    const fadingImg = screen.getByAltText('Church Logo') as HTMLImageElement;
    expect(fadingImg.src).toBe('https://example.com/logo.png');

    const logoLayer = fadingImg.closest('[data-override-layer="logo"]') as HTMLElement;
    expect(logoLayer).not.toBeNull();
    expect(logoLayer.className).toContain('opacity-0');
    expect(logoLayer.className).not.toContain('invisible');

    // After transition duration completes, overlay content unmounts cleanly
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.queryByAltText('Church Logo')).toBeNull();
  });
});
