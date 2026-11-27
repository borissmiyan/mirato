import React from 'react';
import { Plus, BookOpen, Timer, Link2, Unlink2, Film, Radio, Palette } from 'lucide-react';
import { CustomHymnStackIcon, DropdownSelector, DropdownOption } from '@/shared/ui';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { AppMode } from '@/core/types';
import { SOURCE_THEME_ID } from '@/core/types/hymn';
import { ModalType } from '@/core/store/modalStore';
import { useAtom } from 'jotai';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { activeHymnalIdAtom } from '@/core/store/uiAtoms';
import { activeHymnThemeIdAtom } from '@/features/hymns/store/hymnThemeAtom';
import { previewLockedAtom } from '@/core/store/liveSyncAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { DEFAULT_HYMN_THEME, getHymnThemeSwatchBackground } from '@/features/hymns/services/hymnThemeConstants';
import { Button, Tooltip } from '@/shared/ui';
import { cn } from '@/core/utils/cn';
import { CustomTimelineIcon, CustomSlideIcon, CustomSlideStackIcon } from './TimelineIcons';

interface TimelineToolbarProps {
    t: TFunction;
    slideCount: number;
    isDetached: boolean;
    appMode?: AppMode;
    handleAddSlide: (blockId: string, e?: React.MouseEvent) => void;
    handleAddTimer: (e?: React.MouseEvent) => void;
    handleAddVideo: (e?: React.MouseEvent) => void;
    openModal: (type: ModalType, props?: Record<string, unknown>) => void;
}

