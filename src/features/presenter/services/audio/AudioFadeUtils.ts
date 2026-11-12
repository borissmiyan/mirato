import { IActiveTrack } from './types';

/**
 * Ramps a gain node to target value exponentially.
 */
export function rampGain(gainNode: GainNode, targetValue: number, time: number, duration: number): void {
    const clampedTarget = Math.max(0.0001, targetValue);
    gainNode.gain.cancelScheduledValues(time);
    gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), time);
    gainNode.gain.exponentialRampToValueAtTime(clampedTarget, time + Math.max(0.01, duration));
}

/**
 * Safely cleans up and releases an HTMLAudioElement.
 */
export function cleanupMediaElement(el?: HTMLAudioElement): void {
    if (!el) return;
    try {
        el.pause();
        el.src = '';
        el.load();
        el.remove();
    } catch (_) {
        // intentional suppression for audio cleanup
    }
}

/**
 * Fades out and cleans up an active audio track.
 */
export function fadeOutTrack(track: IActiveTrack, now: number, defaultFadeDuration: number): void {
    try {
        const fadeDuration = Math.max(0.01, track.scope.crossfadeSettings?.fadeOutDuration ?? defaultFadeDuration);
        rampGain(track.gain, 0.0001, now, fadeDuration);

        if (track.source instanceof AudioBufferSourceNode) {
            track.source.stop(now + fadeDuration);
        } else {
            const el = track.mediaElement;
            setTimeout(() => {
                cleanupMediaElement(el);
            }, fadeDuration * 1000);
        }
    } catch (_) {
        // intentional
    }
}

