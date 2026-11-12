import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Cast, Lock, RefreshCw, AppWindow, Monitor, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Switch } from '@/shared/ui/Switch';
import { Button } from '@/shared/ui/Button';
import { PinInput } from '@/shared/ui/PinInput';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { DesktopCaptureSource } from '@/core/services/ScreenCaptureService';
import { cn } from '@/core/utils/cn';

export interface TransmitterTabProps {
    isTransmitterConnected: boolean;
    isPrivacyActive: boolean;
    authError?: string;
    onDisconnect: () => void;
    onTogglePrivacy: () => void;
    enteredPin: string;
    onPinChange: (pin: string) => void;
    receiverHost?: string;
    onHostChange?: (host: string) => void;
    discoveryState?: 'idle' | 'searching' | 'found' | 'not_found';
    onRefreshDiscovery?: () => void;
    sources: DesktopCaptureSource[];
    selectedSourceId: string | null;
    onSelectSource: (id: string) => void;
    isLoadingSources: boolean;
    onRefreshSources: () => void;
    isConnecting: boolean;
    onConnect: () => void;
}

export const TransmitterTab: React.FC<TransmitterTabProps> = React.memo(({
    isTransmitterConnected,
    isPrivacyActive,
    authError,
    onDisconnect,
    onTogglePrivacy,
    enteredPin,
    onPinChange,
    receiverHost,
    onHostChange,
    discoveryState = 'idle',
    onRefreshDiscovery,
    sources,
    selectedSourceId,
    onSelectSource,
    isLoadingSources,
    onRefreshSources,
    isConnecting,
    onConnect
}) => {
    const { t } = useTranslation();
    const [sourceCategory, setSourceCategory] = useState<'screens' | 'windows'>('screens');

    // Separate full screens and application windows
    const screens = useMemo(() => sources.filter(s => s.id.startsWith('screen')), [sources]);
    const windows = useMemo(() => sources.filter(s => !s.id.startsWith('screen')), [sources]);
    const visibleSources = sourceCategory === 'screens' ? screens : windows;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {isTransmitterConnected ? (
                <div className="space-y-5">
                    {/* Standardized Active Bar */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-stone-900/60 border border-white/5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-medium text-white">
                                {t('broadcasting_live', 'В эфире на проекторе')}
                            </span>
                        </div>

                        <div className="flex items-center gap-6">
                            {/* Privacy Mode Switcher (NO words like "Включено"/"Выключено") */}
                            <div className="flex items-center gap-2 text-xs text-stone-300 font-medium">
                                <Lock className="w-3.5 h-3.5 text-accent" />
                                <span>{t('privacy_mode', 'Конфиденциальный режим')}</span>
                                <Switch
                                    checked={isPrivacyActive}
                                    onChange={onTogglePrivacy}
                                    size="sm"
                                />
                            </div>

                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onDisconnect}
                                className="text-xs"
                            >
                                {t('disconnect', 'Отключиться')}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {authError && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{authError}</span>
                        </div>
                    )}

                    {/* Auto-Discovery Status */}
                    <div className="flex items-center justify-center">
                        {discoveryState === 'searching' ? (
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-900/80 border border-white/5 text-xs text-stone-400">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
                                <span>{t('searching_projector', 'Поиск проектора в сети Wi-Fi...')}</span>
                            </div>
                        ) : discoveryState === 'not_found' ? (
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>{t('projector_not_found', 'Проектор не найден')}</span>
                                {onRefreshDiscovery && (
                                    <button
                                        type="button"
                                        onClick={onRefreshDiscovery}
                                        className="p-1 rounded hover:bg-white/10 text-amber-400 hover:text-white transition-colors cursor-pointer"
                                        title={t('retry_discovery', 'Повторить поиск')}
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-900/80 border border-white/10 text-xs text-stone-300">
                                <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="text-stone-300 font-medium">{t('projector_ready', 'Проектор готов к подключению')}</span>
                                {onRefreshDiscovery && (
                                    <button
                                        type="button"
                                        onClick={onRefreshDiscovery}
                                        className="p-1 rounded hover:bg-white/10 text-stone-400 hover:text-white transition-colors cursor-pointer"
                                        title={t('retry_discovery', 'Повторить поиск')}
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* PIN Block: Clean and Centered */}
                    <div className="max-w-md mx-auto w-full p-6 rounded-2xl bg-stone-900/40 border border-white/5 flex flex-col items-center justify-center space-y-3">
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                            {t('enter_pin', 'Введите 4-значный PIN-код')}
                        </label>
                        <PinInput
                            value={enteredPin}
                            onChange={onPinChange}
                            autoFocus
                        />
                        <span className="text-xs text-stone-500">
                            {t('pin_hint', 'С экрана проектора или суфлёра')}
                        </span>
                    </div>

                    {/* Source Selector with Category Tabs: Экраны / Приложения */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <SegmentedControl<'screens' | 'windows'>
                                size="sm"
                                value={sourceCategory}
                                onChange={(val) => setSourceCategory(val as 'screens' | 'windows')}
                                options={[
                                    { value: 'screens', label: `Экраны (${screens.length})`, icon: Monitor },
                                    { value: 'windows', label: `Приложения (${windows.length})`, icon: AppWindow }
                                ]}
                            />

                            <button
                                type="button"
                                onClick={onRefreshSources}
                                className="text-xs text-stone-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <RefreshCw className={cn("w-3.5 h-3.5", isLoadingSources && "animate-spin")} />
                                <span>{t('refresh', 'Обновить')}</span>
                            </button>
                        </div>

                        {visibleSources.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-56 overflow-y-auto pr-1">
                                {visibleSources.map((src) => {
                                    const isSelected = selectedSourceId === src.id;
                                    return (
                                        <button
                                            key={src.id}
                                            type="button"
                                            onClick={() => onSelectSource(src.id)}
                                            className={cn(
                                                "p-2.5 rounded-xl border text-left cursor-pointer transition-all space-y-2 group",
                                                isSelected
                                                    ? "bg-accent/15 border-accent text-white shadow-sm ring-1 ring-accent/30"
                                                    : "bg-stone-900/60 border-white/5 text-stone-400 hover:border-white/20 hover:text-white"
                                            )}
                                        >
                                            <div className="aspect-video w-full rounded-xl overflow-hidden bg-stone-950 border border-white/5">
                                                {src.thumbnail ? (
                                                    <img
                                                        src={src.thumbnail}
                                                        alt={src.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-stone-600">
                                                        <AppWindow className="w-6 h-6" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-xs font-semibold block truncate">
                                                {src.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 rounded-xl bg-stone-900/40 border border-white/5 text-center text-xs text-stone-400">
                                {isLoadingSources
                                    ? t('loading_sources', 'Поиск экранов и окон...')
                                    : sourceCategory === 'screens' 
                                        ? 'Экраны не найдены' 
                                        : 'Открытые окна не найдены'}
                            </div>
                        )}
                    </div>

                    {/* Standardized Bottom Action Button */}
                    <Button
                        variant="primary"
                        size="md"
                        disabled={enteredPin.length !== 4 || isConnecting}
                        onClick={onConnect}
                        className="w-full gap-2 text-xs font-bold py-3.5"
                    >
                        {isConnecting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Cast className="w-4 h-4" />
                        )}
                        <span>{isConnecting ? t('connecting', 'Подключение...') : t('connect_and_broadcast', 'Подключиться и транслировать')}</span>
                    </Button>
                </div>
            )}
        </div>
    );
});

TransmitterTab.displayName = 'TransmitterTab';
