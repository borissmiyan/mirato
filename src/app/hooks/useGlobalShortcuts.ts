import { useCallback, useEffect, useRef } from 'react';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { IpcService } from '@/core/services/ipcService';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getDefaultStore } from 'jotai';
import {
    OverrideType,
    slidePreviewHoveredAtom,
    isTimelineHoveredAtom,
    selectedCanvasItemIdsAtom,
    editingCanvasItemIdAtom,
    vectorEditingItemIdAtom,
    canvasToolAtom,
    historyOpenAtom,
    searchOpenAtom,
    isQuickLookOpenAtom,
    latestInteractionAreaAtom,
} from '@/core/store/uiAtoms';
import { previewLockedAtom } from '@/core/store/liveSyncAtoms';
import { Verse, IPresentationFile, ICanvasSlide, ICanvasItem } from '@/core/types';
import { isUserTyping } from '@/core/utils/keyboardUtils';
import { presentationService } from '@/core/services/presentationService';
import { executePresentationHotkeys, HotkeyEvent } from './presentationHotkeysExecutor';
import { registerRemoteCommands } from './useRemoteCommands';

interface IGlobalShortcutsProps {
    appMode: 'scripture' | 'presentation';
    previewSlideId: string | null;
    activePresentation: IPresentationFile | null;
    activeVerse: Verse | null;
    selectedCanvasItemIds: string[];
    isTimelineHovered: boolean;
    handleNext: (detached?: boolean, preferLiveAnchor?: boolean) => Promise<void>;
    handlePrev: (detached?: boolean, preferLiveAnchor?: boolean) => Promise<void>;
    openProjector: () => Promise<void>;
    closeProjector: () => void;
    toggleOverride: (type: OverrideType) => void;
    onRequestRemoteUpdate: () => void;
}

/**
 * Hook to manage global keyboard shortcuts for the application.
 */
