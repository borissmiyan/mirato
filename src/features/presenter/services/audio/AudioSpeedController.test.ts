import { describe, it, expect, vi } from 'vitest';
import { setTrackSpeed, getTrackProgress } from './AudioPlaybackController';
import { IActiveTrack } from './types';

describe('setTrackSpeed', () => {
    it('updates playbackRate and clamps speed on HTMLAudioElement tracks', () => {
        const mediaElement = { playbackRate: 1, currentTime: 12, duration: 120, paused: false } as unknown as HTMLAudioElement;
        const track: IActiveTrack = {
            source: {} as MediaElementAudioSourceNode,
            gain: {} as GainNode,
            scope: {
                id: 'scope-1',
                presentationId: 'pres-1',
                startSlideId: 's1',
                endSlideId: 's2',
                fileId: 'f1',
                volume: 1,
                loop: false,
            },
            mediaElement,
            startTime: 0,
            startOffset: 0,
            isPaused: false,
        };

        setTrackSpeed(track, 1.5, null);
        expect(mediaElement.playbackRate).toBe(1.5);
        expect(track.scope.speed).toBe(1.5);

        setTrackSpeed(track, 10, null);
        expect(mediaElement.playbackRate).toBe(4);
        expect(track.scope.speed).toBe(4);

        setTrackSpeed(track, 0.05, null);
        expect(mediaElement.playbackRate).toBe(0.25);
        expect(track.scope.speed).toBe(0.25);
    });

    it('snapshots startOffset and startTime on AudioBufferSourceNode so progress never jumps', () => {
        const setValueAtTime = vi.fn();
        // Create a mock that passes `instanceof AudioBufferSourceNode` if defined in JSDOM, or stub prototype
        class MockBufferSource {
            buffer = { duration: 100 };
            playbackRate = { value: 1, setValueAtTime };
        }
        const original = globalThis.AudioBufferSourceNode;
        (globalThis as unknown as { AudioBufferSourceNode: unknown }).AudioBufferSourceNode = MockBufferSource;

        try {
            const source = new MockBufferSource() as unknown as AudioBufferSourceNode;
            const ctx = { currentTime: 10 } as AudioContext;
            const track: IActiveTrack = {
                source,
                gain: {} as GainNode,
                scope: {
                    id: 'scope-2',
                    presentationId: 'pres-1',
                    startSlideId: 's1',
                    endSlideId: 's2',
                    fileId: 'f2',
                    volume: 1,
                    loop: false,
                    speed: 1,
                },
                startTime: 0,
                startOffset: 0,
                isPaused: false,
            };

            // At ctx.currentTime = 10 with speed 1, track is at 10s
            setTrackSpeed(track, 2, ctx);
            expect(track.startOffset).toBe(10);
            expect(track.startTime).toBe(10);
            expect(track.scope.speed).toBe(2);
            expect(setValueAtTime).toHaveBeenCalledWith(2, 10);

            // 5 seconds later at speed 2, progress should be 10 + 5*2 = 20s (not 15*2 = 30s!)
            const laterCtx = { currentTime: 15 } as AudioContext;
            const progress = getTrackProgress(track, laterCtx);
            expect(progress?.currentTime).toBe(20);
        } finally {
            (globalThis as unknown as { AudioBufferSourceNode: unknown }).AudioBufferSourceNode = original;
        }
    });
});
