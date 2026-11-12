import { IpcService } from '@/core/services/ipcService';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { LiveSyncService } from '@/core/services/liveSyncService';
import { presentationService } from '@/core/services/presentationService';
import { db } from '@/core/db';
import { Verse } from '@/core/types';
import { OverrideType } from '@/core/store/uiAtoms';

interface RemoteCommandsProps {
    handleNext: (detached?: boolean, preferLiveAnchor?: boolean) => Promise<void>;
    handlePrev: (detached?: boolean, preferLiveAnchor?: boolean) => Promise<void>;
    toggleOverride: (type: OverrideType) => void;
    openProjector: () => Promise<void>;
    closeProjector: () => void;
    previewSlideId: string | null;
    setLiveSlide: (id: string | null) => void;
    onRequestRemoteUpdate: () => void;
}

/**
 * Handles incoming remote IPC commands (mobile controller, remote sync, etc.).
 */
export function registerRemoteCommands({
    handleNext,
    handlePrev,
    toggleOverride,
    openProjector,
    closeProjector,
    previewSlideId,
    setLiveSlide,
    onRequestRemoteUpdate
}: RemoteCommandsProps): (() => void) | undefined {
    if (!IpcService.isElectron()) return undefined;

    return IpcService.on('remote:command-received', async (command: string, payload: unknown) => {
        if (command === 'NEXT') handleNext(false, true);
        else if (command === 'PREV') handlePrev(false, true);
        else if (command === 'OVERRIDE_BLACK') toggleOverride('blackout');
        else if (command === 'OVERRIDE_WHITE') toggleOverride('whiteout');
        else if (command === 'OVERRIDE_LOGO') toggleOverride('logo');
        else if (command === 'MEDIA_PLAY') {
            const liveSlideId = usePresentationStore.getState().liveSlideId;
            if (liveSlideId) LiveSyncService.sendVideoCommand(liveSlideId, 'play');
        } else if (command === 'MEDIA_PAUSE') {
            const liveSlideId = usePresentationStore.getState().liveSlideId;
            if (liveSlideId) LiveSyncService.sendVideoCommand(liveSlideId, 'pause');
        } else if (command === 'MEDIA_TOGGLE') {
            presentationService.toggleLiveMedia();
        } else if (command === 'MEDIA_STOP') {
            const liveSlideId = usePresentationStore.getState().liveSlideId;
            if (liveSlideId) {
                LiveSyncService.sendVideoCommand(liveSlideId, 'pause');
                LiveSyncService.sendVideoCommand(liveSlideId, 'seek', 0);
            }
        } else if (command === 'BIBLE_QUERY') {
            const queryPayload = payload as Record<string, unknown>;
            const { type, ...query } = queryPayload;
            let results: unknown[] = [];

            try {
                if (type === 'GET_TRANSLATIONS') {
                    results = await db.translations.toArray();
                } else if (type === 'GET_BOOKS') {
                    results = await db.books.where('translationId').equals(query.translationId as string).toArray();
                } else if (type === 'GET_VERSES') {
                    results = await db.verses
                        .where('[translationId+bookId+chapter]')
                        .equals([query.translationId as string, query.bookId as string, query.chapter as number])
                        .toArray();
                } else if (type === 'SEARCH') {
                    results = await db.verses
                        .where('text')
                        .startsWithIgnoreCase(query.text as string)
                        .limit(50)
                        .toArray();
                }

                IpcService.send('remote:bible-results', { requestId: queryPayload.requestId, results });
            } catch (err) {
                console.error('Remote Bible Query failed:', err);
            }
        } else if (command === 'BIBLE_SELECT') {
            const selectPayload = payload as Record<string, unknown>;
            const bibleState = useBibleStore.getState();

            if (Array.isArray(selectPayload.verses)) {
                bibleState.setSelectedVerses(selectPayload.verses as Verse[]);
                bibleState.commitToProjector();
                openProjector();
            } else if (selectPayload.verse) {
                bibleState.setActiveVerse(selectPayload.verse as Verse);
                bibleState.commitToProjector();
                openProjector();
            }
        } else if (command === 'SLIDE_SELECT') {
            const selectPayload = payload as { id?: string };
            if (selectPayload.id) {
                const store = usePresentationStore.getState();
                store.setPreviewSlide(selectPayload.id);
                store.setLiveSlide(selectPayload.id);
                openProjector();
            }
        } else if (command === 'PROJECTOR_START') {
            const presState = usePresentationStore.getState();
            let target = previewSlideId;
            if (!target) {
                const pres = presState.selectedPresentation || presState.activePresentation;
                if (pres?.slides?.length) target = pres.slides[0].id;
            }
            if (target) {
                setLiveSlide(target);
                openProjector();
            }
        } else if (command === 'PROJECTOR_STOP') {
            closeProjector();
        } else if (command === 'GET_STATE') {
            onRequestRemoteUpdate();
        }
    });
}
