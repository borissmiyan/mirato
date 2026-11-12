import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Cast, Monitor, AppWindow, RefreshCw, Tv } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/core/utils/cn';
import type { DesktopCaptureSource } from '@/core/services/ScreenCaptureService';

export interface ScreenShareSourceSelectorProps {
    isScreenSharing?: boolean;
    onToggleScreenShare?: () => void;
    sources?: DesktopCaptureSource[];
    selectedSourceId?: string | null;
    onSelectSourceId?: (id: string) => void;
    onRefreshSources?: () => void;
    isLoadingSources?: boolean;
}

export const ScreenShareSourceSelector: React.FC<ScreenShareSourceSelectorProps> = React.memo(({
    isScreenSharing = false,
    onToggleScreenShare,
    sources = [],
    selectedSourceId,
    onSelectSourceId,
    onRefreshSources,
    isLoadingSources = false,
}) => {
    const { t } = useTranslation();
    const [sourceTypeFilter, setSourceTypeFilter] = useState<'all' | 'screen' | 'window'>('all');

    const filteredSources = useMemo(() => {
        if (sourceTypeFilter === 'all') return sources;
        if (sourceTypeFilter === 'screen') return sources.filter(s => s.id.startsWith('screen:'));
        return sources.filter(s => !s.id.startsWith('screen:'));
    }, [sources, sourceTypeFilter]);

    return (
        <div className="p-5 rounded-2xl bg-stone-900/40 border border-white/5 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        isScreenSharing ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-stone-800 text-stone-400"
                    )}>
                        <Cast className={cn("w-4.5 h-4.5", isScreenSharing && "animate-pulse")} />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-white">
                            {isScreenSharing ? t('screen_sharing_active', 'Идёт трансляция экрана') : t('speaker_screen_broadcast', 'Трансляция экрана и окон')}
                        </h4>
                        <p className="text-[11px] text-stone-400">
                            {isScreenSharing 
                                ? t('screen_sharing_projector_active', 'Проектор транслирует выбранный экран или окно') 
                                : t('screen_sharing_switch_prompt', 'Выберите экран или приложение для HDMI-трансляции')}
                        </p>
                    </div>
                </div>

                {/* Source Type Filter */}
                {sources.length > 0 && (
                    <div className="flex items-center gap-1 p-1 bg-stone-900/80 rounded-xl border border-white/5">
                        <button
                            type="button"
                            onClick={() => setSourceTypeFilter('all')}
                            className={cn(
                                "px-2 py-0.5 rounded-xl text-[10px] font-bold transition-colors cursor-pointer",
                                sourceTypeFilter === 'all' ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200"
                            )}
                        >
                            {t('all_sources', 'Все')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setSourceTypeFilter('screen')}
                            className={cn(
                                "px-2 py-0.5 rounded-xl text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer",
                                sourceTypeFilter === 'screen' ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200"
                            )}
                        >
                            <Monitor className="w-2.5 h-2.5" />
                            <span>{t('screens', 'Экраны')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSourceTypeFilter('window')}
                            className={cn(
                                "px-2 py-0.5 rounded-xl text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer",
                                sourceTypeFilter === 'window' ? "bg-white/10 text-white" : "text-stone-400 hover:text-stone-200"
                            )}
                        >
                            <AppWindow className="w-2.5 h-2.5" />
                            <span>{t('windows', 'Окна')}</span>
                        </button>
                        {onRefreshSources && (
                            <button
                                type="button"
                                onClick={onRefreshSources}
                                disabled={isLoadingSources}
                                title={t('refresh_sources', 'Обновить')}
                                className="p-1 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                <RefreshCw className={cn("w-2.5 h-2.5", isLoadingSources && "animate-spin")} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Sources Grid */}
            {filteredSources.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-40 overflow-y-auto pr-1">
                    {filteredSources.map((source) => {
                        const isSelected = selectedSourceId === source.id;
                        const isScreen = source.id.startsWith('screen:');
                        return (
                            <button
                                key={source.id}
                                type="button"
                                onClick={() => onSelectSourceId?.(source.id)}
                                className={cn(
                                    "p-2 rounded-xl border text-left transition-all cursor-pointer group flex flex-col gap-1.5 relative overflow-hidden",
                                    isSelected
                                        ? "bg-accent/15 border-accent text-white shadow-md ring-1 ring-accent/40"
                                        : "bg-stone-900/60 border-white/5 hover:border-white/20 text-stone-400 hover:text-stone-200"
                                )}
                            >
                                <div className="w-full aspect-video rounded-xl overflow-hidden bg-black/50 border border-white/5 relative">
                                    {source.thumbnail ? (
                                        <img 
                                            src={source.thumbnail} 
                                            alt={source.name}
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-stone-600">
                                            {isScreen ? <Monitor className="w-5 h-5" /> : <AppWindow className="w-5 h-5" />}
                                        </div>
                                    )}
                                    <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[8px] font-bold text-stone-300 flex items-center gap-0.5">
                                        {isScreen ? <Monitor className="w-2 h-2" /> : <AppWindow className="w-2 h-2" />}
                                        <span>{isScreen ? 'Экран' : 'Окно'}</span>
                                    </div>
                                </div>
                                <p className="text-[11px] font-semibold truncate leading-tight w-full" title={source.name}>
                                    {source.name}
                                </p>
                            </button>
                        );
                    })}
                </div>
            )}

            {onToggleScreenShare && (
                <Button
                    variant={isScreenSharing ? "danger" : "surface"}
                    size="sm"
                    onClick={onToggleScreenShare}
                    className={cn(
                        "w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm",
                        isScreenSharing ? "bg-red-500/20 text-red-300 border border-red-500/30" : "text-white bg-white/10 hover:bg-white/15 border-white/10"
                    )}
                >
                    {isScreenSharing ? (
                        <>
                            <Tv className="w-3.5 h-3.5" />
                            <span>{t('return_to_presentation', 'Вернуться к слайдам')}</span>
                        </>
                    ) : (
                        <>
                            <Cast className="w-3.5 h-3.5" />
                            <span>{t('start_screen_share', 'Транслировать выбранный экран')}</span>
                        </>
                    )}
                </Button>
            )}
        </div>
    );
});

ScreenShareSourceSelector.displayName = 'ScreenShareSourceSelector';

