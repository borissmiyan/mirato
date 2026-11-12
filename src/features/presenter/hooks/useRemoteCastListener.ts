import { useEffect, useRef } from 'react';
import { IpcService } from '@/core/services/ipcService';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useRelayStore, ConnectedSpeaker } from '@/core/store/relayStore';
import { db } from '@/core/db';
import { IPresentationFile } from '@/core/types';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';

/**
 * Hook to listen for remote presentation casting commands and privacy state
 * across the local network from speaker laptop to the HDMI projector PC.
 */
export function useRemoteCastListener(openProjector: () => Promise<unknown> | void) {
    const hasOpenedProjectorRef = useRef(false);

    useEffect(() => {
        // Sync active live slide or verse as soon as transmitter connects to receiver
        const unsubRelay = useRelayStore.subscribe((state, prevState) => {
            if (state.isTransmitterConnected && !prevState.isTransmitterConnected) {
                const pres = usePresentationStore.getState();
                if (pres.liveSlideId && pres.activePresentation) {
                    const slide = pres.activePresentation.slides.find(s => s.id === pres.liveSlideId);
                    if (slide) {
                        LiveSyncService.showSlide(
                            slide,
                            pres.activePresentationId || undefined,
                            pres.liveRootPresentationId || undefined,
                            pres.liveNavigationParentSlideId || undefined
                        );
                    }
                }
                const bible = useBibleStore.getState();
                if (bible.activeVerse) {
                    LiveSyncService.showVerse(bible.activeVerse, bible.secondTranslationId);
                }
            }
        });

        if (!IpcService.isElectron()) {
            return () => {
                unsubRelay();
            };
        }

        const unsubSpeaker = IpcService.on('remote:speaker-connected', (speaker: unknown) => {
            useRelayStore.getState().setSpeakerConnected(speaker as ConnectedSpeaker | null);
        });

        const unsubDisconnect = IpcService.on('remote:client-disconnected', () => {
            hasOpenedProjectorRef.current = false;
            useRelayStore.getState().setSpeakerConnected(null);
            useRelayStore.getState().setPrivacyMode(false);
            useRelayStore.getState().setStreamMode('idle');
        });

        const unsubPrivacy = IpcService.on('remote:set-privacy', (active: boolean) => {
            useRelayStore.getState().setPrivacyMode(active);
        });

        const unsubCommand = IpcService.on('remote:command-received', async (command: string, payload: unknown) => {
            if (command === 'CAST_PRESENTATION') {
                const data = payload as {
                    presentation: IPresentationFile;
                    startSlideIndex?: number;
                    isPrivacy?: boolean;
                    speakerName?: string;
                };

                if (data?.presentation && Array.isArray(data.presentation.slides) && data.presentation.slides.length > 0) {
                    const pres = data.presentation;
                    // Persist presentation in local DB so it has all slide data and styles
                    await db.presentationFiles.put(pres);

                    // Set privacy mode if requested
                    if (typeof data.isPrivacy === 'boolean') {
                        useRelayStore.getState().setPrivacyMode(data.isPrivacy);
                    }
                    useRelayStore.getState().setStreamMode('slide');

                    // Set presentation active in presentation store immediately
                    const presStore = usePresentationStore.getState();
                    usePresentationStore.setState({ activePresentation: pres, activePresentationId: pres.id });
                    await presStore.setActivePresentation(pres.id);

                    const startSlide = pres.slides[data.startSlideIndex || 0] || pres.slides[0];
                    presStore.setPreviewSlide(startSlide.id, pres.id);
                    presStore.setLiveSlide(startSlide.id, pres.id);

                    // Open projector once and display slide natively
                    if (!hasOpenedProjectorRef.current) {
                        hasOpenedProjectorRef.current = true;
                        await openProjector();
                    }
                    LiveSyncService.showAppMode('presentation');
                    LiveSyncService.showSlide(startSlide, pres.id);
                }
            } else if (command === 'CAST_NAVIGATE_SLIDE') {
                const data = payload as { slideId: string; presentationId?: string };
                if (data?.slideId) {
                    const presStore = usePresentationStore.getState();
                    const activePres = presStore.activePresentation;
                    const presId = data.presentationId || activePres?.id;
                    const slide = activePres?.slides.find(s => s.id === data.slideId);
                    if (slide) {
                        presStore.setPreviewSlide(slide.id, presId);
                        presStore.setLiveSlide(slide.id, presId);
                        LiveSyncService.showSlide(slide, presId);
                    }
                }
            } else if (command === 'CAST_STOP') {
                hasOpenedProjectorRef.current = false;
                useRelayStore.getState().setPrivacyMode(false);
                useRelayStore.getState().setStreamMode('idle');
                usePresentationStore.getState().setLiveSlide(null);
                LiveSyncService.clear();
            }
        });

        const unsubProjectorCmd = IpcService.on('remote:projector-command', async (cmd: string) => {
            if (cmd === 'show-slide' || cmd === 'show-verse' || cmd === 'show-multiverses') {
                if (!hasOpenedProjectorRef.current) {
                    hasOpenedProjectorRef.current = true;
                    await openProjector();
                }
                useRelayStore.getState().setStreamMode('slide');
            }
        });

        return () => {
            unsubRelay();
            unsubSpeaker();
            unsubDisconnect();
            unsubPrivacy();
            unsubCommand();
            unsubProjectorCmd();
        };
    }, [openProjector]);
}

