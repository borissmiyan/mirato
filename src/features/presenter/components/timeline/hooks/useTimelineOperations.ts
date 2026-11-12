import { ISlide, ITemplate, IMediaItem, IPresentationFile, IStyleLayer, ICanvasSlide } from '@/core/types';
import { toast } from '@/core/utils/toast';
import { TFunction } from 'i18next';
import { ModalType } from '@/core/store/modalStore';
import { createSlideFromMediaItem } from '../../../utils/mediaSlideUtils';
import {
    calculateSlideInsertionIndex,
    insertSlidesIntoTimeline,
    createTimerSlide,
    createVideoSlide
} from '../utils/timelineSlideInsertion';

interface UseTimelineOperationsProps {
    activePresentationId: string | null;
    presentation: IPresentationFile | null;
    slides: ISlide[];
    previewSlideId: string | null;
    templatesMap: Map<string, ITemplate>;
    blocksMap: Map<string, unknown>;
    templates: ITemplate[];
    t: TFunction;
    updatePresentationSlides: (id: string, slides: ISlide[]) => Promise<void>;
    setPreviewSlide: (id: string | null, pid?: string, rootId?: string, parentId?: string | null) => void;
    updateSlideBackground: (sid: string, bg: IStyleLayer[]) => Promise<void>;
    openModal: (type: ModalType, props?: Record<string, unknown>) => void;
}

/**
 * Hook to handle CRUD operations for slides and timers on the timeline.
 */
export const useTimelineOperations = ({
    activePresentationId,
    presentation,
    slides,
    previewSlideId,
    templatesMap,
    blocksMap,
    templates,
    t,
    updatePresentationSlides,
    setPreviewSlide,
    updateSlideBackground,
    openModal
}: UseTimelineOperationsProps) => {

    const handleAddSlide = async (blockId: string, e?: React.MouseEvent) => {
        if (!activePresentationId) {
            toast.error(t('error_no_active_presentation', 'No active presentation'));
            return;
        }

        if (!presentation) {
            toast.info(t('loading_presentation', 'Loading presentation...'));
            return;
        }

        const block = blocksMap.get(blockId);
        if (!block && blockId !== 'default' && blockId !== 'bible') {
            console.error('[SlideTimeline] Block not found:', blockId);
            toast.error(t('error_block_not_found', 'Block type not found: {{blockId}}', { blockId }));
            return;
        }

        if (blockId === 'bible') {
            const insertBefore = e && (e.metaKey || e.ctrlKey);
            openModal(ModalType.BIBLE_SELECTION, { insertBefore });
            return;
        }

        const blockTemplates = templates.filter(t => t.category === blockId);
        const templateId = blockTemplates.length > 0 ? blockTemplates[0].id : (blockId === 'default' ? 'empty-slide' : 'default');

        const newSlide: ISlide = {
            id: crypto.randomUUID(),
            type: 'normal',
            order: 0,
            blockId,
            templateId,
            content: { variables: {} },
        };

        try {
            const insertBefore = !!(e && (e.metaKey || e.ctrlKey));
            const insertionIndex = calculateSlideInsertionIndex({ slides, previewSlideId, insertBefore });
            const newSlides = insertSlidesIntoTimeline(slides, [newSlide], insertionIndex);

            await updatePresentationSlides(activePresentationId, newSlides);
            setPreviewSlide(newSlide.id, activePresentationId);
        } catch (error) {
            console.error('[SlideTimeline] Failed to add slide:', error);
            toast.error(t('error_add_slide_failed', 'Failed to add slide'));
        }
    };

    const handleAddTimer = async (e?: React.MouseEvent) => {
        if (!activePresentationId || !presentation) return;

        const newSlide = createTimerSlide();

        try {
            const insertBefore = !!(e && (e.metaKey || e.ctrlKey));
            const insertionIndex = calculateSlideInsertionIndex({ slides, previewSlideId, insertBefore });
            const newSlides = insertSlidesIntoTimeline(slides, [newSlide], insertionIndex);

            await updatePresentationSlides(activePresentationId, newSlides);
            setPreviewSlide(newSlide.id, activePresentationId);
        } catch (error) {
            console.error('[SlideTimeline] Failed to add timer:', error);
            toast.error(t('error_add_timer_failed', 'Failed to add timer'));
        }
    };

    const handleAddVideo = async (eOrMedia?: React.MouseEvent | IMediaItem, customIndex?: number) => {
        if (!activePresentationId || !presentation) return;

        const isMediaItem = eOrMedia && typeof eOrMedia === 'object' && 'type' in eOrMedia && eOrMedia.type === 'video';
        const media = isMediaItem ? (eOrMedia as IMediaItem) : null;
        const e = !isMediaItem && eOrMedia && 'nativeEvent' in eOrMedia ? (eOrMedia as React.MouseEvent) : undefined;

        const newSlide = createVideoSlide(media);

        try {
            const insertBefore = !!(e && (e.metaKey || e.ctrlKey));
            const insertionIndex = calculateSlideInsertionIndex({ slides, previewSlideId, insertBefore, customIndex });
            const newSlides = insertSlidesIntoTimeline(slides, [newSlide], insertionIndex);

            await updatePresentationSlides(activePresentationId, newSlides);
            setPreviewSlide(newSlide.id, activePresentationId);
        } catch (error) {
            console.error('[SlideTimeline] Failed to add video:', error);
            toast.error(t('error_add_video_failed', 'Failed to add video slide'));
        }
    };

    const handleRestoreTemplateBg = async (slideId: string) => {
        await updateSlideBackground(slideId, null);
    };

    const handleApplyBgToAll = async (slideId: string) => {
        if (!activePresentationId) return;
        const slide = slides.find(s => s.id === slideId);
        if (!slide) return;

        const template = slide?.templateId ? templatesMap.get(slide.templateId) : undefined;
        const bgToApply = (slide.type === 'normal' ? (slide as ICanvasSlide).backgroundOverride : undefined) || template?.background;
        if (!bgToApply) return;
    };

    const handleAddMediaSlides = async (items: IMediaItem[], index?: number) => {
        if (!activePresentationId) {
            toast.error(t('error_no_active_presentation', 'No active presentation'));
            return;
        }

        const insertionIndex = typeof index === 'number' && index >= 0 && index <= slides.length
            ? index
            : slides.length;

        const newSlides = items.map((item, idx) => createSlideFromMediaItem(item, insertionIndex + idx));
        const updatedSlides = insertSlidesIntoTimeline(slides, newSlides, insertionIndex);

        await updatePresentationSlides(activePresentationId, updatedSlides);
        if (newSlides.length > 0) {
            setPreviewSlide(newSlides[0].id, activePresentationId);
        }
    };

    return {
        handleAddSlide,
        handleAddTimer,
        handleAddVideo,
        handleAddMediaSlides,
        handleRestoreTemplateBg,
        handleApplyBgToAll
    };
};