export function useGlobalShortcuts({
    appMode,
    previewSlideId,
    activePresentation,
    activeVerse,
    selectedCanvasItemIds,
    isTimelineHovered: isTimelineHoveredProp,
    handleNext,
    handlePrev,
    openProjector,
    closeProjector,
    toggleOverride,
    onRequestRemoteUpdate,
}: IGlobalShortcutsProps) {
    const { t } = useTranslation();
    const undo = usePresentationStore(s => s.undo);
    const redo = usePresentationStore(s => s.redo);
    const setPreviewSlide = usePresentationStore(s => s.setPreviewSlide);
    const setLiveSlide = usePresentationStore(s => s.setLiveSlide);

    const executeHotkey = useCallback(async (e: HotkeyEvent) => {
        if (!e.isRelayed && isUserTyping()) return;

        const store = getDefaultStore();
        if (store.get(isQuickLookOpenAtom)) return;

        const isMod = e.metaKey || e.ctrlKey;
        const isPreviewHovered = store.get(slidePreviewHoveredAtom);
        const isTimelineHovered = store.get(isTimelineHoveredAtom) || isTimelineHoveredProp;
        const interactionArea = store.get(latestInteractionAreaAtom);
        const isCanvasContext = !isTimelineHovered && (isPreviewHovered || interactionArea === 'canvas');

        // Spacebar: Strictly Play / Pause live video & audio (outside canvas pan)
        if (!isMod && !e.shiftKey && !e.altKey && (e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space')) {
            if (isPreviewHovered) {
                // Priority on canvas: Spacebar pan
                return;
            }
            const hasMedia = presentationService.hasLiveMedia();
            const liveSlideId = usePresentationStore.getState().liveSlideId;
            if (liveSlideId || hasMedia) {
                e.preventDefault?.();
                presentationService.toggleLiveMedia('all');
                return;
            }
            return;
        }

        // Enter: Contextual Actions (Canvas item edit vs Timeline Go Live)
        if (e.key === 'Enter') {
            // Let pen tool handler finish path drawing cleanly
            if (store.get(canvasToolAtom) === 'pen') {
                return;
            }

            if (store.get(vectorEditingItemIdAtom) !== null) {
                store.set(vectorEditingItemIdAtom, null);
                e.preventDefault?.();
                return;
            }

            if (appMode === 'presentation') {
                const selectedItemIds = store.get(selectedCanvasItemIdsAtom);
                // Only enter canvas item editing when cursor/focus is on canvas (never hijack timeline Enter)
                if (isCanvasContext && selectedItemIds.length > 0 && !isMod) {
                    const presState = usePresentationStore.getState();
                    const pres = presState.selectedPresentation || presState.activePresentation || activePresentation;
                    const slide = pres?.slides?.find(s => s.id === previewSlideId) as ICanvasSlide | undefined;
                    const items: ICanvasItem[] = slide?.content?.canvasItems || [];

                    // Figma Shift+Enter: Select parent group
                    if (e.shiftKey) {
                        const firstItem = items.find(i => selectedItemIds.includes(i.id));
                        if (firstItem?.groupId) {
                            const groupItemIds = items.filter(i => i.groupId === firstItem.groupId).map(i => i.id);
                            store.set(selectedCanvasItemIdsAtom, groupItemIds);
                            e.preventDefault?.();
                            return;
                        }
                    }

                    // Figma Enter on group: select children / first child
                    if (!e.shiftKey && selectedItemIds.length > 1) {
                        const firstItem = items.find(i => i.id === selectedItemIds[0]);
                        if (firstItem?.groupId && selectedItemIds.every(id => items.find(i => i.id === id)?.groupId === firstItem.groupId)) {
                            store.set(selectedCanvasItemIdsAtom, [selectedItemIds[0]]);
                            e.preventDefault?.();
                            return;
                        }
                    }

                    const firstId = selectedItemIds[selectedItemIds.length - 1];
                    const item = items.find(i => i.id === firstId);
                    if (item && !item.locked) {
                        if (item.type === 'shape' || item.type === 'stroke' || item.type === 'path') {
                            store.set(vectorEditingItemIdAtom, firstId);
                            e.preventDefault?.();
                            return;
                        }
                        if (item.type === 'text') {
                            store.set(editingCanvasItemIdAtom, firstId);
                            store.set(canvasToolAtom, 'text');
                            e.preventDefault?.();
                            return;
                        }
                    }
                    // For image/video/effect or locked items on canvas, do not lock editingCanvasItemIdAtom
                    e.preventDefault?.();
                    return;
                }

                const launchSlide = (targetId: string, forcePreview: boolean) => {
                    const presState = usePresentationStore.getState();
                    const containerSlide = presState.activePresentation?.slides?.find(s => s.id === targetId);
                    const isNestedContainer = Boolean(
                        containerSlide && (
                            containerSlide.blockId === 'master-presentation' ||
                            containerSlide.type === 'nested' ||
                            (containerSlide.type === 'normal' && (containerSlide as { masterPresentationId?: string }).masterPresentationId)
                        )
                    );

                    if (isNestedContainer) {
                        openProjector();
                        void setPreviewSlide(targetId, presState.activePresentationId || undefined).then(() => {
                            const fresh = usePresentationStore.getState();
                            const resolvedId = fresh.previewSlideId || targetId;
                            setLiveSlide(
                                resolvedId,
                                fresh.selectedPresentationId || undefined,
                                fresh.activePresentationId || undefined,
                                fresh.navigationParentSlideId,
                                fresh.navigationParentPresentationId
                            );
                        });
                        return;
                    }

                    if (forcePreview || !presState.previewSlideId) {
                        void setPreviewSlide(targetId);
                    }
                    if (presState.selectedPresentationId && presState.selectedPresentationId !== presState.activePresentationId && presState.navigationParentSlideId) {
                        setLiveSlide(
                            targetId,
                            presState.selectedPresentationId,
                            presState.activePresentationId || undefined,
                            presState.navigationParentSlideId,
                            presState.navigationParentPresentationId
                        );
                    } else {
                        setLiveSlide(targetId);
                    }
                    openProjector();
                };

                if (isMod) {
                    const slides = activePresentation?.slides || [];
                    if (slides.length > 0) {
                        e.preventDefault?.();
                        launchSlide(slides[0].id, true);
                        return;
                    }
                }

                const targetId = previewSlideId || activePresentation?.slides?.[0]?.id;
                if (targetId) {
                    e.preventDefault?.();
                    launchSlide(targetId, false);
                    return;
                }
            } else {
                const bibleState = useBibleStore.getState();
                const canProject = bibleState.activeVerse || bibleState.selectedVerses.length >= 2;
                if (canProject) {
                    e.preventDefault?.();
                    bibleState.commitToProjector();
                    openProjector();
                }
            }
        }

        if (e.key === 'Escape') {
            e.preventDefault?.();
            if (store.get(vectorEditingItemIdAtom) !== null) {
                store.set(vectorEditingItemIdAtom, null);
                return;
            }
            if (store.get(editingCanvasItemIdAtom) !== null) {
                store.set(editingCanvasItemIdAtom, null);
                return;
            }
            closeProjector();
        }

        const hasSelectedCanvasItems = (selectedCanvasItemIds && selectedCanvasItemIds.length > 0) || store.get(selectedCanvasItemIdsAtom).length > 0;
        if (isCanvasContext && hasSelectedCanvasItems && e.key.startsWith('Arrow')) {
            // Priority: Arrow keys nudge selected items on canvas, do not change slides
            e.preventDefault?.();
            const step = e.shiftKey ? 10 : 1;
            const dx = e.key === 'ArrowLeft' ? -(step / 19.2) : e.key === 'ArrowRight' ? (step / 19.2) : 0;
            const dy = e.key === 'ArrowUp' ? -(step / 10.8) : e.key === 'ArrowDown' ? (step / 10.8) : 0;
            const targetIds = selectedCanvasItemIds.length > 0 ? selectedCanvasItemIds : store.get(selectedCanvasItemIdsAtom);

            if (previewSlideId && targetIds.length > 0) {
                const storeState = usePresentationStore.getState();
                const pres = storeState.selectedPresentation || storeState.activePresentation;
                const slide = pres?.slides?.find(s => s.id === previewSlideId) as ICanvasSlide | undefined;
                if (slide?.content?.canvasItems) {
                    const updates = targetIds.map(id => {
                        const it = slide.content.canvasItems.find(i => i.id === id);
                        if (!it) return null;
                        return {
                            id,
                            updates: {
                                x: Math.round((it.x + dx) * 100) / 100,
                                y: Math.round((it.y + dy) * 100) / 100,
                            }
                        };
                    }).filter((u): u is { id: string; updates: { x: number; y: number } } => u !== null);

                    if (updates.length > 0) {
                        usePresentationStore.getState().updateCanvasItems(previewSlideId, updates).catch(console.error);
                    }
                }
            }
            return;
        }

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault?.();
            const isPreviewLocked = store.get(previewLockedAtom);
            if (isMod) {
                // Cmd+Arrows: move Preview only
                await handleNext(true, false);
            } else if (e.altKey || isPreviewLocked) {
                // Alt+Arrows or Unlinked mode: move Live only, keep Preview locked
                await handleNext(true, true);
            } else {
                // Linked mode: anchor to Live slide and move Live & Preview together
                const presState = usePresentationStore.getState();
                if (appMode === 'presentation' && presState.liveSlideId && presState.previewSlideId !== presState.liveSlideId) {
                    presState.syncPreviewToLive();
                }
                await handleNext(false, true);
            }
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault?.();
            const isPreviewLocked = store.get(previewLockedAtom);
            if (isMod) {
                await handlePrev(true, false);
            } else if (e.altKey || isPreviewLocked) {
                await handlePrev(true, true);
            } else {
                const presState = usePresentationStore.getState();
                if (appMode === 'presentation' && presState.liveSlideId && presState.previewSlideId !== presState.liveSlideId) {
                    presState.syncPreviewToLive();
                }
                await handlePrev(false, true);
            }
        }

        if (isMod && (e.code === 'KeyH' || e.key.toLowerCase() === 'h')) {
            e.preventDefault?.();
            store.set(historyOpenAtom, (prev: boolean) => !prev);
            return;
        }
        if (!isMod && !e.shiftKey && !e.altKey && (e.code === 'KeyH' || e.key.toLowerCase() === 'h')) {
            if (appMode === 'presentation') {
                e.preventDefault?.();
                if (isPreviewHovered) {
                    store.set(canvasToolAtom, 'pan');
                } else if (previewSlideId) {
                    usePresentationStore.getState().syncPreviewToLive();
                }
                return;
            }
        }

        if (isMod && e.shiftKey && (e.code === 'KeyC' || e.key.toLowerCase() === 'c')) {
            if (activeVerse) {
                e.preventDefault?.();
                const text = `${activeVerse.bookId} ${activeVerse.chapter}:${activeVerse.verseNumber} (${activeVerse.translationId})\n${activeVerse.text}`;
                navigator.clipboard.writeText(text);
            }
        }

        if (isMod && (e.code === 'KeyF' || e.key.toLowerCase() === 'f')) {
            e.preventDefault?.();
            store.set(searchOpenAtom, true);
        }

        if (e.code === 'KeyB' || e.key.toLowerCase() === 'b') { e.preventDefault?.(); toggleOverride('blackout'); }
        if (e.code === 'KeyW' || e.key.toLowerCase() === 'w') { e.preventDefault?.(); toggleOverride('whiteout'); }
        if (e.code === 'KeyL' || e.key.toLowerCase() === 'l') { e.preventDefault?.(); toggleOverride('logo'); }

        if (isMod && (e.code === 'KeyZ' || e.key.toLowerCase() === 'z')) {
            e.preventDefault?.();
            if (e.shiftKey) await redo(); else await undo();
        }
        if (isMod && (e.code === 'KeyY' || e.key.toLowerCase() === 'y')) {
            e.preventDefault?.();
            await redo();
        }

        if (appMode === 'presentation') {
            const handled = await executePresentationHotkeys(e, isMod, isPreviewHovered, selectedCanvasItemIds, isTimelineHovered);
            if (handled) return;
        }

        if (isMod && (e.code === 'KeyS' || e.key.toLowerCase() === 's')) {
            e.preventDefault?.();
            const { activeServiceId, activeService, saveActiveService } = usePresentationStore.getState();
            if (activeServiceId && activeService?.fileHandle) {
                try {
                    await saveActiveService();
                    toast.success(t('service_saved', 'Service saved successfully'));
                    return;
                } catch (err) {
                    console.error('Auto-save failed:', err);
                }
            }
            if (appMode === 'presentation') {
                useModalStore.getState().openModal(ModalType.SAVE_NESTED_CONFIRM);
            }
        }
    }, [
        appMode,
        previewSlideId,
        activePresentation,
        activeVerse,
        handleNext,
        handlePrev,
        closeProjector,
        openProjector,
        undo,
        redo,
        toggleOverride,
        selectedCanvasItemIds,
        isTimelineHoveredProp,
        setPreviewSlide,
        setLiveSlide,
        t
    ]);

    const executeHotkeyRef = useRef(executeHotkey);
    executeHotkeyRef.current = executeHotkey;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => executeHotkeyRef.current(e);
        window.addEventListener('keydown', handleKeyDown, true);

        let unsubscribeRelay: (() => void) | undefined;
        if (IpcService.isElectron()) {
            unsubscribeRelay = IpcService.on('relay-keydown', (payload: unknown) => {
                const data = (payload ?? {}) as Partial<HotkeyEvent>;
                if (data.key) {
                    executeHotkeyRef.current({ ...data, key: data.key, isRelayed: true });
                }
            });
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            unsubscribeRelay?.();
        };
    }, []);

    useEffect(() => {
        const unsubscribeRemote = registerRemoteCommands({
            handleNext,
            handlePrev,
            toggleOverride,
            openProjector,
            closeProjector,
            previewSlideId,
            setLiveSlide,
            onRequestRemoteUpdate
        });

        return () => {
            unsubscribeRemote?.();
        };
    }, [closeProjector, handleNext, handlePrev, onRequestRemoteUpdate, openProjector, previewSlideId, setLiveSlide, toggleOverride]);
}
