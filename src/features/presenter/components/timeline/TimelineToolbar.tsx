import React from 'react';
import { Plus, BookOpen, Timer, Link2, Unlink2, Film, Radio } from 'lucide-react';
import { CustomHymnStackIcon } from '@/shared/ui';
import { TFunction } from 'i18next';
import { AppMode } from '@/core/types';
import { ModalType } from '@/core/store/modalStore';
import { useAtom } from 'jotai';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { activeHymnalIdAtom } from '@/core/store/uiAtoms';
import { previewLockedAtom } from '@/core/store/liveSyncAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
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
    const [activeHymnalId] = useAtom(activeHymnalIdAtom);
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

            {/* Quick Add Toolbar */}
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
    );
};

export default TimelineToolbar;
