import { useState, useRef, useCallback, useEffect } from 'react';
import { 
    PointerSensor,
    KeyboardSensor,
    useSensor, 
    useSensors, 
    DragStartEvent,
    DragOverEvent, 
    DragEndEvent 
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ISlide } from '@/core/types';
import { TrackContainerHandle } from '../TrackContainer';
import { useTimelineAutoScroll } from './useTimelineAutoScroll';

interface UseTimelineDragAndDropProps {
    activePresentationId: string | null;
    slides: ISlide[];
    localSlides: ISlide[];
    setLocalSlides: (slides: ISlide[] | ((prev: ISlide[]) => ISlide[])) => void;
    selectedSlideIds: string[];
    trackRef: React.RefObject<TrackContainerHandle | null>;
    dragActiveRef: React.MutableRefObject<boolean>;
    updatePresentationSlides: (id: string, slides: ISlide[]) => Promise<void>;
    addPresentationToTimeline: (pid: string, idx?: number) => Promise<void>;
    takeSnapshot: (presentationId: string) => Promise<void>;
    disabled?: boolean;
}

/**
 * Hook to handle all drag-and-drop logic for the timeline, integrating with auto-scroll.
 * Uses PointerSensor for reliability in Electron/Mac environments.
 */
export const useTimelineDragAndDrop = ({
    activePresentationId,
    slides,
    localSlides,
    setLocalSlides,
    selectedSlideIds,
    trackRef,
    dragActiveRef,
    updatePresentationSlides,
    addPresentationToTimeline,
    takeSnapshot,
    disabled = false
}: UseTimelineDragAndDropProps) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [droppingId, setDroppingId] = useState<string | null>(null);
    const dropTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleDropComplete = useCallback(() => {
        if (dropTimeoutRef.current) {
            clearTimeout(dropTimeoutRef.current);
            dropTimeoutRef.current = null;
        }
        setDroppingId(null);
    }, []);

    // Cleanup pending drop timers on unmount
    useEffect(() => {
        return () => {
            if (dropTimeoutRef.current) {
                clearTimeout(dropTimeoutRef.current);
            }
        };
    }, []);
    
    // Safety: track current localSlides in a ref to bypass stale closure issues during handles
    const localSlidesRef = useRef(localSlides);
    useEffect(() => {
        localSlidesRef.current = localSlides;
    }, [localSlides]);

    const { startAutoScroll, stopAutoScroll } = useTimelineAutoScroll({
        trackRef,
        dragActiveRef,
        disabled
    });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        if (disabled) return;
        if (dropTimeoutRef.current) {
            clearTimeout(dropTimeoutRef.current);
            dropTimeoutRef.current = null;
        }
        setDroppingId(null);
        dragActiveRef.current = true;
        setActiveId(event.active.id as string);

        startAutoScroll();
    }, [disabled, dragActiveRef, startAutoScroll]);

    /**
     * Reorder slides when dragging over a different item.
     */
    const handleDragOver = useCallback((event: DragOverEvent) => {
        if (disabled) return;
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const activeIdStr = active.id as string;
        const overIdStr = over.id as string;

        if (overIdStr === 'presentation-item-drag' || overIdStr === 'timeline-droppable') return;

        setLocalSlides((currentSlides) => {
            const oldIndex = currentSlides.findIndex(s => s.id === activeIdStr);
            const newIndex = currentSlides.findIndex(s => s.id === overIdStr);

            if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return currentSlides;

            const isPartOfSelection = selectedSlideIds.includes(activeIdStr);
            const draggedIds = isPartOfSelection ? selectedSlideIds : [activeIdStr];
            const validDraggedIds = draggedIds.filter(id => currentSlides.some(s => s.id === id));

            if (validDraggedIds.includes(overIdStr)) return currentSlides;

            if (validDraggedIds.length <= 1) {
                return arrayMove(currentSlides, oldIndex, newIndex);
            }

            const remaining = currentSlides.filter(s => !validDraggedIds.includes(s.id));
            const overIdxInRemaining = remaining.findIndex(s => s.id === overIdStr);
            
            if (overIdxInRemaining === -1) return currentSlides;

            const sortedDragged = [...validDraggedIds].sort((a, b) => {
                return currentSlides.findIndex(s => s.id === a) - currentSlides.findIndex(s => s.id === b);
            });

            const insertionIdx = oldIndex < newIndex ? overIdxInRemaining + 1 : overIdxInRemaining;
            
            return [
                ...remaining.slice(0, insertionIdx),
                ...sortedDragged.map(id => currentSlides.find(s => s.id === id)!),
                ...remaining.slice(insertionIdx)
            ];
        });
    }, [disabled, selectedSlideIds, setLocalSlides]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        if (disabled) return;
        stopAutoScroll();
        dragActiveRef.current = false;

        const activeIdStr = event.active.id as string;
        // Keep droppingId active during the 220ms drop flight so the slot stays in placeholder mode
        setDroppingId(activeIdStr);
        setActiveId(null);

        if (dropTimeoutRef.current) {
            clearTimeout(dropTimeoutRef.current);
        }
        // Safety timeout in case drop animation is skipped or sideEffects fails to run
        dropTimeoutRef.current = setTimeout(() => {
            setDroppingId(null);
            dropTimeoutRef.current = null;
        }, 240);

        const { active, over } = event;

        if (over && active.id === 'presentation-item-drag') {
            const presentationId = active.data.current?.presentationId;
            if (presentationId) {
                await addPresentationToTimeline(presentationId);
                return;
            }
        }

        if (over) {
            const finalSlidesOrdered = localSlidesRef.current.map((s, i) => ({
                ...s,
                order: i,
            }));

            // Sync visual state immediately
            setLocalSlides(finalSlidesOrdered);

            // Persist to store / DB (snapshot before so drag reorder is undoable)
            if (activePresentationId && finalSlidesOrdered.length > 0) {
                await takeSnapshot(activePresentationId);
                await updatePresentationSlides(activePresentationId, finalSlidesOrdered);
            }
        }
    }, [activePresentationId, addPresentationToTimeline, disabled, dragActiveRef, setLocalSlides, stopAutoScroll, updatePresentationSlides, takeSnapshot]);

    const handleDragCancel = useCallback(() => {
        stopAutoScroll();
        if (dropTimeoutRef.current) {
            clearTimeout(dropTimeoutRef.current);
            dropTimeoutRef.current = null;
        }
        setDroppingId(null);
        dragActiveRef.current = false;
        setActiveId(null);
        setLocalSlides([...slides]);
    }, [dragActiveRef, setLocalSlides, slides, stopAutoScroll]);

    return {
        activeId,
        droppingId,
        handleDropComplete,
        sensors,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel
    };
};
