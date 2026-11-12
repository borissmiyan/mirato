import React, { useEffect, useState } from 'react';
import { Verse, ISlide } from '@/core/types';
import { useTranslation } from 'react-i18next';
import SlideDisplay from './SlideDisplay';
import { SlideBackground } from './SlideBackground';
import { PresenterSettings } from '@/core/types';
import { DEFAULT_SETTINGS } from '@/features/presenter/store/presenterStore';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/core/utils/cn';
import { ILogo, ILogoGroup } from '@/core/types';
import { useLogoUrl } from '@/core/hooks/useLogoUrl';
import { PRELOADED_LOGOS } from '@/core/data/logoData';
import { PresenterService } from '../../services/presenterService';
import { IpcService } from '@/core/services/ipcService';
import { usePresentationStore } from '../../store/presentationStore';
import { WebRtcRelayService, WebRtcSignal } from '@/core/services/WebRtcRelayService';

const ProjectorView: React.FC = () => {
    const { t } = useTranslation();
    
    const [verse, setVerse] = useState<Verse | null>(null);
    const [multiVerses, setMultiVerses] = useState<Verse[] | null>(null);
    const [isMultiVerseMode, setIsMultiVerseMode] = useState(false);
    const [slide, setSlide] = useState<ISlide | null>(null);
    const [previewSlide, setPreviewSlide] = useState<ISlide | null>(null);
    const [appMode, setAppMode] = useState<'scripture' | 'presentation'>('scripture');
    const [secondTranslationId, setSecondTranslationId] = useState<string | null>(null);
    const [settings, setSettings] = useState<PresenterSettings>(DEFAULT_SETTINGS);
    const [relayStream, setRelayStream] = useState<MediaStream | null>(null);
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const webRtcReceiverRef = React.useRef<WebRtcRelayService | null>(null);
    const settingsRef = React.useRef(settings);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    // Live Overrides
    const [activeOverride, setActiveOverride] = useState<'blackout' | 'whiteout' | 'logo' | null>(null);
    const [activeLogo, setActiveLogo] = useState<ILogo | null>(null);
    const logoUrl = useLogoUrl(activeLogo);

    // Fetch parallel verse if second translation is active
    const parallelVerse = useLiveQuery(
        async () => {
            if (!verse || !secondTranslationId) return null;
            return await db.verses
                .where('[translationId+bookId+chapter]')
                .equals([secondTranslationId, verse.bookId, verse.chapter])
                .and(v => v.verseNumber === verse.verseNumber)
                .first();
        },
        [verse?.id, secondTranslationId]
    );


    // 1. Lifecycle and IPC Initialization
    useEffect(() => {
        document.body.classList.add('projector-mode');

        const reportRatio = () => {
            const ratio = window.innerWidth / window.innerHeight;
            IpcService.send('projector-ready', { ratio });
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!IpcService.isElectron()) return;

            // Direct Fullscreen Toggle
            if (e.key === 'F11' || (e.code === 'KeyF' && (e.metaKey || e.ctrlKey))) {
                e.preventDefault();
                IpcService.invoke('projector:toggle-fullscreen');
                return;
            }

            // List of codes to relay to the main window (layout independent)
            const codesToRelay = [
                'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp',
                'Space', 'Enter', 'Escape',
                'KeyB', 'KeyW', 'KeyL', 'KeyF', 'KeyH', 'KeyZ', 'KeyY', 'KeyC'
            ];

            if (codesToRelay.includes(e.code) || e.ctrlKey || e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                IpcService.send('relay-keydown', {
                    key: e.key,
                    code: e.code,
                    ctrlKey: e.ctrlKey,
                    metaKey: e.metaKey,
                    shiftKey: e.shiftKey,
                    altKey: e.altKey
                });
            }
        };

        const findLogo = (id: string | null, logoSettings: PresenterSettings['logo']) => {
            if (!id) return null;
            
            const allLogos = [
                ...(logoSettings.customLogos || []),
                ...(logoSettings.customGroups?.flatMap((g: ILogoGroup) => g.logos) || []),
                ...(logoSettings.logoGroups?.flatMap((g: ILogoGroup) => g.logos) || []),
                ...PRELOADED_LOGOS.flatMap(g => g.logos)
            ];
            
            return allLogos.find(l => l.id === id) || null;
        };

        const handleCommand = (command: string, rawPayload: unknown) => {
            const payload = (rawPayload ?? {}) as Record<string, unknown>;
            switch (command) {
                case 'show-verse':
                    setVerse(payload.verse as Verse);
                    setMultiVerses(null);
                    setIsMultiVerseMode(false);
                    setSecondTranslationId(payload.secondTranslationId as string | null);
                    setSlide(null);
                    break;
                case 'show-multiverses':
                    setMultiVerses(payload.verses as Verse[]);
                    setIsMultiVerseMode(true);
                    setVerse(null);
                    setSecondTranslationId(payload.secondTranslationId as string | null);
                    setSlide(null);
                    break;
                case 'show-slide': {
                    const slideObj = payload.slide as ISlide;
                    setSlide(slideObj);
                    setVerse(null);
                    setMultiVerses(null);
                    setIsMultiVerseMode(false);
                    // Update store locally so useAudioSync knows what's live
                    if (slideObj) {
                        usePresentationStore.getState().setLiveSlide(
                            slideObj.id, 
                            payload.presentationId as string | undefined,
                            payload.rootPresentationId as string | undefined,
                            payload.navigationParentSlideId as string | null | undefined
                        );
                    }
                    break;
                }
                case 'show-preview-slide': {
                    const previewObj = payload.slide as ISlide | null;
                    setPreviewSlide(previewObj);
                    if (previewObj) {
                        usePresentationStore.getState().setPreviewSlide(
                            previewObj.id, 
                            payload.presentationId as string | undefined,
                            payload.rootPresentationId as string | undefined,
                            payload.navigationParentSlideId as string | null | undefined
                        );
                    }
                    break;
                }
                case 'set-app-mode':
                    setAppMode(rawPayload as 'scripture' | 'presentation');
                    break;
                case 'set-override':
                    setActiveOverride(payload.type as 'blackout' | 'whiteout' | 'logo' | null);
                    if (payload.type === 'logo') {
                        if (payload.logo) {
                            setActiveLogo(payload.logo as ILogo);
                        } else {
                            // Try to resolve from ID if payload.logo is missing
                            const active = findLogo(settingsRef.current.logo.activeLogoId, settingsRef.current.logo);
                            setActiveLogo(active);
                        }
                    } else if (payload.url) {
                        setActiveLogo({ id: 'legacy', name: 'Legacy', url: payload.url as string });
                    } else {
                        setActiveLogo(null);
                    }
                    break;
                case 'update-theme':
                    document.documentElement.setAttribute('data-theme', String(rawPayload));
                    break;
                case 'sync-state':
                case 'update-settings': {
                    // Receive settings update
                    const settingsPayload = rawPayload as PresenterSettings;
                    const logoId = settingsPayload.logo?.activeLogoId;
                    if (logoId) {
                        const active = findLogo(logoId, settingsPayload.logo);
                        if (active) {
                            setActiveLogo(active);
                        }
                    }
                    setSettings(settingsPayload);
                    break;
                }
                case 'relay-signal':
                    if (!webRtcReceiverRef.current) {
                        webRtcReceiverRef.current = new WebRtcRelayService();
                    }
                    if (payload.type === 'offer') {
                        const sendSignal = (sig: unknown) => {
                            if (window.electron?.ipcRenderer?.remote?.sendRelaySignal) {
                                window.electron.ipcRenderer.remote.sendRelaySignal(sig);
                            } else if (window.electron?.ipcRenderer?.send) {
                                window.electron.ipcRenderer.send('remote:send-relay-signal', sig);
                            }
                        };
                        webRtcReceiverRef.current.initReceiver(
                            rawPayload as RTCSessionDescriptionInit,
                            (stream) => {
                                setRelayStream(stream);
                            },
                            (answerSignal) => {
                                sendSignal(answerSignal);
                            }
                        ).then((answer) => {
                            sendSignal(answer);
                        });
                    } else {
                        webRtcReceiverRef.current.handleSignal(rawPayload as WebRtcSignal);
                    }
                    break;
                case 'stop-relay':
                    if (webRtcReceiverRef.current) {
                        webRtcReceiverRef.current.cleanup();
                        webRtcReceiverRef.current = null;
                    }
                    setRelayStream(null);
                    break;
                case 'clear':
                    setVerse(null);
                    setSlide(null);
                    setMultiVerses(null);
                    setIsMultiVerseMode(false);
                    setSecondTranslationId(null);
                    setActiveOverride(null);
                    setActiveLogo(null);
                    break;
            }
        };

        reportRatio();
        window.addEventListener('resize', reportRatio);
        window.addEventListener('keydown', handleKeyDown, true);

        const unsubscribe = PresenterService.subscribeToCommands(handleCommand);

        return () => {
            document.body.classList.remove('projector-mode');
            window.removeEventListener('resize', reportRatio);
            window.removeEventListener('keydown', handleKeyDown, true);
            if (webRtcReceiverRef.current) {
                webRtcReceiverRef.current.cleanup();
                webRtcReceiverRef.current = null;
            }
            unsubscribe?.();
        };
    }, []);

    useEffect(() => {
        if (videoRef.current && relayStream) {
            videoRef.current.srcObject = relayStream;
        }
    }, [relayStream]);

    const handleDoubleClick = () => {
        if (IpcService.isElectron()) {
            IpcService.invoke('projector:toggle-fullscreen');
        }
    };

    return (
        <div 
            className="w-screen h-screen overflow-hidden bg-black relative select-none"
            onDoubleClick={handleDoubleClick}
        >
            {relayStream ? (
                <div className="w-full h-full flex items-center justify-center bg-black">
                    <video 
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-contain"
                    />
                </div>
            ) : (
                <div className={cn(
                    "w-full h-full transition-opacity duration-500",
                    activeOverride ? "opacity-0" : "opacity-100"
                )}>
                    <SlideDisplay
                        isProjector={true}
                        activeVerse={verse}
                        selectedSlide={slide}
                        parallelVerse={parallelVerse}
                        multiVerses={multiVerses}
                        isMultiVerseMode={isMultiVerseMode}
                        appMode={appMode}
                        settings={settings}
                    />
                </div>
            )}


            {/* Blackout Overlay */}
            <div className={cn(
                "absolute inset-0 z-100 transition-opacity duration-700 pointer-events-none",
                activeOverride === 'blackout' ? "opacity-100" : "opacity-0 invisible"
            )}>
                {activeOverride === 'blackout' && (
                    <SlideBackground background={settings.overrides.blackout.background} />
                )}
            </div>

            {/* Whiteout Overlay */}
            <div className={cn(
                "absolute inset-0 z-101 transition-opacity duration-700 pointer-events-none",
                activeOverride === 'whiteout' ? "opacity-100" : "opacity-0 invisible"
            )}>
                {activeOverride === 'whiteout' && (
                    <SlideBackground background={settings.overrides.whiteout.background} />
                )}
            </div>

            {/* Logo Overlay */}
            <div className={cn(
                "absolute inset-0 z-102 transition-opacity duration-700 pointer-events-none",
                activeOverride === 'logo' ? "opacity-100" : "opacity-0 invisible"
            )}>
                {activeOverride === 'logo' && (
                    <>
                        <SlideBackground background={settings.overrides.logo.background} />
                        <div className="absolute inset-0 flex items-center justify-center p-24">
                            <div className="relative z-10 w-full h-full flex items-center justify-center font-serif">
                                {logoUrl ? (
                                    <img src={logoUrl} alt="Church Logo" className="max-w-[70%] max-h-[70%] object-contain" />
                                ) : (
                                    <div className="text-stone-700 flex flex-col items-center gap-6">
                                        <div className="w-32 h-32 rounded-full border-4 border-stone-800 flex items-center justify-center opacity-20">
                                            <span className="text-4xl font-black">D</span>
                                        </div>
                                        <h1 className="text-2xl font-black uppercase tracking-[0.3em] opacity-20">Deck.CE</h1>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ProjectorView;
