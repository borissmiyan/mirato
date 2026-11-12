import { useEffect } from 'react';
import { IpcService } from '@/core/services/ipcService';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
// eslint-disable-next-line no-restricted-imports
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { db } from '@/core/db';
import { toast } from '@/core/utils/toast';
import { ILogo } from '@/core/types';
import { OverrideType } from '@/core/store/uiAtoms';
import { TFunction } from 'i18next';

interface ProjectorLifecycleSyncProps {
    themeAccent: string;
    activeOverride: OverrideType | null;
    activeLogo: ILogo | null;
    appMode: 'scripture' | 'presentation' | 'hymns';
    setProjectorOpen: (open: boolean) => void;
    handleNext: (detached?: boolean, preferLiveAnchor?: boolean) => Promise<void>;
    handlePrev: (detached?: boolean, preferLiveAnchor?: boolean) => Promise<void>;
    setLiveSlide: (id: string | null) => void;
    toggleOverride: (type: OverrideType) => void;
    setIsPlaying: (playing: boolean) => void;
    t: TFunction;
}

/**
 * Handles projector window IPC handshakes, render errors, timer events, and media requests.
 */
export function useProjectorLifecycleSync({
    themeAccent,
    activeOverride,
    activeLogo,
    appMode,
    setProjectorOpen,
    handleNext,
    handlePrev,
    setLiveSlide,
    toggleOverride,
    setIsPlaying,
    t
}: ProjectorLifecycleSyncProps): void {
    useEffect(() => {
        if (!IpcService.isElectron()) return;
        const unsub = IpcService.on('projector:render-error', (payload: unknown) => {
            const data = (payload ?? {}) as { message?: string };
            toast.error(t('projector_render_error', 'Сбой вывода на проекторе: {{error}}', { error: data.message || 'Ошибка рендеринга' }));
        });
        return unsub;
    }, [t]);

    useEffect(() => {
        if (!IpcService.isElectron()) return;
        const unsub = IpcService.on('projector-ready', (p?: { ratio: number }) => {
            if (p?.ratio) usePresenterStore.getState().updateDisplay({ aspectRatio: p.ratio });
            IpcService.send('projector-command', 'update-theme', themeAccent);
            LiveSyncService.syncSettings(usePresenterStore.getState().settings);
            setProjectorOpen(true);

            setTimeout(() => {
                LiveSyncService.showAppMode(appMode === 'hymns' ? 'hymns' : (appMode === 'scripture' ? 'scripture' : 'presentation'));
                LiveSyncService.setOverride(activeOverride, activeOverride === 'logo' ? activeLogo : null);

                if (appMode === 'scripture') {
                    const bibleState = useBibleStore.getState();
                    if (bibleState.isMultiVerseMode && bibleState.selectedVerses.length >= 2) {
                        LiveSyncService.showMultiVerses(bibleState.selectedVerses, bibleState.secondTranslationId);
                    } else if (bibleState.activeVerse) {
                        LiveSyncService.showVerse(bibleState.activeVerse, bibleState.secondTranslationId);
                    }
                } else {
                    const presStore = usePresentationStore.getState();
                    let targetSlideId = presStore.liveSlideId || presStore.previewSlideId;
                    let pres = presStore.selectedPresentation || presStore.activePresentation;

                    if (!targetSlideId && presStore.activePresentationId) {
                        db.presentationFiles.get(presStore.activePresentationId).then(dbPres => {
                            if (dbPres?.slides?.length) {
                                targetSlideId = dbPres.slides[0].id;
                                pres = dbPres;
                                LiveSyncService.showSlide(
                                    dbPres.slides[0],
                                    pres?.id,
                                    presStore.activePresentationId || undefined,
                                    presStore.liveNavigationParentSlideId || null
                                );
                            }
                        });
                        return;
                    }

                    if (targetSlideId) {
                        let slide = pres?.slides?.find(s => s.id === targetSlideId);
                        if (!slide) {
                            for (const p of Object.values(presStore.nestedPresentationsCache)) {
                                const s = p.slides?.find((sl) => sl.id === targetSlideId);
                                if (s) { slide = s; break; }
                            }
                        }
                        if (slide) {
                            LiveSyncService.showSlide(
                                slide,
                                pres?.id,
                                presStore.activePresentationId || undefined,
                                presStore.liveNavigationParentSlideId || null
                            );
                        }
                    }
                }
            }, 100);
        });

        const unsubClosed = IpcService.on('projector-closed', () => {
            setProjectorOpen(false);
            usePresentationStore.getState().setLiveSlide(null);
            useBibleStore.setState({ projectorIsLive: false });
        });

        return () => {
            unsub();
            unsubClosed();
        };
    }, [themeAccent, activeOverride, activeLogo, appMode, setProjectorOpen]);

    useEffect(() => {
        if (!IpcService.isElectron()) return;
        const unsub = LiveSyncService.onTimerAction(({ action, payload }) => {
            if (action === 'next_slide') {
                handleNext(false, true);
            } else if (action === 'prev_slide') {
                handlePrev(false, true);
            } else if (action === 'navigate_to' && (payload as { slideId?: string })?.slideId) {
                setLiveSlide((payload as { slideId: string }).slideId);
            } else if (action === 'override') {
                toggleOverride(payload as OverrideType);
            }
        });
        return () => unsub();
    }, [handleNext, handlePrev, setLiveSlide, toggleOverride]);

    useEffect(() => {
        if (!IpcService.isElectron()) return;
        const unsub = LiveSyncService.onVideoStatus(({ isPlaying: vPlaying }) => {
            setIsPlaying(vPlaying);
        });
        return () => unsub();
    }, [setIsPlaying]);

    useEffect(() => {
        if (!IpcService.isElectron()) return;
        const unsub = IpcService.on('remote:request-media', async ({ id, requestId }) => {
            try {
                let entry: { data?: Blob; mimeType?: string } | undefined = await db.backgrounds.get(id);
                if (!entry) entry = await db.mediaPool.get(id);

                if (entry?.data) {
                    const buffer = await entry.data.arrayBuffer();
                    IpcService.send('remote:media-response', { 
                        requestId, 
                        data: buffer, 
                        mimeType: entry.mimeType || 'image/jpeg' 
                    });
                } else {
                    IpcService.send('remote:media-response', { requestId, error: 'Media not found' });
                }
            } catch (err) {
                IpcService.send('remote:media-response', { requestId, error: 'Database access error' });
            }
        });
        return () => unsub();
    }, []);
}
