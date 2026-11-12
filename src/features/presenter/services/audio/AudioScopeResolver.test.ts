import { describe, it, expect } from 'vitest';
import { findActiveScope } from './AudioScopeResolver';
import { ISlide, IAudioScope } from '@/core/types';

describe('AudioScopeResolver', () => {
    const mockSlides: ISlide[] = [
        { id: 'slide-1', presentationId: 'p-1', type: 'canvas', items: [] } as unknown as ISlide,
        { id: 'slide-2', presentationId: 'p-1', type: 'canvas', items: [] } as unknown as ISlide,
        { id: 'slide-3', presentationId: 'p-1', type: 'canvas', items: [] } as unknown as ISlide,
    ];

    it('returns null if slideId is not found', async () => {
        const scope = await findActiveScope('non-existent', mockSlides);
        expect(scope).toBeNull();
    });

    it('resolves relational scope covering current slide', async () => {
        const mockScope: IAudioScope = {
            id: 'scope-1',
            presentationId: 'p-1',
            startSlideId: 'slide-1',
            endSlideId: 'slide-2',
            fileId: 'audio-file-1',
            fileName: 'music.mp3',
            volume: 1,
            loop: false
        };

        const result = await findActiveScope('slide-2', mockSlides, [mockScope]);
        expect(result).toEqual(mockScope);
    });

    it('resolves global audio scope regardless of slide position', async () => {
        const globalScope: IAudioScope = {
            id: 'global-scope',
            presentationId: 'p-1',
            startSlideId: '',
            endSlideId: '',
            fileId: 'ambient.mp3',
            fileName: 'ambient.mp3',
            volume: 0.8,
            loop: true,
            isGlobal: true
        };

        const result = await findActiveScope('slide-3', mockSlides, [globalScope]);
        expect(result).toEqual(globalScope);
    });

    it('resolves legacy attached audio on slide', async () => {
        const slidesWithAudio: ISlide[] = [
            {
                id: 'legacy-slide',
                presentationId: 'p-1',
                type: 'canvas',
                items: [],
                audio: {
                    fileId: 'song-123.mp3',
                    fileName: 'Song 123'
                }
            } as unknown as ISlide
        ];

        const result = await findActiveScope('legacy-slide', slidesWithAudio);
        expect(result).not.toBeNull();
        expect(result?.fileId).toBe('song-123.mp3');
        expect(result?.fileName).toBe('Song 123');
        expect(result?.id).toBe('legacy-legacy-slide');
    });
});

