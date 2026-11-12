import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePresenterStore, DEFAULT_SETTINGS } from '@/features/presenter/store/presenterStore';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/core/utils/cn';
import { Monitor, Tv, LayoutGrid, Eye, EyeOff, Minus, Plus } from 'lucide-react';
import { StageCardId } from '@/core/types';
import { IpcService } from '@/core/services/ipcService';
import { Card, Switch, Badge, Slider, IconButton, Button } from '@/shared/ui';

const StageSettings: React.FC = () => {
    const { t } = useTranslation();
    const { settings, updateStageSettings } = usePresenterStore(useShallow(state => ({
        settings: state.settings,
        updateStageSettings: state.updateStageSettings
    })));

    const stage = settings.stage ?? DEFAULT_SETTINGS.stage;
    const isStageEnabled = stage.enabled ?? false;

    const handleToggleStageEnabled = async (nextEnabled: boolean) => {
        updateStageSettings({ enabled: nextEnabled });

        if (IpcService.isElectron()) {
            if (!nextEnabled) {
                // If turned off, immediately close the stage window if open
                await IpcService.invoke('close-stage');
            } else if (settings.display.stageDisplayId !== undefined) {
                // If turned on and monitor is configured, open stage
                await IpcService.invoke('open-stage', settings.display);
            }
        }
    };

    const toggleVisibility = (id: StageCardId) => {
        const newLayout = stage.layout.map(card => 
            card.id === id ? { ...card, visible: !card.visible } : card
        );
        updateStageSettings({ layout: newLayout });
    };

    const updateSpan = (id: StageCardId, w: number, h: number) => {
        const newLayout = stage.layout.map(card => 
            card.id === id ? { ...card, w: Math.max(1, Math.min(12, w)), h: Math.max(1, Math.min(12, h)) } : card
        );
        updateStageSettings({ layout: newLayout });
    };

    const getCardLabel = (id: StageCardId) => {
        switch(id) {
            case 'current': return t('stage_current_slide', 'Current Slide');
            case 'next': return t('stage_next_slide', 'Next Slide');
            case 'prev': return t('stage_prev_slide', 'Previous Slide');
            case 'sound': return t('stage_sound_card', 'Sound Card');
            default: return id;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Master Stage Display Toggle */}
            <Card padding="lg" rounded="xl" className="relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl rounded-full translate-x-10 -translate-y-10 pointer-events-none" />

                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300",
                            isStageEnabled ? "bg-accent/20 text-accent" : "bg-stone-800 text-stone-500"
                        )}>
                            <Tv className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-white tracking-tight">{t('stage_enable_title', 'Stage Display')}</h3>
                                <Badge variant={isStageEnabled ? 'accent' : 'secondary'} size="sm" dot={isStageEnabled}>
                                    {isStageEnabled ? t('stage_enabled', 'Enabled') : t('stage_disabled', 'Disabled')}
                                </Badge>
                            </div>
                            <p className="text-xs text-stone-500 font-medium mt-0.5">{t('stage_enable_desc', 'Enable dedicated confidence monitor / stage display for musicians and speakers')}</p>
                        </div>
                    </div>

                    <Switch
                        checked={isStageEnabled}
                        onChange={handleToggleStageEnabled}
                        size="md"
                    />
                </div>

                {!isStageEnabled && (
                    <div className="mt-4 pt-4 border-t border-white/5 text-xs text-stone-400 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-stone-600 inline-block" />
                        {t('stage_disabled_notice', 'Экран сцены отключен и не будет открываться во время эфира.')}
                    </div>
                )}

                {isStageEnabled && settings.display.stageDisplayId === undefined && (
                    <div className="mt-4 pt-4 border-t border-white/5 text-xs text-amber-400/90 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" />
                        {t('stage_no_display_warning', 'Монитор для сцены не выбран. Выберите дисплей в разделе «Дисплеи».')}
                    </div>
                )}
            </Card>

            {/* Global Settings */}
            <Card padding="lg" rounded="xl">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-accent" />
                    {t('stage_appearance', 'Appearance & Grid')}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Gap Slider */}
                    <Slider
                        label={t('grid_gap', 'Card Spacing')}
                        value={stage.gap}
                        min={0}
                        max={64}
                        step={4}
                        unit="px"
                        onChange={(val) => updateStageSettings({ gap: val })}
                    />

                    {/* Corner Radius Slider */}
                    <Slider
                        label={t('corner_radius', 'Corner Radius')}
                        value={stage.cornerRadius}
                        min={0}
                        max={48}
                        step={4}
                        unit="px"
                        onChange={(val) => updateStageSettings({ cornerRadius: val })}
                    />
                </div>
            </Card>

            {/* Layout Customizer */}
            <Card padding="lg" rounded="xl">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-accent" />
                    {t('stage_layout', 'Bento Cards Configuration')}
                </h3>
                <p className="text-xs text-stone-500 mb-6">{t('stage_layout_desc', 'Adjust the size and visibility of cards on the stage screen. The layout uses a 12x12 grid system.')}</p>
                
                <div className="space-y-4">
                    {stage.layout.map((card) => (
                        <div key={card.id} className={cn(
                            "flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border transition-all duration-200",
                            card.visible ? "bg-stone-950/50 border-white/10" : "bg-stone-950/20 border-white/5 opacity-50"
                        )}>
                            <div className="flex items-center gap-4 mb-4 md:mb-0">
                                <IconButton
                                    icon={card.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    label={card.visible ? "Hide Card" : "Show Card"}
                                    variant={card.visible ? "accent" : "surface"}
                                    size="xs"
                                    onClick={() => toggleVisibility(card.id)}
                                />
                                <div>
                                    <span className="font-bold text-stone-200">{getCardLabel(card.id)}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col items-center gap-1.5">
                                    <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Width</span>
                                    <div className="flex items-center bg-stone-900 rounded-xl p-1 border border-white/5 gap-1">
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            square
                                            onClick={() => updateSpan(card.id, card.w - 1, card.h)}
                                            disabled={!card.visible || card.w <= 1}
                                        >
                                            <Minus className="w-3.5 h-3.5" />
                                        </Button>
                                        <span className="w-7 text-center text-xs font-mono font-semibold text-white">{card.w}</span>
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            square
                                            onClick={() => updateSpan(card.id, card.w + 1, card.h)}
                                            disabled={!card.visible || card.w >= 12}
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-1.5">
                                    <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Height</span>
                                    <div className="flex items-center bg-stone-900 rounded-xl p-1 border border-white/5 gap-1">
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            square
                                            onClick={() => updateSpan(card.id, card.w, card.h - 1)}
                                            disabled={!card.visible || card.h <= 1}
                                        >
                                            <Minus className="w-3.5 h-3.5" />
                                        </Button>
                                        <span className="w-7 text-center text-xs font-mono font-semibold text-white">{card.h}</span>
                                        <Button
                                            variant="ghost"
                                            size="xs"
                                            square
                                            onClick={() => updateSpan(card.id, card.w, card.h + 1)}
                                            disabled={!card.visible || card.h >= 12}
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Grid Preview Simulation */}
                <div className="mt-8 pt-8 border-t border-white/5">
                    <h4 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-4">{t('preview_layout', 'Layout Preview')}</h4>
                    <div 
                        className="bg-stone-950 rounded-2xl border border-white/5 p-4 aspect-video grid overflow-hidden"
                        style={{
                            gridTemplateColumns: 'repeat(12, 1fr)',
                            gridAutoRows: 'minmax(20px, auto)',
                            gap: `${Math.min(8, stage.gap / 4)}px`,
                        }}
                    >
                        {stage.layout.filter(c => c.visible).map(card => (
                            <div 
                                key={`preview-${card.id}`}
                                className="bg-stone-800/80 border border-white/10 flex items-center justify-center text-[10px] font-bold text-stone-400 transition-all duration-300"
                                style={{
                                    gridColumn: `span ${card.w}`,
                                    gridRow: `span ${card.h}`,
                                    borderRadius: `${Math.min(8, stage.cornerRadius / 4)}px`
                                }}
                            >
                                {getCardLabel(card.id)}
                            </div>
                        ))}
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default StageSettings;
