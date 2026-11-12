import { describe, it, expect, vi } from 'vitest';
import { getTrackProgress, pauseTrack, setTrackVolume } from './AudioPlaybackController';
import { IActiveTrack } from './types';
import { IAudioScope } from '@/core/types';

describe('AudioPlaybackController', () => {
    it('returns null progress when track is undefined or context is null', () => {
        expect(getTrackProgress(undefined, null)).toBeNull();
    });

    it('calculates progress for mediaElement track', () => {
        const mockAudio = {
            currentTime: 42,
            duration: 120,
            paused: false
        } as unknown as HTMLAudioElement;

        const track: IActiveTrack = {
            source: {} as unknown as MediaElementAudioSourceNode,
            gain: {} as unknown as GainNode,
            scope: { id: 's1', presentationId: 'p1', fileId: 'f1' } as IAudioScope,
            mediaElement: mockAudio,
            startTime: 0,
            startOffset: 0,
            isPaused: false
        };

        const progress = getTrackProgress(track, {} as unknown as AudioContext);
        expect(progress).toEqual({
            currentTime: 42,
            duration: 120,
            isPlaying: true
        });
    });

    it('pauses mediaElement track', () => {
        const pauseMock = vi.fn();
        const mockAudio = {
            pause: pauseMock,
            paused: false
        } as unknown as HTMLAudioElement;

        const track: IActiveTrack = {
            source: {} as unknown as MediaElementAudioSourceNode,
            gain: {} as unknown as GainNode,
            scope: { id: 's1', presentationId: 'p1', fileId: 'f1' } as IAudioScope,
            mediaElement: mockAudio,
            startTime: 0,
            startOffset: 0,
            isPaused: false
        };

        pauseTrack(track, {} as unknown as AudioContext);
        expect(pauseMock).toHaveBeenCalled();
        expect(track.isPaused).toBe(true);
    });

    it('sets volume on active track', () => {
        const cancelMock = vi.fn();
        const setValueMock = vi.fn();
        const mockGain = {
            gain: {
                cancelScheduledValues: cancelMock,
                setValueAtTime: setValueMock
            }
        } as unknown as GainNode;

        const mockAudio = { volume: 1 } as unknown as HTMLAudioElement;

        const track: IActiveTrack = {
            source: {} as unknown as MediaElementAudioSourceNode,
            gain: mockGain,
            scope: { id: 's1', presentationId: 'p1', fileId: 'f1' } as IAudioScope,
            mediaElement: mockAudio,
            startTime: 0,
            startOffset: 0
        };

        const mockCtx = { currentTime: 10 } as unknown as AudioContext;
        setTrackVolume(track, 0.75, mockCtx);

        expect(cancelMock).toHaveBeenCalledWith(10);
        expect(setValueMock).toHaveBeenCalledWith(0.75, 10);
        expect(mockAudio.volume).toBe(0.75);
    });
});

