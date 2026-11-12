import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
    Tv, Lock, Play, Square, 
    ChevronLeft, ChevronRight, CheckCircle2, 
    Layers, RefreshCw, AlertCircle, Wifi, WifiOff, ArrowRight
} from 'lucide-react';
import { PinInput } from '@/shared/ui/PinInput';
import { Switch } from '@/shared/ui/Switch';
import { Button } from '@/shared/ui/Button';
import { db } from '@/core/db';
import { cn } from '@/core/utils/cn';
import type { DesktopCaptureSource } from '@/core/services/ScreenCaptureService';
import { ScreenShareSourceSelector } from './ScreenShareSourceSelector';

export interface DeckCastTabProps {
    isConnected: boolean;
    isConnecting: boolean;
    authError?: string;
    enteredPin: string;
    onPinChange: (pin: string) => void;
    receiverHost?: string;
    onHostChange?: (host: string) => void;
    discoveryState?: 'idle' | 'searching' | 'found' | 'not_found';
    onRefreshDiscovery?: () => void;
    onConnect: () => void;
    onDisconnect: () => void;
    onCloseModal?: () => void;
    isPrivacyActive: boolean;
    onTogglePrivacy: () => void;
    sendCommand: (command: string, payload?: unknown) => void;
    isScreenSharing?: boolean;
    onToggleScreenShare?: () => void;
    sources?: DesktopCaptureSource[];
    selectedSourceId?: string | null;
    onSelectSourceId?: (id: string) => void;
    onRefreshSources?: () => void;
    isLoadingSources?: boolean;
}