export const TimelineToolbar: React.FC<TimelineToolbarProps> = ({
    t,
    isDetached,
    appMode,
    handleAddSlide,
    handleAddTimer,
    handleAddVideo,
    openModal
}) => {
    const { i18n } = useTranslation();
    const isRu = i18n.language?.startsWith('ru');
    const [activeHymnalId] = useAtom(activeHymnalIdAtom);
    const [activeHymnThemeId, setActiveHymnThemeId] = useAtom(activeHymnThemeIdAtom);
    const [previewLocked, setPreviewLocked] = useAtom(previewLockedAtom);
    const syncPreviewToLive = usePresentationStore(s => s.syncPreviewToLive);
    const liveSlideId = usePresentationStore(s => s.liveSlideId);
    const activePresentationId = usePresentationStore(s => s.activePresentationId);
    const activeSlides = usePresentationStore(s => s.activePresentation?.slides);
    const liveSlideNumber = React.useMemo(() => {
        if (!liveSlideId || !activeSlides) return null;
        const idx = activeSlides.findIndex(s => s.id === liveSlideId);
        return idx !== -1 ? idx + 1 : null;
    }, [liveSlideId, activeSlides]);
    const activeHymnal = useLiveQuery(() => activeHymnalId ? db.hymnals.get(activeHymnalId) : undefined, [activeHymnalId]);
    const rawHymnThemes = useLiveQuery(() => (appMode === 'hymns' ? db.hymnThemes.toArray() : []), [appMode]);

    const hymnThemeOptions: DropdownOption[] = React.useMemo(() => {
        if (appMode !== 'hymns') return [];
        const dbDefault = (rawHymnThemes || []).find(th => !!th.isDefault) || DEFAULT_HYMN_THEME;
        const renderSwatch = (bg: string, color: string, fontFamily?: string) => (
            <span
                className="w-5 h-5 rounded-md border border-white/15 flex items-center justify-center text-[10px] font-bold shrink-0 leading-none"
                style={{ background: bg, color, fontFamily }}
            >
                А
            </span>
        );
        const list: DropdownOption[] = [
            {
                value: 'default',
                label: (isRu && dbDefault.nameRu ? dbDefault.nameRu : dbDefault.name) || t('default_theme', 'По умолчанию'),
                icon: renderSwatch(
                    getHymnThemeSwatchBackground(dbDefault),
                    dbDefault.textStyle?.color || '#FFFFFF',
                    dbDefault.textStyle?.fontFamily
                ),
            },
            {
                value: SOURCE_THEME_ID,
                label: t('source_theme', 'Оригинал'),
                icon: <Palette className="w-4 h-4 text-purple-400" />,
            },
        ];
        (rawHymnThemes || []).forEach(th => {
            if (th.isDefault) return;
            list.push({
                value: th.id,
                label: isRu && th.nameRu ? th.nameRu : th.name,
                keywords: `${th.name} ${th.nameRu || ''} ${th.textStyle?.fontFamily || ''}`,
                icon: renderSwatch(
                    getHymnThemeSwatchBackground(th),
                    th.textStyle?.color || '#FFFFFF',
                    th.textStyle?.fontFamily
                ),
            });
        });
        return list;
    }, [appMode, rawHymnThemes, isRu, t]);

    const isCustomHymnalEditable = appMode === 'hymns' && activeHymnal && !activeHymnal.isBuiltIn;
    const canShowToolbar = Boolean(activePresentationId) && (appMode !== 'hymns' || isCustomHymnalEditable);

    return (
        <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between shrink-0 bg-stone-950/30">
            <div className="flex items-center gap-3">
                {/* Panel Title with bare custom Timeline icon (no background box) */}
                <span className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
                    <CustomTimelineIcon className="w-4 h-4 text-stone-400 shrink-0" />
                    {t('timeline', 'Timeline')}
                </span>

                {/* Live Sync / Link Control Well — uses identical Button size="xs" geometry as Quick Add buttons */}
                <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/5">
                    <Tooltip
                        position="top"
                        content={previewLocked
                            ? t('arrows_live_only_hint', 'Unlinked: arrows switch Live only, Preview stays locked (Cmd+Arrows for Preview)')
                            : t('arrows_synced_hint', 'Linked: arrows switch Live & Preview together from Live slide (Cmd+Arrows for Preview, Alt+Arrows for Live)')}
                    >
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setPreviewLocked(prev => !prev)}
                            className={cn(
                                'px-2.5 gap-1.5 text-[10px] font-bold uppercase tracking-wider',
                                previewLocked
                                    ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 hover:text-amber-200'
                                    : 'text-stone-400 hover:text-stone-100 hover:bg-white/10'
                            )}
                        >
                            {previewLocked
                                ? <Unlink2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                : <Link2 className="w-3.5 h-3.5 text-accent shrink-0" />}
                            <span>{previewLocked ? t('live_only_arrows', 'Unlinked') : t('synced_arrows', 'Linked')}</span>
                        </Button>
                    </Tooltip>

                    {/* Detached Status Button (click to sync Preview back to Live) */}
                    {isDetached && (
                        <>
                            <div className="w-px h-4 bg-white/10 mx-0.5" />
                            <Tooltip
                                position="top"
                                content={t('sync_live_hint', 'Click or press H to jump back to the Live slide')}
                            >
                                <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => syncPreviewToLive()}
                                    className={cn(
                                        'px-2.5 gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:text-amber-200',
                                        'animate-in fade-in zoom-in-95 duration-200'
                                    )}
                                >
                                    <Radio className="w-3.5 h-3.5 text-red-400 animate-pulse shrink-0" />
                                    <span>{t('detached_mode', 'Detached')}</span>
                                    {liveSlideNumber && (
                                        <span className="inline-flex items-center gap-1 pl-1.5 ml-0.5 border-l border-amber-500/25 text-amber-200 tabular-nums">
                                            <CustomSlideIcon className="w-4 h-3.5 text-amber-300 shrink-0" />
                                            <span>{liveSlideNumber}</span>
                                        </span>
                                    )}
                                </Button>
                            </Tooltip>
                        </>
                    )}
                </div>
            </div>

            {/* Right side: Direct 1-click Hymn Theme Selector (Hymns mode) + Quick Add Toolbar */}
            <div className="flex items-center gap-2">
                {appMode === 'hymns' && (
                    <div className="w-52">
                        <DropdownSelector
                            size="xs"
                            searchable
                            searchPlaceholder={t('search_themes', 'Поиск темы...')}
                            value={activeHymnThemeId || 'default'}
                            options={hymnThemeOptions}
                            onChange={setActiveHymnThemeId}
                            placeholder={t('hymn_theme', 'Выбрать тему')}
                        />
                    </div>
                )}

                {canShowToolbar && (
                    <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/5">
                        <Tooltip content={t('add_blank_slide', 'Add Blank Slide')} position="top">
                            <Button
                                size="xs"
                                square
                                variant="primary"
                                onClick={(e) => handleAddSlide('default', e)}
                                className="shadow-xs"
                            >
                                <Plus className="w-4 h-4" />
                            </Button>
                        </Tooltip>

                        {appMode !== 'hymns' && (
                            <>
                                <div className="w-px h-4 bg-white/10 mx-1" />
                                <Tooltip content={t('add_nested_presentation', 'Add Nested Presentation')} position="top">
                                    <Button
                                        size="xs"
                                        square
                                        variant="ghost"
                                        onClick={() => openModal(ModalType.PRESENTATION_PICKER)}
                                        className="text-stone-400 hover:text-accent hover:bg-accent/10 relative group"
                                    >
                                        <CustomSlideStackIcon className="w-4 h-4" />
                                        <div className="absolute -top-0.5 -right-0.5">
                                            <Plus className="w-2.5 h-2.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </Button>
                                </Tooltip>
                                <Tooltip content={t('add_hymn_slide', 'Add Hymn')} position="top">
                                    <Button
                                        size="xs"
                                        square
                                        variant="ghost"
                                        onClick={() => openModal(ModalType.HYMN_PICKER)}
                                        className="text-stone-400 hover:text-accent hover:bg-accent/10 relative group"
                                    >
                                        <CustomHymnStackIcon className="w-4 h-4" />
                                        <div className="absolute -top-0.5 -right-0.5">
                                            <Plus className="w-2.5 h-2.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </Button>
                                </Tooltip>
                                <Tooltip content={t('add_bible_verse', 'Add Bible Verse')} position="top">
                                    <Button
                                        size="xs"
                                        square
                                        variant="ghost"
                                        onClick={(e) => handleAddSlide('bible', e)}
                                        className="text-stone-400 hover:text-accent hover:bg-accent/10 relative group"
                                    >
                                        <BookOpen className="w-4 h-4" />
                                        <div className="absolute -top-0.5 -right-0.5">
                                            <Plus className="w-2.5 h-2.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </Button>
                                </Tooltip>
                                <Tooltip content={t('add_timer_slide', 'Add Timer Slide')} position="top">
                                    <Button
                                        size="xs"
                                        square
                                        variant="ghost"
                                        onClick={(e) => handleAddTimer(e)}
                                        className="text-stone-400 hover:text-orange-400 hover:bg-orange-400/10 relative group"
                                    >
                                        <Timer className="w-4 h-4" />
                                        <div className="absolute -top-0.5 -right-0.5">
                                            <Plus className="w-2.5 h-2.5 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </Button>
                                </Tooltip>
                            </>
                        )}

                        <Tooltip content={t('add_video_slide', 'Add Video Slide')} position="top">
                            <Button
                                size="xs"
                                square
                                variant="ghost"
                                onClick={(e) => handleAddVideo(e)}
                                className="text-stone-400 hover:text-accent hover:bg-accent/10 relative group"
                            >
                                <Film className="w-4 h-4" />
                                <div className="absolute -top-0.5 -right-0.5">
                                    <Plus className="w-2.5 h-2.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </Button>
                        </Tooltip>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimelineToolbar;
