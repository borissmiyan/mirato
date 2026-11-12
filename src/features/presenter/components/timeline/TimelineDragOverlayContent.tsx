import React from 'react';
import { ISlide, ICanvasSlide, IBlock, ITemplate } from '@/core/types';
import SlideContentRenderer from '../slide-editor/SlideContentRenderer';
import { cn } from '@/core/utils/cn';

interface TimelineDragOverlayContentProps {
    activeId: string | null;
    localSlides: ISlide[];
    selectedSlideIds: string[];
    templatesMap: Map<string, ITemplate>;
    blocksMap: Map<string, IBlock>;
    lang: string;
}

/**
 * Renders the visual drag overlay for slide(s) being dragged.
 * Single slide: Shows the slide thumbnail with accent border.
 * Multiple slides: Renders a stacked "deck" effect with cards offset behind
 * the primary slide, plus a count badge.
 */
export const TimelineDragOverlayContent: React.FC<TimelineDragOverlayContentProps> = ({
    activeId,
    localSlides,
    selectedSlideIds,
    templatesMap,
    blocksMap,
    lang
}) => {
    // Preserve the last active slide so during the drop animation flight,
    // the card doesn't vanish into thin air before landing in the slot
    const lastActiveSlideRef = React.useRef<ISlide | null>(null);
    const lastSelectedIdsRef = React.useRef<string[]>(selectedSlideIds);

    const activeSlide = activeId ? localSlides.find(s => s.id === activeId) : null;
    if (activeSlide) {
        lastActiveSlideRef.current = activeSlide;
        lastSelectedIdsRef.current = selectedSlideIds;
    }

    const currentSlide = activeSlide || lastActiveSlideRef.current;
    if (!currentSlide) return null;

    const currentSelectedIds = activeSlide ? selectedSlideIds : lastSelectedIdsRef.current;
    const isSelected = currentSelectedIds.includes(currentSlide.id);
    const draggedSlides = isSelected 
        ? localSlides.filter(s => currentSelectedIds.includes(s.id))
        : [currentSlide];

    // Show max 3 stacked cards for performance
    const maxVisible = Math.min(draggedSlides.length, 3);
    const visibleSlides = draggedSlides.slice(0, maxVisible);

    // Track dropping flight when activeId becomes null but overlay is animating back to slot
    const isDropping = !activeId && Boolean(lastActiveSlideRef.current);

    return (
        <div 
            className={cn(
                "relative pointer-events-none",
                isDropping ? "animate-apple-drag-drop" : "animate-apple-drag-lift"
            )} 
            style={{ width: 128, height: 72, transformOrigin: '50% 50%' }}
        >
            {/* Render back-to-front so the first card is on top */}
            {visibleSlides.map((s, idx) => {
                const reverseIdx = maxVisible - 1 - idx;
                const offsetX = reverseIdx * 6;
                const offsetY = reverseIdx * 6;
                const scale = 1 - reverseIdx * 0.04;
                const baseOpacity = idx === 0 ? 1 : 0.7 - reverseIdx * 0.15;
                const opacity = isDropping && idx > 0 ? 0 : baseOpacity;

                return (
                    <div
                        key={s.id}
                        className={cn(
                            "w-32 aspect-video rounded-xl overflow-hidden border-2 border-accent shadow-2xl absolute top-0 left-0 bg-stone-900 ring-2 ring-accent/30",
                            isDropping && idx > 0 && "transition-opacity duration-180 ease-out"
                        )}
                        style={{
                            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
                            transformOrigin: 'top left',
                            opacity,
                            zIndex: maxVisible - reverseIdx,
                        }}
                    >
                        <div
                            className="absolute top-0 left-0 w-[1920px] h-[1080px] pointer-events-none origin-top-left"
                            style={{ transform: `scale(${128 / 1920})` }}
                        >
                            <SlideContentRenderer
                                slide={s}
                                template={s.templateId ? templatesMap.get(s.templateId) : undefined}
                                block={blocksMap.get(s.blockId)}
                                variables={s.type === 'normal' ? (s as ICanvasSlide).content?.variables : undefined}
                                canvasItems={s.type === 'normal' ? (s as ICanvasSlide).content?.canvasItems : []}
                                backgroundOverride={s.type === 'normal' ? (s as ICanvasSlide).backgroundOverride : undefined}
                                lang={lang}
                                scale={1}
                                isPreview
                                slideId={s.id}
                            />
                        </div>
                    </div>
                );
            })}

            {/* Count badge */}
            {draggedSlides.length > 1 && (
                <div
                    className={cn(
                        "absolute w-6 h-6 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg border-2 border-white/30 transition-all duration-180",
                        isDropping ? "opacity-0 scale-75" : "opacity-100 scale-100"
                    )}
                    style={{ top: -8, right: -8, zIndex: maxVisible + 1 }}
                >
                    {draggedSlides.length}
                </div>
            )}
        </div>
    );
};
