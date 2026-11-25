import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/core/utils/cn';
import { ISlide, ICanvasSlide, INestedSlide, IBlock, ITemplate, IPresentationFile } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import {
    ChevronRight, ChevronDown, ExternalLink, Layers, Link2
} from 'lucide-react';
import { CustomSlideStackIcon, Tooltip } from '@/shared/ui';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import { IpcService } from '@/core/services/ipcService';

const ICON_MAP: Record<string, React.FC<{ className?: string; strokeWidth?: number }>> = {
    Presentation: CustomSlideStackIcon
};

interface NestedPresentationTileProps {
    slide: ISlide;
    nestedPresentation: IPresentationFile;
    blocksMap: Map<string, IBlock>;
    templatesMap: Map<string, ITemplate>;
    presentationsMap: Map<string, IPresentationFile>;
    lang: string;
    previewSlideId: string | null;
    selectedPresentationId: string | null;
    onContextMenu: (e: React.MouseEvent, slideId: string, presentationId: string) => void;
}

/**
 * Renders the inline-expanded nested presentation content —
 * a bounding box with nested slide previews and an "Edit" button.
 * Only renders when slide.isExpanded is true.
 */
const NestedPresentationTile: React.FC<NestedPresentationTileProps> = ({
    slide,
    nestedPresentation,
    blocksMap,
    templatesMap,
    lang,
    previewSlideId,
    selectedPresentationId,
    onContextMenu,
}) => {
    const { t } = useTranslation();
    const { setPreviewSlide, setLiveSlide, setActivePresentation, setCachedNestedPresentation, activePresentationId, navigationParentSlideId } = usePresentationStore(
        useShallow(s => ({
            setPreviewSlide: s.setPreviewSlide,
            setLiveSlide: s.setLiveSlide,
            setActivePresentation: s.setActivePresentation,
            setCachedNestedPresentation: s.setCachedNestedPresentation,
            activePresentationId: s.activePresentationId,
            navigationParentSlideId: s.navigationParentSlideId,
        }))
    );

    if (!slide.isExpanded) return null;

    const isHymn = Boolean(
        nestedPresentation.hymnalId || 
        nestedPresentation.metadata?.isHymn || 
        nestedPresentation.metadata?.hymnOrder
    );
    const isLinked = slide.type === 'normal' && Boolean((slide as ICanvasSlide).linkedPresentationId);

    return (
        <div data-parent-id={slide.id} className="relative z-0 flex items-center gap-2 px-2 bg-white/2 rounded-[14px] border border-white/5 py-3 animate-nested-unfold">
            {/* Left accent bar */}
            <div className={cn(
                'w-1 h-12 rounded-full shrink-0',
                isHymn ? 'bg-amber-400/40' : (isLinked ? 'bg-accent/30' : 'bg-orange-500/20')
            )} />

            <div className="flex gap-2.5">
                {nestedPresentation.slides.map((nestedSlide, idx) => {
                    const nb = blocksMap.get(nestedSlide.blockId);
                    const nt = templatesMap.get(nestedSlide.templateId);
                    const isNSel = previewSlideId === nestedSlide.id
                        && selectedPresentationId === nestedPresentation.id
                        && (!navigationParentSlideId || navigationParentSlideId === slide.id);

                    return (
                        <div
                            key={nestedSlide.id}
                            data-slide-id={nestedSlide.id}
                            onClick={() => {
                                setCachedNestedPresentation(slide.id, nestedPresentation);
                                setCachedNestedPresentation(nestedPresentation.id, nestedPresentation);
                                setPreviewSlide(nestedSlide.id, nestedPresentation.id, activePresentationId || undefined, slide.id);
                            }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                onContextMenu(e, nestedSlide.id, nestedPresentation.id);
                            }}
                            onDoubleClick={async () => {
                                setCachedNestedPresentation(slide.id, nestedPresentation);
                                setCachedNestedPresentation(nestedPresentation.id, nestedPresentation);
                                await setPreviewSlide(nestedSlide.id, nestedPresentation.id, activePresentationId || undefined, slide.id);
                                setLiveSlide(nestedSlide.id, nestedPresentation.id, activePresentationId || undefined, slide.id);

                                if (IpcService.isElectron()) {
                                    const displaySettings = usePresenterStore.getState().settings.display;
                                    await IpcService.invoke('open-projector', displaySettings);
                                }
                            }}
                            className={cn(
                                'group/nested relative shrink-0 w-24 aspect-video rounded-[10px] border transition-all cursor-pointer overflow-hidden',
                                isNSel
                                    ? 'border-accent ring-1 ring-accent/30 scale-105 z-10'
                                    : 'border-white/5 hover:border-white/20 bg-stone-900/50'
                            )}
                        >
                                <SlideContentRenderer
                                    template={nt}
                                    block={nb}
                                    variables={(nestedSlide as ICanvasSlide).content?.variables || {}}
                                    lang={lang}
                                    isPreview={true}
                                    scale={96 / 1920}
                                    canvasItems={(nestedSlide as ICanvasSlide).content?.canvasItems || []}
                                    slide={nestedSlide}
                                    slideId={nestedSlide.id}
                                />

                            {/* Slide number badge */}
                            <div className="absolute top-1 left-1 px-1 py-0.5 rounded-[5px] bg-black/40 text-[6px] font-black text-stone-500">
                                {idx + 1}
                            </div>

                            {/* Linked indicator */}
                            {isLinked && idx === 0 && (
                                <div className="absolute bottom-1 right-1 z-20">
                                    <Tooltip
                                        content={
                                            isHymn
                                                ? t('linked_hymn_tooltip', 'Связано со сборником гимнов')
                                                : t('linked_presentation_tooltip', 'Связано с оригиналом в библиотеке')
                                        }
                                        position="top"
                                    >
                                        <div className="px-1 py-0.5 rounded-[5px] bg-accent/20 border border-accent/20">
                                            <Link2 className="w-2 h-2 text-accent" />
                                        </div>
                                    </Tooltip>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Edit Nested Button - hidden for hymns (read-only) */}
                {!isHymn && (
                    <button
                        type="button"
                        onClick={() => setActivePresentation(nestedPresentation.id)}
                        className="w-10 aspect-video rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-1 hover:border-accent/40 hover:bg-accent/5 transition-all group cursor-pointer apple-press"
                        title={t('edit_nested_presentation', 'Open for full editing')}
                        aria-label={t('edit_nested_presentation', 'Open for full editing')}
                    >
                        <ExternalLink className="w-3 h-3 text-stone-600 group-hover:text-accent" />
                        <span className="text-[6px] font-bold text-stone-700 uppercase group-hover:text-accent/70">
                            {t('edit', 'Edit')}
                        </span>
                    </button>
                )}
            </div>

            {/* Right accent bar */}
            <div className={cn(
                'w-1 h-12 rounded-full shrink-0',
                isHymn ? 'bg-amber-400/40' : (isLinked ? 'bg-accent/30' : 'bg-orange-500/20')
            )} />
        </div>
    );
};

export default React.memo(NestedPresentationTile);
