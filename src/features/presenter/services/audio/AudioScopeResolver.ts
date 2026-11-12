import { IAudioScope, ISlide, ICanvasSlide, IHymnSlide } from '@/core/types';
import { resolveHymnAudioScopes } from '../hymnAudioResolver';
import { IActiveTrack } from './types';

/**
 * Resolves the currently active audio scope for a given slide ID from slides and presentation scopes.
 */
export async function findActiveScope(
    slideId: string,
    slides: ISlide[],
    presentationScopes?: IAudioScope[],
    activeTracks?: Map<string, IActiveTrack>
): Promise<IAudioScope | null> {
    const slide = slides.find(s => s.id === slideId);
    if (!slide) return null;

    // Hymn Slide handling: resolve audio scopes from the source hymn presentation
    if (slide.type === 'hymn') {
        const resolvedHymnAudio = await resolveHymnAudioScopes(slide as IHymnSlide);
        if (resolvedHymnAudio && resolvedHymnAudio.scopes.length > 0) {
            return resolvedHymnAudio.scopes[0];
        }
    }

    const slideIndex = slides.findIndex(s => s.id === slideId);
    if (slideIndex === -1) return null;

    const allScopes: IAudioScope[] = [];

    // 1. Root-level/Relational Scopes
    if (presentationScopes && Array.isArray(presentationScopes)) {
        allScopes.push(...presentationScopes);
    }

    // 2. Slide-level Scopes (Nesting & Legacy)
    slides.forEach(s => {
        // Broaden to all slide types (e.g. verse slides can have audio too)
        const cs = s as ICanvasSlide & { audio?: { path?: string; fileId?: string; filename?: string; fileName?: string } };

        // 2a. Relational scopes stored in slide
        if (cs.audioScopes && Array.isArray(cs.audioScopes)) {
            allScopes.push(...cs.audioScopes);
        }

        // 2b. Legacy "Attached Audio" (s.audio)
        const audioPath = cs.audio?.fileId || cs.audio?.path;
        if (audioPath) {
            // Convert to a virtual scope that covers just this slide
            allScopes.push({
                id: `legacy-${s.id}`,
                presentationId: '',
                startSlideId: s.id,
                endSlideId: s.id,
                fileId: audioPath,
                fileName: cs.audio?.fileName || cs.audio?.filename || audioPath.split('/').pop(),
                volume: 1,
                loop: false
            });
        }
    });

    for (const scope of allScopes) {
        if (scope.isGlobal) {
            return scope;
        }
        const startIndex = slides.findIndex(s => s.id === scope.startSlideId);
        const endIndex = slides.findIndex(s => s.id === scope.endSlideId);

        // Safety: If startIndex found but endIndex missing (legacy/partial data), treat as single slide
        const resolvedEndIndex = (startIndex !== -1 && endIndex === -1) ? startIndex : endIndex;

        if (startIndex !== -1 && resolvedEndIndex !== -1) {
            const minIdx = Math.min(startIndex, resolvedEndIndex);
            const maxIdx = Math.max(startIndex, resolvedEndIndex);
            if (slideIndex >= minIdx && slideIndex <= maxIdx) {
                return scope;
            }
        }
    }

    // 3. FEATURE FALLBACK: Virtual Scopes (e.g. Timer Audio)
    if (activeTracks) {
        const timerPrefix = `timer-audio-${slideId}`;
        const activeTrack = Array.from(activeTracks.keys()).find(k => k === timerPrefix);
        if (activeTrack) {
            const track = activeTracks.get(activeTrack);
            if (track) return track.scope;
        }
    }

    return null;
}

