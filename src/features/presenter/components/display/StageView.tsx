import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Verse, ISlide, ICanvasSlide, PresenterSettings } from '@/core/types';
import { DEFAULT_SETTINGS } from '@/features/presenter/store/presenterStore';
import { db } from '@/core/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/core/utils/cn';
import SlideDisplay from './SlideDisplay';
import { usePresentationStore } from '../../store/presentationStore';
import { PresenterService } from '../../services/presenterService';
import { QRCodeSVG } from 'qrcode.react';
import { WebRtcRelayService, WebRtcSignal } from '@/core/services/WebRtcRelayService';

const StageView: React.FC = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<PresenterSettings>(DEFAULT_SETTINGS);
    const [slide, setSlide] = useState<ISlide | null>(null);
    const [verse, setVerse] = useState<Verse | null>(null);
    const [multiVerses, setMultiVerses] = useState<Verse[] | null>(null);
    const [isMultiVerseMode, setIsMultiVerseMode] = useState(false);
    const [appMode, setAppMode] = useState<'scripture' | 'presentation'>('scripture');
    const [secondTranslationId, setSecondTranslationId] = useState<string | null>(null);
    const [currentPresId, setCurrentPresId] = useState<string | null>(null);
    const [currentRootPresId, setCurrentRootPresId] = useState<string | null>(null);
    const [serverInfo, setServerInfo] = useState<{ ip: string, port: number, pin: string } | null>(null);
    const [relayStream, setRelayStream] = useState<MediaStream | null>(null);
    const stageVideoRef = React.useRef<HTMLVideoElement | null>(null);
    const webRtcReceiverRef = React.useRef<WebRtcRelayService | null>(null);

    const activePresentationId = usePresentationStore(s => s.activePresentationId);
    
    // Fetch parallel verse
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

    // Fetch previous/next slides taking nested presentations and hymns into account
    const resolvedSlides = useLiveQuery(
        async () => {
            if (!slide) return { prev: null, next: null };
            
            // 1. Direct presentation containing the slide
            const directPresId = currentPresId || activePresentationId;
            const directPres = directPresId ? await db.presentationFiles.get(directPresId) : null;
            const directSlides = directPres?.slides || [];
            const directIndex = directSlides.findIndex(s => s.id === slide.id);

            // 2. Root service presentation (if inside nested deck or hymn)
            const rootPresId = currentRootPresId && currentRootPresId !== directPresId ? currentRootPresId : null;
            const rootPres = rootPresId ? await db.presentationFiles.get(rootPresId) : null;
            const rootSlides = rootPres?.slides || [];

            let prev: ISlide | null = null;
            let next: ISlide | null = null;

            if (directIndex !== -1) {
                // Internal navigation inside the current presentation/hymn
                if (directIndex > 0) {
                    prev = directSlides[directIndex - 1];
                }
                if (directIndex < directSlides.length - 1) {
                    next = directSlides[directIndex + 1];
                }
            }

            // Boundary transitions across nested presentation into master timeline
            if (rootSlides.length > 0 && directPresId) {
                const parentSlideIndex = rootSlides.findIndex(s => {
                    const nested = s as { masterPresentationId?: string; presentationId?: string; linkedPresentationId?: string };
                    return nested.masterPresentationId === directPresId || nested.presentationId === directPresId || nested.linkedPresentationId === directPresId;
                });

                if (parentSlideIndex !== -1) {
                    if (!prev && parentSlideIndex > 0) {
                        prev = rootSlides[parentSlideIndex - 1];
                    }
                    if (!next && parentSlideIndex < rootSlides.length - 1) {
                        next = rootSlides[parentSlideIndex + 1];
                    }
                }
            }

            return { prev, next };
        },
        [slide?.id, currentPresId, currentRootPresId, activePresentationId]
    );

    const prevSlide = resolvedSlides?.prev || null;
    const nextSlide = resolvedSlides?.next || null;

    useEffect(() => {
        document.body.classList.add('projector-mode'); // For consistent global styles if needed

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
                    const presId = (payload.presentationId as string) || (slideObj as { presentationId?: string })?.presentationId || null;
                    const rootId = (payload.rootPresentationId as string) || null;
                    setCurrentPresId(presId);
                    setCurrentRootPresId(rootId);
                    if (presId) {
                        usePresentationStore.getState().setActivePresentation(presId);
                    }
                    break;
                }
                case 'set-app-mode':
                    setAppMode(rawPayload as 'scripture' | 'presentation');
                    break;
                case 'sync-state':
                case 'update-settings':
                    setSettings(rawPayload as PresenterSettings);
                    break;
                case 'set-relay-pin': {
                    const pinPayload = payload as { ip?: string; port?: number; pin?: string };
                    setServerInfo(prev => ({
                        ip: pinPayload.ip || prev?.ip || '127.0.0.1',
                        port: pinPayload.port || prev?.port || 3211,
                        pin: pinPayload.pin
                    }));
                    break;
                }
                case 'relay-signal':
                    if (!webRtcReceiverRef.current) {
                        webRtcReceiverRef.current = new WebRtcRelayService();
                    }
                    if (payload.type === 'offer') {
                        webRtcReceiverRef.current.initReceiver(
                            rawPayload as RTCSessionDescriptionInit,
                            (stream) => {
                                setRelayStream(stream);
                            },
                            () => {}
                        );
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
                    break;
            }
        };

        const unsubscribe = PresenterService.subscribeToCommands(handleCommand);

        if (window.electron?.ipcRenderer?.remote) {
            window.electron.ipcRenderer.remote.getInfo().then((info) => {
                if (info?.success) {
                    setServerInfo({ ip: info.ip, port: info.port, pin: info.pin });
                }
            });
        }

        return () => {
            document.body.classList.remove('projector-mode');
            if (webRtcReceiverRef.current) {
                webRtcReceiverRef.current.cleanup();
                webRtcReceiverRef.current = null;
            }
            unsubscribe?.();
        };
    }, []);

    useEffect(() => {
        if (stageVideoRef.current && relayStream) {
            stageVideoRef.current.srcObject = relayStream;
        }
    }, [relayStream]);

    const stage = settings.stage ?? DEFAULT_SETTINGS.stage;
    const { layout, gap, cornerRadius, showRemoteQr } = stage;

    // A helper to render a slide in a miniaturized container without background overlaps
    const renderMiniSlide = (targetSlide: ISlide | null, label: string) => {
        if (!targetSlide) return (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-500 opacity-50 p-4">
                <span className="text-sm font-bold uppercase tracking-widest">{label}</span>
                <span className="text-xs mt-2">No Slide</span>
            </div>
        );

        return (
            <div className="relative w-full h-full overflow-hidden flex flex-col">
                <div className="absolute top-0 left-0 bg-stone-900/80 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 z-10 rounded-br-xl shadow-lg border-b border-r border-white/10">
                    {label}
                </div>
                <div className="flex-1 w-full h-full relative isolate pointer-events-none transform origin-top-left scale-[1]">
                    <SlideDisplay
                        isProjector={true}
                        selectedSlide={targetSlide}
                        settings={settings}
                        appMode={appMode}
                        isPreloading={true}
                    />
                </div>
            </div>
        );
    };

    const renderCard = (card: typeof layout[0]) => {
        if (!card.visible) return null;

        const content = (() => {
            switch (card.id) {
                case 'current':
                    return (
                        <div className="relative w-full h-full overflow-hidden flex flex-col">
                            <div className="absolute top-0 left-0 bg-accent/80 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 z-10 rounded-br-xl shadow-lg">
                                {t('stage_current_slide', 'Current Slide')}
                            </div>
                            <div className="flex-1 w-full h-full relative isolate pointer-events-none">
                                {relayStream ? (
                                    <video
                                        ref={stageVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-contain bg-black"
                                    />
                                ) : (
                                    <SlideDisplay
                                        isProjector={true}
                                        activeVerse={verse}
                                        selectedSlide={slide}
                                        parallelVerse={parallelVerse}
                                        multiVerses={multiVerses}
                                        isMultiVerseMode={isMultiVerseMode}
                                        appMode={appMode}
                                        settings={settings}
                                        isMuted={true}
                                    />
                                )}
                            </div>
                        </div>
                    );
                case 'next':
                    return renderMiniSlide(nextSlide, t('stage_next_slide', 'Next Slide'));
                case 'prev':
                    return renderMiniSlide(prevSlide, t('stage_prev_slide', 'Previous Slide'));
                case 'sound':
                    // Just show basic info for now about active audio if any slide has it
                    const audioSettings = slide?.type === 'normal' ? (slide as ICanvasSlide).audio : null;
                    return (
                        <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 p-6 bg-stone-900/50">
                            <span className="text-sm font-bold uppercase tracking-widest text-stone-500 mb-2">{t('stage_sound_card', 'Sound Card')}</span>
                            {audioSettings?.path || audioSettings?.filename ? (
                                <div className="text-center">
                                    <p className="text-xs text-accent uppercase tracking-widest">{t('audio_playing', 'Audio Attached')}</p>
                                </div>
                            ) : (
                                <span className="text-xs opacity-50">No Audio</span>
                            )}
                        </div>
                    );
                default:
                    return null;
            }
        })();

        return (
            <div 
                key={card.id}
                className="bg-black border border-white/10 overflow-hidden shadow-2xl flex relative"
                style={{
                    gridColumn: `span ${card.w}`,
                    gridRow: `span ${card.h}`,
                    borderRadius: `${cornerRadius}px`
                }}
            >
                {content}
            </div>
        );
    };

    return (
        <div className="w-screen h-screen overflow-hidden bg-stone-950 relative">
            <div 
                className="w-full h-full p-8 grid"
                style={{
                    gridTemplateColumns: 'repeat(12, 1fr)',
                    gridAutoRows: 'minmax(0, 1fr)',
                    gap: `${gap}px`,
                }}
            >
                {layout.map(renderCard)}
            </div>

            {/* AirDeck PIN Floating Badge for Speaker */}
            {serverInfo?.pin && !relayStream && (
                <div className="absolute top-4 right-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-stone-900/90 border border-amber-500/30 text-stone-200 shadow-2xl backdrop-blur-xl animate-in fade-in">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-widest text-stone-400 font-bold">AirDeck PIN:</span>
                        <span className="px-2.5 py-0.5 rounded-xl bg-black font-sans tabular-nums font-black text-white text-base tracking-widest border border-white/10">
                            {serverInfo.pin}
                        </span>
                    </div>
                </div>
            )}

            {/* QR Code Overlay */}
            <div className={cn(
                "absolute inset-0 z-100 bg-stone-950/90 backdrop-blur-xl flex flex-col items-center justify-center transition-all duration-700",
                showRemoteQr && serverInfo ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}>
                {serverInfo && (
                    <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center transform scale-125">
                        <QRCodeSVG 
                            value={`http://${serverInfo.ip}:${serverInfo.port}/remote.html`}
                            size={400}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            level="H"
                        />
                        <div className="mt-12 text-center">
                            <p className="text-stone-500 uppercase tracking-[0.2em] font-bold text-sm mb-2">{t('connect_with_code', 'Connect Code')}</p>
                            <p className="text-6xl font-black tracking-widest text-stone-950">{serverInfo.pin}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StageView;
