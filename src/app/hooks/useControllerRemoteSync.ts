import { useCallback, useEffect } from 'react';
import { IpcService } from '@/core/services/ipcService';
import { remoteSyncService } from '@/core/services/remoteSyncService';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { Verse, ILogo, PresenterSettings } from '@/core/types';
import { OverrideType } from '@/core/store/uiAtoms';

interface ControllerRemoteSyncProps {
    appMode: 'scripture' | 'presentation' | 'hymns';
    activeVerse: Verse | null;
    projectorIsLive: boolean;
    liveSlideId: string | null;
    previewSlideId: string | null;
    lang: string;
    themeAccent: string;
    isPlaying: boolean;
    activeOverride: OverrideType | null;
    activeLogo: ILogo | null;
    activeLogoUrl: string | null;
    presenterSettings: PresenterSettings;
}

/**
 * Manages bi-directional synchronization of controller state with the remote server.
 */
export function useControllerRemoteSync({
    appMode,
    activeVerse,
    projectorIsLive,
    liveSlideId,
    previewSlideId,
    lang,
    themeAccent,
    isPlaying,
    activeOverride,
    activeLogo,
    activeLogoUrl,
    presenterSettings
}: ControllerRemoteSyncProps): () => Promise<void> {
    const updateRemoteState = useCallback(async () => {
        const { 
            activePresentation: aPres, 
            selectedPresentation: sPres, 
            presentationStack: pStack 
        } = usePresentationStore.getState();

        await remoteSyncService.updateRemoteState({
            appMode,
            activeVerse,
            activePresentation: aPres,
            selectedPresentation: sPres,
            presentationStack: pStack,
            projectorIsLive,
            liveSlideId,
            previewSlideId,
            lang,
            themeAccent,
            isPlaying,
            activeOverride,
            activeLogo,
            activeLogoUrl,
            settings: presenterSettings
        });
    }, [appMode, activeVerse, projectorIsLive, liveSlideId, previewSlideId, lang, themeAccent, isPlaying, activeOverride, activeLogoUrl, activeLogo, presenterSettings]);

    useEffect(() => {
        updateRemoteState();
    }, [updateRemoteState]);

    useEffect(() => {
        if (!IpcService.isElectron()) return;
        const unsub = IpcService.on('remote:request-state', () => updateRemoteState());
        return () => unsub();
    }, [updateRemoteState]);

    return updateRemoteState;
}
