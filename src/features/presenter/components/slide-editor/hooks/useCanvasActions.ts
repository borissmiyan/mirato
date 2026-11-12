import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ICanvasItem, ICustomGuide } from '@/core/types';
import {
    copiedCanvasStyleAtom,
    showCanvasRulersAtom,
    canvasCustomGuidesAtom,
    canvasZoomAtom,
    canvasOffsetAtom,
    CanvasTool,
} from '@/core/store/uiAtoms';
import {
    extractCanvasStyle,
    applyCanvasStyle,
    bringForward,
    bringToFront,
    sendBackward,
    sendToBack,
    groupCanvasItems,
    ungroupCanvasItems,
} from '@/core/utils/canvasLayers';
import { toggleCanvasMask } from '@/core/utils/canvasMasks';
import { calculateAlignment, calculateDistribution, flipCanvasItems, CanvasAlignMode } from '@/core/utils/canvasDistribution';
import { calculateZoomToSelection } from '@/app/hooks/canvasHotkeyHelpers';
import { useCanvasShortcuts } from './useCanvasShortcuts';

interface UseCanvasActionsProps {
    slideId: string;
    resolvedItems: ICanvasItem[];
    selectedIds: string[];
    setSelectedIds: (ids: string[]) => void;
    editingId: string | null;
    setEditingId: (id: string | null) => void;
    setToolAt: (tool: CanvasTool) => void;
    canvasTool?: CanvasTool;
    vectorEditingId?: string | null;
    setVectorEditingId?: (id: string | null) => void;
}

