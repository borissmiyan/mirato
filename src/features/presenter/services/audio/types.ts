import { IAudioScope } from '@/core/types';

export interface WindowWithWebkit extends Window {
    webkitAudioContext?: typeof AudioContext;
}

export interface IActiveTrack {
    source: AudioBufferSourceNode | MediaElementAudioSourceNode;
    gain: GainNode;
    scope: IAudioScope;
    mediaElement?: HTMLAudioElement;
    startTime: number;
    startOffset: number;
    isPaused?: boolean;
    /** When true, the onended callback will NOT remove this track from activeTracks. */
    suppressEndedCleanup?: boolean;
}