export const DeckCastTab: React.FC<DeckCastTabProps> = React.memo(({
    isConnected,
    isConnecting,
    authError,
    enteredPin,
    onPinChange,
    receiverHost,
    onHostChange,
    discoveryState = 'idle',
    onRefreshDiscovery,
    onConnect,
    onDisconnect,
    onCloseModal,
    isPrivacyActive,
    onTogglePrivacy,
    sendCommand,
    isScreenSharing = false,
    onToggleScreenShare,
    sources = [],
    selectedSourceId,
    onSelectSourceId,
    onRefreshSources,
    isLoadingSources = false
}) => {
    const { t } = useTranslation();

    // Query all locally available presentations
    const livePresentations = useLiveQuery(
        () => db.presentationFiles.filter(p => !p.isMaster).reverse().toArray(),
        []
    );
    const presentations = useMemo(() => livePresentations || [], [livePresentations]);

    const [selectedPresId, setSelectedPresId] = useState<string | null>(null);
    const [isCastingLive, setIsCastingLive] = useState(false);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);

    // Active chosen presentation
    const activePresentation = useMemo(() => {
        if (!selectedPresId && presentations.length > 0) return presentations[0];
        return presentations.find(p => p.id === selectedPresId) || presentations[0] || null;
    }, [selectedPresId, presentations]);

    // Launch Presentation to Projector
    const handleLaunchCast = useCallback(() => {
        if (!activePresentation || !activePresentation.slides || activePresentation.slides.length === 0) return;
        setIsCastingLive(true);
        setActiveSlideIndex(0);
        sendCommand('CAST_PRESENTATION', {
            presentation: activePresentation,
            startSlideIndex: 0,
            isPrivacy: isPrivacyActive,
            speakerName: 'Спикер на сцене'
        });
    }, [activePresentation, isPrivacyActive, sendCommand]);

    // Stop Presentation
    const handleStopCast = useCallback(() => {
        setIsCastingLive(false);
        setActiveSlideIndex(0);
        sendCommand('CAST_STOP');
    }, [sendCommand]);

    // Navigate to Slide
    const handleSelectSlide = useCallback((index: number) => {
        if (!activePresentation || !activePresentation.slides[index]) return;
        setActiveSlideIndex(index);
        const slide = activePresentation.slides[index];
        sendCommand('CAST_NAVIGATE_SLIDE', {
            slideId: slide.id,
            index,
            presentationId: activePresentation.id
        });
    }, [activePresentation, sendCommand]);

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
            {/* Header info banner */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-stone-900/50 border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center text-accent">
                        <Tv className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white tracking-wide">
                            {t('tab_deck_cast', 'Кастинг презентации')}
                        </h4>
                        <p className="text-xs text-stone-400">
                            {isConnected 
                                ? t('deck_cast_active_info', 'Сетевой видеовыход AirDeck активен')
                                : t('deck_cast_connect_prompt', 'Подключение к церковному проектору по Wi-Fi')}
                        </p>
                    </div>
                </div>

                {isConnected && (
                    <div className="flex items-center gap-3">
                        {onCloseModal && (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={onCloseModal}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                            >
                                <span>{t('open_service_workspace', 'Открыть служение')}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                        )}
                        <Button
                            variant="surface"
                            size="sm"
                            onClick={onDisconnect}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20 flex items-center gap-1.5"
                        >
                            <WifiOff className="w-3.5 h-3.5" />
                            <span>{t('disconnect', 'Отключиться')}</span>
                        </Button>
                    </div>
                )}
            </div>

            {/* If NOT connected -> Connect UI */}
            {!isConnected ? (
                <div className="p-6 rounded-2xl bg-stone-900/30 border border-white/5 backdrop-blur-xl space-y-6">
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-stone-900/60 border border-white/5 text-xs">
                        <div className="flex items-center gap-2.5">
                            <Wifi className={cn(
                                "w-4 h-4 shrink-0",
                                discoveryState === 'found' ? "text-emerald-400" : "text-stone-400"
                            )} />
                            <span className="text-stone-300 font-medium">
                                {discoveryState === 'searching' && t('searching_projector', 'Поиск проектора в сети...')}
                                {discoveryState === 'found' && t('projector_ready', 'Проектор обнаружен и готов к подключению')}
                                {(discoveryState === 'not_found' || discoveryState === 'idle') && t('projector_local_network', 'Проектор в локальной сети')}
                            </span>
                        </div>

                        {onRefreshDiscovery && (
                            <button
                                type="button"
                                onClick={onRefreshDiscovery}
                                disabled={discoveryState === 'searching'}
                                title={t('refresh_discovery', 'Обновить поиск')}
                                className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                <RefreshCw className={cn("w-3.5 h-3.5", discoveryState === 'searching' && "animate-spin")} />
                            </button>
                        )}
                    </div>

                    <div className="space-y-3 flex flex-col items-center py-2">
                        <label className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                            {t('enter_pin_from_projector', 'Введите PIN-код с экрана проектора')}:
                        </label>
                        <PinInput
                            value={enteredPin}
                            onChange={onPinChange}
                            disabled={isConnecting}
                        />
                    </div>

                    {authError && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{authError}</span>
                        </div>
                    )}

                    <Button
                        variant="primary"
                        size="md"
                        disabled={enteredPin.length !== 4 || isConnecting}
                        onClick={onConnect}
                        className="w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xl"
                    >
                        {isConnecting ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>{t('connecting_to_projector', 'Подключение к проектору...')}</span>
                            </>
                        ) : (
                            <>
                                <Wifi className="w-4 h-4" />
                                <span>{t('connect_to_projector', 'Подключиться к проектору')}</span>
                            </>
                        )}
                    </Button>
                </div>
            ) : isCastingLive && activePresentation ? (
                /* LIVE PRESENTATION CONTROL VIEW */
                <div className="p-6 rounded-2xl bg-stone-900/40 border border-accent/20 backdrop-blur-xl space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-accent">
                                    {t('live_on_projector', 'В эфире на проекторе')}
                                </h4>
                                <h3 className="text-base font-bold text-white">
                                    {activePresentation.name}
                                </h3>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                variant="surface"
                                size="sm"
                                onClick={handleStopCast}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20 flex items-center gap-2"
                            >
                                <Square className="w-4 h-4 fill-current" />
                                <span>{t('stop_presentation', 'Завершить показ')}</span>
                            </Button>
                        </div>
                    </div>

                    {/* Navigation Controls */}
                    <div className="flex items-center gap-3">
                        <Button
                            variant="surface"
                            size="md"
                            disabled={activeSlideIndex <= 0}
                            onClick={() => handleSelectSlide(activeSlideIndex - 1)}
                            className="flex-1 py-3"
                        >
                            <ChevronLeft className="w-5 h-5 mr-1" />
                            <span>{t('prev_slide', 'Назад')}</span>
                        </Button>
                        <Button
                            variant="primary"
                            size="md"
                            disabled={activeSlideIndex >= activePresentation.slides.length - 1}
                            onClick={() => handleSelectSlide(activeSlideIndex + 1)}
                            className="flex-1 py-3"
                        >
                            <span>{t('next_slide', 'Вперёд')}</span>
                            <ChevronRight className="w-5 h-5 ml-1" />
                        </Button>
                    </div>
                </div>
            ) : (
                /* CONNECTED READY VIEW: Screen Sharing Hub & Launch Presentation */
                <div className="space-y-6">
                    {/* Top Status Banner */}
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/30 to-stone-900/60 border border-emerald-500/20 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                                <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white">
                                    {t('connected_to_projector', 'Подключено к проектору')}
                                </h4>
                                <p className="text-xs text-emerald-300/80 font-medium">
                                    {t('airdeck_ready_hint', 'Трансляция активна — экраны синхронизированы')}
                                </p>
                            </div>
                        </div>

                        {/* Privacy Mode Switch */}
                        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-stone-900/60 border border-white/5 shrink-0">
                            <span className="text-xs font-medium text-stone-300 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                                {t('privacy_mode', 'Конфиденциальный режим')}
                            </span>
                            <Switch
                                checked={isPrivacyActive}
                                onChange={onTogglePrivacy}
                                aria-label={t('privacy_mode', 'Конфиденциальный режим')}
                            />
                        </div>
                    </div>

                    {/* Screen / Window Demonstration Selector */}
                    <ScreenShareSourceSelector
                        isScreenSharing={isScreenSharing}
                        onToggleScreenShare={onToggleScreenShare}
                        sources={sources}
                        selectedSourceId={selectedSourceId}
                        onSelectSourceId={onSelectSourceId}
                        onRefreshSources={onRefreshSources}
                        isLoadingSources={isLoadingSources}
                    />

                    {/* Presentation Selector */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-stone-300 uppercase tracking-wider block">
                            {t('select_presentation_to_cast', 'Выберите презентацию из библиотеки')}:
                        </label>

                        {presentations.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                                {presentations.map((p) => {
                                    const isSelected = (activePresentation?.id === p.id);
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => setSelectedPresId(p.id)}
                                            className={cn(
                                                "p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3",
                                                isSelected
                                                    ? "bg-accent/15 border-accent text-white shadow-sm ring-1 ring-accent/30"
                                                    : "bg-stone-900/50 border-white/5 hover:border-white/15 text-stone-400 hover:text-stone-200"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                                isSelected ? "bg-accent text-accent-foreground font-bold" : "bg-stone-800 text-stone-400"
                                            )}>
                                                <Layers className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h5 className="text-xs font-bold truncate text-white">
                                                    {p.name}
                                                </h5>
                                                <span className="text-[10px] text-stone-500 block mt-0.5">
                                                    {p.slides?.length || 0} слайдов
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 rounded-xl bg-stone-900/40 border border-white/5 text-center text-xs text-stone-400 space-y-2">
                                <Layers className="w-6 h-6 text-stone-600 mx-auto" />
                                <p>{t('no_local_presentations', 'В библиотеке нет созданных презентаций')}</p>
                            </div>
                        )}

                        <Button
                            variant="primary"
                            size="md"
                            disabled={!activePresentation || !activePresentation.slides || activePresentation.slides.length === 0}
                            onClick={handleLaunchCast}
                            className="w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 mt-2"
                        >
                            <Play className="w-4 h-4 fill-current" />
                            <span>{t('launch_presentation_on_projector', 'Запустить презентацию на проекторе')}</span>
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
});

DeckCastTab.displayName = 'DeckCastTab';
