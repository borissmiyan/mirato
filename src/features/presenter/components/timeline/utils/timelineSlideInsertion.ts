import { ISlide, IMediaItem } from '@/core/types';

interface InsertionIndexParams {
    slides: ISlide[];
    previewSlideId?: string | null;
    insertBefore?: boolean;
    customIndex?: number;
}

/**
 * Calculates the target insertion index in the timeline.
 */
export function calculateSlideInsertionIndex({
    slides,
    previewSlideId,
    insertBefore = false,
    customIndex
}: InsertionIndexParams): number {
    if (typeof customIndex === 'number' && customIndex >= 0 && customIndex <= slides.length) {
        return customIndex;
    }
    const selectedIdx = previewSlideId ? slides.findIndex(s => s.id === previewSlideId) : -1;
    if (selectedIdx !== -1) {
        return insertBefore ? selectedIdx : selectedIdx + 1;
    }
    return slides.length;
}

/**
 * Slices and inserts new slides into the array, reindexing `order`.
 */
export function insertSlidesIntoTimeline(
    slides: ISlide[],
    newSlides: ISlide[],
    insertionIndex: number
): ISlide[] {
    return [
        ...slides.slice(0, insertionIndex),
        ...newSlides,
        ...slides.slice(insertionIndex)
    ].map((s, i) => ({ ...s, order: i }));
}

/**
 * Creates a default timer slide.
 */
export function createTimerSlide(): ISlide {
    return {
        id: crypto.randomUUID(),
        type: 'normal',
        order: 0,
        blockId: 'default',
        templateId: 'blank-dark',
        content: { variables: {} },
        timerSettings: {
            duration: 300,
            style: 'minimal_ring',
            endAction: 'none'
        }
    };
}

/**
 * Creates a video slide from media or empty placeholder.
 */
export function createVideoSlide(media?: IMediaItem | null): ISlide {
    return {
        id: crypto.randomUUID(),
        type: 'video',
        name: media?.name || 'Video Slide',
        order: 0,
        blockId: 'default',
        templateId: 'blank-dark',
        videoSettings: {
            mediaId: media?.id,
            strategy: 'auto',
            scaling: 'contain',
            speed: 1,
            volume: 1,
            loop: false,
            muted: false
        },
        ...(media ? {
            backgroundOverride: [{
                id: crypto.randomUUID(),
                type: 'video',
                visible: true,
                opacity: 1,
                blendMode: 'normal',
                video: {
                    url: media.path,
                    id: media.id,
                    source: 'local',
                    isMuted: false,
                    isLooping: false,
                    isFromDb: !!media.data
                }
            }]
        } : {})
    };
}

