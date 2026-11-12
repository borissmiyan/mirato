import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executePresentationHotkeys } from './presentationHotkeysExecutor';
import { getDefaultStore } from 'jotai';
import {
    selectedCanvasItemIdsAtom,
    canvasToolAtom,
    latestInteractionAreaAtom,
    lastDuplicateOffsetAtom
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';

describe('executePresentationHotkeys', () => {
    beforeEach(() => {
        const store = getDefaultStore();
        store.set(selectedCanvasItemIdsAtom, []);
        store.set(canvasToolAtom, 'select');
        store.set(latestInteractionAreaAtom, 'canvas');
        store.set(lastDuplicateOffsetAtom, null);
        usePresentationStore.setState({
            previewSlideId: 'slide-1',
        } as any);
    });

    it('switches to pen tool on P key and back to select', async () => {
        const store = getDefaultStore();
        const handled1 = await executePresentationHotkeys(
            { key: 'p', preventDefault: vi.fn() },
            false,
            true,
            []
        );
        expect(handled1).toBe(true);
        expect(store.get(canvasToolAtom)).toBe('pen');

        const handled2 = await executePresentationHotkeys(
            { key: 'p', preventDefault: vi.fn() },
            false,
            true,
            []
        );
        expect(handled2).toBe(true);
        expect(store.get(canvasToolAtom)).toBe('select');
    });

    it('duplicates canvas items with smart offset on Cmd+D', async () => {
        const store = getDefaultStore();
        const mockDuplicate = vi.fn().mockResolvedValue(['clone-1']);
        usePresentationStore.setState({
            previewSlideId: 'slide-1',
            duplicateCanvasItems: mockDuplicate,
        } as any);

        const handled = await executePresentationHotkeys(
            { key: 'd', code: 'KeyD', preventDefault: vi.fn() },
            true,
            true,
            ['item-1']
        );

        expect(handled).toBe(true);
        expect(mockDuplicate).toHaveBeenCalledWith('slide-1', ['item-1'], { dx: 2, dy: 2 });
        expect(store.get(lastDuplicateOffsetAtom)).toEqual({ dx: 2, dy: 2 });
        expect(store.get(selectedCanvasItemIdsAtom)).toEqual(['clone-1']);
    });
});
