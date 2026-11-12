import React from 'react';
import { Layers, Plus, BookOpen, Timer, Unlink2, Film, Music } from 'lucide-react';
import { TFunction } from 'i18next';
import { AppMode } from '@/core/types';
import { ModalType } from '@/core/store/modalStore';
import { useAtom } from 'jotai';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { activeHymnalIdAtom } from '@/core/store/uiAtoms';
import { Button } from '@/shared/ui';

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
    slideCount,
    isDetached,
    appMode,
    handleAddSlide,
    handleAddTimer,
    handleAddVideo,
    openModal
}) => {
    const [activeHymnalId] = useAtom(activeHymnalIdAtom);
    const activeHymnal = useLiveQuery(() => activeHymnalId ? db.hymnals.get(activeHymnalId) : undefined, [activeHymnalId]);

    const isCustomHymnalEditable = appMode === 'hymns' && activeHymnal && !activeHymnal.isBuiltIn;
    const canShowToolbar = appMode !== 'hymns' || isCustomHymnalEditable;

    return (
        <div className="px-4 h-14 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    {t('timeline', 'Timeline')}
                </span>
                <div className="h-4 w-px bg-white/10" />
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                    {t('slides_count', { count: slideCount, defaultValue: '{{count}} Slides' })}
                </span>

                {/* Detached Mode Warning */}
                {isDetached && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/15 border border-red-500/30 rounded-xl animate-in fade-in zoom-in-90 duration-300">
                        <Unlink2 className="w-3 h-3 text-red-400" />
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">
                            {t('detached_mode', 'Detached')}
                        </span>
                    </div>
                )}
            </div>

            {/* Quick Add Toolbar */}
            {canShowToolbar && (
                <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/5 mr-2 my-2">
                    <Button
                        size="xs"
                        square
                        variant="primary"
                        onClick={(e) => handleAddSlide('default', e)}
                        title={t('add_blank_slide', 'Add Blank Slide')}
                        className="shadow-xs"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                    
                    {appMode !== 'hymns' && (
                        <>
                            <div className="w-px h-4 bg-white/10 mx-1" />
                            <Button
                                size="xs"
                                square
                                variant="ghost"
                                onClick={() => openModal(ModalType.PRESENTATION_PICKER)}
                                className="text-stone-400 hover:text-accent hover:bg-accent/10 relative group"
                                title={t('add_nested_presentation', 'Add Nested Presentation')}
                            >
                                <Layers className="w-4 h-4" />
                                <div className="absolute -top-0.5 -right-0.5">
                                    <Plus className="w-2.5 h-2.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </Button>
                            <Button
                                size="xs"
                                square
                                variant="ghost"
                                onClick={() => openModal(ModalType.HYMN_PICKER)}
                                className="text-stone-400 hover:text-accent hover:bg-accent/10 relative group"
                                title={t('add_hymn_slide', 'Add Hymn')}
                            >
                                <Music className="w-4 h-4" />
                                <div className="absolute -top-0.5 -right-0.5">
                                    <Plus className="w-2.5 h-2.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </Button>
                            <Button
                                size="xs"
                                square
                                variant="ghost"
                                onClick={(e) => handleAddSlide('bible', e)}
                                className="text-stone-400 hover:text-accent hover:bg-accent/10 relative group"
                                title={t('add_bible_verse', 'Add Bible Verse')}
                            >
                                <BookOpen className="w-4 h-4" />
                                <div className="absolute -top-0.5 -right-0.5">
                                    <Plus className="w-2.5 h-2.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </Button>
                            <Button
                                size="xs"
                                square
                                variant="ghost"
                                onClick={(e) => handleAddTimer(e)}
                                className="text-stone-400 hover:text-orange-400 hover:bg-orange-400/10 relative group"
                                title={t('add_timer_slide', 'Add Timer Slide')}
                            >
                                <Timer className="w-4 h-4" />
                                <div className="absolute -top-0.5 -right-0.5">
                                    <Plus className="w-2.5 h-2.5 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </Button>
                        </>
                    )}

                    <Button
                        size="xs"
                        square
                        variant="ghost"
                        onClick={(e) => handleAddVideo(e)}
                        className="text-stone-400 hover:text-accent hover:bg-accent/10 relative group"
                        title={t('add_video_slide', 'Add Video Slide')}
                    >
                        <Film className="w-4 h-4" />
                        <div className="absolute -top-0.5 -right-0.5">
                            <Plus className="w-2.5 h-2.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Button>
                </div>
            )}
        </div>
    );
};

export default TimelineToolbar;
