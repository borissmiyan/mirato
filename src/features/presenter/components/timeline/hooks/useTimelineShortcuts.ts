import { useEffect, useRef } from 'react';
import { ISlide } from '@/core/types';

interface UseTimelineShortcutsProps {
    activePresentationId: string | null;
    slides: ISlide[];
    selectedSlideIds: string[];
    selectedAudioScopeId: string | null;
    previewSlideId: string | null;
    isTimelineHoveredRef: React.RefObject<boolean>;
    copySlides: (id: string, ids: string[], isCut?: boolean) => void;
    pasteSlides: (id: string, targetIdx?: number) => void;
    duplicateSlides: (id: string, ids: string[]) => void;
    duplicateSlide: (id: string, sid: string) => void;
    removeSlides: (id: string, ids: string[]) => void;
    removeSlide: (id: string, sid: string) => void;
    copyAudioScope: (id: string) => Promise<void>;
    pasteAudioScope: (targetSlideId: string) => Promise<void>;
    duplicateAudioScope: (id: string) => Promise<string | undefined>;
    setSelectedSlideIds: (ids: string[]) => void;
    setLiveSlide: (id: string | null, presentationId?: string, rootPresentationId?: string, navigationParentSlideId?: string | null) => void;
    clearSelection: () => void;
}

/**
 * Hook to handle keyboard shortcuts for the timeline.
 */
export const useTimelineShortcuts = ({
    activePresentationId,
    slides,
    selectedSlideIds,
    selectedAudioScopeId,
    previewSlideId,
    isTimelineHoveredRef,
    copySlides,
    pasteSlides,
    duplicateSlides,
    duplicateSlide,
    removeSlides,
    removeSlide,
    copyAudioScope,
    pasteAudioScope,
    duplicateAudioScope,
    setSelectedSlideIds,
    setLiveSlide,
    clearSelection
}: UseTimelineShortcutsProps) => {
    // Keep a ref to the latest state to avoid re-binding the event listener too frequently
    const stateRef = useRef({ selectedSlideIds, selectedAudioScopeId, activePresentationId, slides, previewSlideId });
    
    useEffect(() => {
        stateRef.current = { selectedSlideIds, selectedAudioScopeId, activePresentationId, slides, previewSlideId };
    }, [selectedSlideIds, selectedAudioScopeId, activePresentationId, slides, previewSlideId]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const active = document.activeElement;
            const isTyping = active && (
                active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.getAttribute('contenteditable') === 'true'
            );
            if (isTyping) return;

            const isMod = e.metaKey || e.ctrlKey;
            const state = stateRef.current;

            if (isMod && !e.shiftKey && !e.altKey && (e.code === 'KeyC' || e.key.toLowerCase() === 'c')) {
                if (state.selectedAudioScopeId) {
                    copyAudioScope(state.selectedAudioScopeId);
                } else if (state.selectedSlideIds.length > 0) {
                    copySlides(state.activePresentationId!, state.selectedSlideIds);
                }
            } else if (isMod && !e.shiftKey && !e.altKey && (e.code === 'KeyV' || e.key.toLowerCase() === 'v')) {
                if (state.selectedAudioScopeId) {
                    if (state.previewSlideId) pasteAudioScope(state.previewSlideId);
                } else if (state.activePresentationId) {
                    let targetIdx: number | undefined = undefined;
                    if (state.selectedSlideIds.length > 0) {
                        const indices = state.selectedSlideIds.map(id => state.slides.findIndex(s => s.id === id)).filter(idx => idx !== -1);
                        if (indices.length > 0) {
                            targetIdx = Math.max(...indices) + 1;
                        }
                    } else if (state.previewSlideId) {
                        const idx = state.slides.findIndex(s => s.id === state.previewSlideId);
                        if (idx !== -1) {
                            targetIdx = idx + 1;
                        }
                    }
                    pasteSlides(state.activePresentationId, targetIdx);
                }
            } else if (isMod && !e.shiftKey && !e.altKey && (e.code === 'KeyX' || e.key.toLowerCase() === 'x')) {
                if (state.selectedSlideIds.length > 0) copySlides(state.activePresentationId!, state.selectedSlideIds, true);
            } else if (isMod && !e.shiftKey && !e.altKey && (e.code === 'KeyA' || e.key.toLowerCase() === 'a')) {
                if (!isTimelineHoveredRef.current) return;
                e.preventDefault();
                setSelectedSlideIds(state.slides.map(s => s.id));
            } else if (e.altKey && !isMod && (e.code === 'KeyD' || e.key.toLowerCase() === 'd')) {
                // Only deselect when timeline is hovered
                if (isTimelineHoveredRef.current) {
                    e.preventDefault();
                    clearSelection();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [copySlides, pasteSlides, duplicateSlides, removeSlides, clearSelection, duplicateSlide, removeSlide, setSelectedSlideIds, setLiveSlide, isTimelineHoveredRef, copyAudioScope, pasteAudioScope, duplicateAudioScope]);
};