export function useCanvasActions({
    slideId,
    resolvedItems,
    selectedIds,
    setSelectedIds,
    editingId,
    setEditingId,
    setToolAt,
    canvasTool,
    vectorEditingId,
    setVectorEditingId,
}: UseCanvasActionsProps) {
    const [copiedStyle, setCopiedStyle] = useAtom(copiedCanvasStyleAtom);
    const [showRulers, setShowRulers] = useAtom(showCanvasRulersAtom);
    const [customGuides, setCustomGuides] = useAtom(canvasCustomGuidesAtom);
    const [, setZoom] = useAtom(canvasZoomAtom);
    const [, setOffset] = useAtom(canvasOffsetAtom);

    // 1. Duplicate
    const handleDuplicate = useCallback(async () => {
        if (selectedIds.length === 0) return;
        const newIds = await usePresentationStore.getState().duplicateCanvasItems(slideId, selectedIds);
        if (newIds && newIds.length > 0) {
            setSelectedIds(newIds);
        }
    }, [slideId, selectedIds, setSelectedIds]);

    // 2. Copy Style
    const handleCopyStyle = useCallback(() => {
        if (selectedIds.length === 0) return;
        const source = resolvedItems.find(i => i.id === selectedIds[0]);
        if (source) {
            const style = extractCanvasStyle(source);
            setCopiedStyle(style);
        }
    }, [selectedIds, resolvedItems, setCopiedStyle]);

    // 3. Paste Style
    const handlePasteStyle = useCallback(() => {
        if (!copiedStyle || selectedIds.length === 0) return;
        const updates = selectedIds
            .map(id => {
                const target = resolvedItems.find(i => i.id === id);
                return target ? { id, updates: applyCanvasStyle(target, copiedStyle) } : null;
            })
            .filter((u): u is NonNullable<typeof u> => u !== null);
        if (updates.length > 0) {
            usePresentationStore.getState().updateCanvasItems(slideId, updates);
        }
    }, [copiedStyle, selectedIds, slideId, resolvedItems]);

    // 4. Group
    const handleGroup = useCallback(() => {
        if (selectedIds.length < 2) return;
        const newGroupId = crypto.randomUUID();
        const updated = groupCanvasItems(resolvedItems, selectedIds, newGroupId);
        usePresentationStore.getState().updateCanvasItemsOrder(slideId, updated);
    }, [selectedIds, slideId, resolvedItems]);

    // 5. Ungroup
    const handleUngroup = useCallback(() => {
        if (selectedIds.length === 0) return;
        const updated = ungroupCanvasItems(resolvedItems, selectedIds);
        usePresentationStore.getState().updateCanvasItemsOrder(slideId, updated);
    }, [selectedIds, slideId, resolvedItems]);

    // 5.1 Toggle Mask
    const handleToggleMask = useCallback(() => {
        if (selectedIds.length === 0) return;
        const updated = toggleCanvasMask(resolvedItems, selectedIds[0]);
        usePresentationStore.getState().updateCanvasItemsOrder(slideId, updated);
    }, [selectedIds, slideId, resolvedItems]);

    // 6. Layer Order
    const updateOrder = useCallback((reorderFn: (items: ICanvasItem[], ids: string[]) => ICanvasItem[]) => {
        if (selectedIds.length === 0) return;
        const updated = reorderFn(resolvedItems, selectedIds);
        usePresentationStore.getState().updateCanvasItemsOrder(slideId, updated);
    }, [selectedIds, slideId, resolvedItems]);

    const handleBringForward = useCallback(() => updateOrder(bringForward), [updateOrder]);
    const handleBringToFront = useCallback(() => updateOrder(bringToFront), [updateOrder]);
    const handleSendBackward = useCallback(() => updateOrder(sendBackward), [updateOrder]);
    const handleSendToBack = useCallback(() => updateOrder(sendToBack), [updateOrder]);

    // 7. Lock / Unlock
    const handleToggleLock = useCallback(() => {
        if (selectedIds.length === 0) return;
        const anyLocked = selectedIds.some(id => resolvedItems.find(i => i.id === id)?.locked);
        usePresentationStore.getState().updateCanvasItems(slideId, selectedIds.map(id => ({ id, updates: { locked: !anyLocked } })));
    }, [selectedIds, slideId, resolvedItems]);

    // 8. Visibility
    const handleToggleVisibility = useCallback(() => {
        if (selectedIds.length === 0) return;
        const anyHidden = selectedIds.some(id => resolvedItems.find(i => i.id === id)?.visible === false);
        usePresentationStore.getState().updateCanvasItems(slideId, selectedIds.map(id => ({ id, updates: { visible: anyHidden } })));
    }, [selectedIds, slideId, resolvedItems]);

    // 9. Delete
    const handleDelete = useCallback(() => {
        if (selectedIds.length === 0) return;
        usePresentationStore.getState().removeCanvasItem(slideId, selectedIds);
        setSelectedIds([]);
    }, [selectedIds, slideId, setSelectedIds]);

    // 11. Flip H & Flip V
    const handleFlipH = useCallback(() => {
        if (selectedIds.length === 0) return;
        const selectedItems = resolvedItems.filter(i => selectedIds.includes(i.id));
        usePresentationStore.getState().updateCanvasItems(slideId, flipCanvasItems(selectedItems, 'horizontal'));
    }, [selectedIds, resolvedItems, slideId]);

    const handleFlipV = useCallback(() => {
        if (selectedIds.length === 0) return;
        const selectedItems = resolvedItems.filter(i => selectedIds.includes(i.id));
        usePresentationStore.getState().updateCanvasItems(slideId, flipCanvasItems(selectedItems, 'vertical'));
    }, [selectedIds, resolvedItems, slideId]);

    // 12. Zoom to Selection (Shift+2) & Zoom Fit (Shift+1)
    const handleZoomToSelection = useCallback(() => {
        if (selectedIds.length === 0) return;
        const selectedItems = resolvedItems.filter(i => selectedIds.includes(i.id));
        const fit = calculateZoomToSelection(selectedItems);
        if (fit) {
            setZoom(fit.zoom);
            setOffset(fit.offset);
        }
    }, [selectedIds, resolvedItems, setZoom, setOffset]);

    const handleZoomFit = useCallback(() => {
        setZoom(1.0);
        setOffset({ x: 0, y: 0 });
    }, [setZoom, setOffset]);

    // Custom Guides management
    const handleAddGuide = useCallback((guide: ICustomGuide) => {
        setCustomGuides(prev => [...prev, guide]);
    }, [setCustomGuides]);

    const handleUpdateGuide = useCallback((id: string, positionPct: number) => {
        setCustomGuides(prev => prev.map(g => g.id === id ? { ...g, positionPct } : g));
    }, [setCustomGuides]);

    const handleRemoveGuide = useCallback((id: string) => {
        setCustomGuides(prev => prev.filter(g => g.id !== id));
    }, [setCustomGuides]);

    const { isAltHeld, isShiftHeld } = useCanvasShortcuts({
        slideId,
        resolvedItems,
        selectedIds,
        setSelectedIds,
        editingId,
        setEditingId,
        setToolAt,
        canvasTool,
        vectorEditingId,
        setVectorEditingId,
        setShowRulers,
        handleZoomFit,
        handleZoomToSelection,
        handleFlipH,
        handleFlipV,
        handleDelete,
        handleCopyStyle,
        handlePasteStyle,
        handleDuplicate,
        handleGroup,
        handleUngroup,
        handleToggleMask,
        handleToggleLock,
        handleToggleVisibility,
        handleBringForward,
        handleBringToFront,
        handleSendBackward,
        handleSendToBack,
    });

    // 10. Align & Distribute (Shift = relative to canvas)
    const handleAlign = useCallback((mode: CanvasAlignMode, isShift?: boolean) => {
        const relativeToCanvas = isShift ?? isShiftHeld;
        if (!relativeToCanvas && selectedIds.length < 2) return;
        if (selectedIds.length === 0) return;

        const selectedItems = resolvedItems.filter(i => selectedIds.includes(i.id));
        usePresentationStore.getState().updateCanvasItems(slideId, calculateAlignment(selectedItems, mode, relativeToCanvas));
    }, [selectedIds, resolvedItems, slideId, isShiftHeld]);

    const handleDistribute = useCallback((axis: 'horizontal' | 'vertical') => {
        if (selectedIds.length < 3) return;
        const selectedItems = resolvedItems.filter(i => selectedIds.includes(i.id));
        usePresentationStore.getState().updateCanvasItems(slideId, calculateDistribution(selectedItems, axis));
    }, [selectedIds, resolvedItems, slideId]);

    const contextMenuHandlers = {
        onDuplicate: handleDuplicate,
        onCopyStyle: handleCopyStyle,
        onPasteStyle: handlePasteStyle,
        onGroup: handleGroup,
        onUngroup: handleUngroup,
        onToggleMask: handleToggleMask,
        onBringForward: handleBringForward,
        onBringToFront: handleBringToFront,
        onSendBackward: handleSendBackward,
        onSendToBack: handleSendToBack,
        onToggleLock: handleToggleLock,
        onToggleVisibility: handleToggleVisibility,
        onFlipH: handleFlipH,
        onFlipV: handleFlipV,
        onDelete: handleDelete,
    };

    return {
        copiedStyle,
        canPasteStyle: !!copiedStyle,
        showRulers,
        setShowRulers,
        customGuides,
        handleAddGuide,
        handleUpdateGuide,
        handleRemoveGuide,
        isAltHeld,
        isShiftHeld,
        contextMenuHandlers,
        handleDuplicate,
        handleCopyStyle,
        handlePasteStyle,
        handleGroup,
        handleUngroup,
        handleToggleMask,
        handleBringForward,
        handleBringToFront,
        handleSendBackward,
        handleSendToBack,
        handleToggleLock,
        handleToggleVisibility,
        handleDelete,
        handleAlign,
        handleDistribute,
        handleFlipH,
        handleFlipV,
        handleZoomToSelection,
        handleZoomFit,
    };
}

