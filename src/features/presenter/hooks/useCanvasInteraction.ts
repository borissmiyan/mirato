import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useAtom, useSetAtom, getDefaultStore } from 'jotai';
import {
    selectedCanvasItemIdsAtom,
    editingCanvasItemIdAtom,
    canvasToolAtom,
    slideEditorDragActiveAtom,
    slideEditorPendingUpdateAtom,
    lastDuplicateOffsetAtom,
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useShallow } from 'zustand/react/shallow';
import { ICanvasItem, ICustomGuide, IVectorNode } from '@/core/types';
import { shapeItemToVectorNodes } from '../components/slide-editor/renderers/vectorGeometry';
import {
    calculateMove,
    calculateResize,
    calculateRotation,
    calculatePivot,
    calculateSmartSnap,
    getCursorForCorner,
    type DragState,
    type ISnapGuide,
} from '@/core/utils/canvasMath';
import {
    resolveVisualDimensions,
    cloneItemsForAltDrag,
    calculateCornerDeformation,
} from '../components/slide-editor/utils/canvasInteractionMath';

export function useCanvasInteraction(
    slideId: string,
    localItems: ICanvasItem[],
    setLocalItems: React.Dispatch<React.SetStateAction<ICanvasItem[]>>,
    getContainerRect: () => DOMRect | { left: number; top: number; width: number; height: number; },
    customGuides?: ICustomGuide[],
    gridSnapPct?: number
) {
    const { updateCanvasItem, updateCanvasItemsOrder, takeSnapshot } = usePresentationStore(useShallow(s => ({
        updateCanvasItem: s.updateCanvasItem,
        updateCanvasItemsOrder: s.updateCanvasItemsOrder,
        takeSnapshot: s.takeSnapshot
    })));
    const [selectedIds, setSelectedIds] = useAtom(selectedCanvasItemIdsAtom);
    const [editingId, setEditingId] = useAtom(editingCanvasItemIdAtom) as [string | null, (v: string | null) => void];
    const [tool, setTool] = useAtom(canvasToolAtom) as [string, (v: string) => void];
    const setDragActive = useSetAtom(slideEditorDragActiveAtom);
    const setPendingUpdate = useSetAtom(slideEditorPendingUpdateAtom);

    const [rotateCursorAngle, setRotateCursorAngle] = useState<number | null>(null);
    const [activeGuides, setActiveGuides] = useState<ISnapGuide[]>([]);
    const [dragActiveMode, setDragActiveMode] = useState<'move' | 'resize' | 'rotate' | null>(null);
    const dragState = useRef<DragState | null>(null);
    const rafIdRef = useRef<number | null>(null);
    const latestMoveEventRef = useRef<MouseEvent | null>(null);
    const localItemsRef = useRef(localItems);
    useEffect(() => {
        localItemsRef.current = localItems;
    }, [localItems]);

    const handleMouseDown = useCallback(async (e: React.MouseEvent, item: ICanvasItem, type: 'move' | 'resize' | 'rotate' | 'pivot', corner?: string) => {
        if (item.locked) return;
        if (editingId === item.id) return;

        if (tool === 'text' && item.type === 'text' && type !== 'resize' && type !== 'rotate') {
            setEditingId(item.id);
            setSelectedIds([item.id]);
            return;
        }

        let targetIds = selectedIds;
        const isMulti = e.shiftKey;
        const isDeepSelect = e.ctrlKey || e.metaKey;

        if (isMulti && type === 'move') {
            targetIds = selectedIds.includes(item.id)
                ? selectedIds.filter(id => id !== item.id)
                : [...selectedIds, item.id];
            setSelectedIds(targetIds);
        } else if (isDeepSelect && type === 'move') {
            // Figma Deep-Selection (Cmd+Click / Ctrl+Click): select only clicked child, bypassing group expansion
            targetIds = [item.id];
            setSelectedIds(targetIds);
        } else if (!selectedIds.includes(item.id)) {
            // Figma-grade group selection: if grouped and group not already selected, select whole group
            if (item.groupId && !selectedIds.some(id => localItems.find(i => i.id === id)?.groupId === item.groupId)) {
                const groupItems = localItems.filter(i => i.groupId === item.groupId && !i.locked);
                targetIds = groupItems.map(i => i.id);
            } else {
                targetIds = [item.id];
            }
            setSelectedIds(targetIds);
        }

        let initialPathNodes: IVectorNode[] | undefined;
        if (type === 'resize' && corner && (item.type === 'shape' || item.type === 'path')) {
            initialPathNodes = shapeItemToVectorNodes(item).nodes;
        }

        const isAltDrag = Boolean(e.altKey && type === 'move');

        dragState.current = {
            type,
            itemId: item.id,
            startX: e.clientX,
            startY: e.clientY,
            startItemX: item.x,
            startItemY: item.y,
            startItemW: item.width,
            startItemH: item.height,
            startRotation: item.rotation || 0,
            startPivotX: item.pivotX ?? 50,
            startPivotY: item.pivotY ?? 50,
            corner,
            hasMoved: false,
            initialPathNodes,
            isAltDrag,
            originalTargetIds: targetIds,
            draggedItems: targetIds.map(id => {
                const activeItem = localItems.find(i => i.id === id) || item;
                return {
                    id: activeItem.id,
                    startItemX: activeItem.x,
                    startItemY: activeItem.y,
                    startItemW: activeItem.width,
                    startItemH: activeItem.height,
                    startRotation: activeItem.rotation || 0,
                    startPivotX: activeItem.pivotX ?? 50,
                    startPivotY: activeItem.pivotY ?? 50,
                };
            }),
        };

        let cursor = 'default';
        if (type === 'rotate') {
            cursor = 'none';
        } else if (type === 'pivot') {
            cursor = 'crosshair';
        } else if (type === 'resize' && corner) {
            cursor = getCursorForCorner(corner, item.rotation || 0);
        }
        document.body.style.cursor = cursor;
        document.body.style.userSelect = 'none';

        e.preventDefault();
    }, [editingId, setSelectedIds, setEditingId, tool, selectedIds, localItems]);

    const processMouseMove = useCallback((e: MouseEvent) => {
        const state = dragState.current;
        if (!state) return;

        const rect = getContainerRect();
        const deltaXPx = e.clientX - state.startX;
        const deltaYPx = e.clientY - state.startY;
        const deltaXPct = (deltaXPx / rect.width) * 100;
        const deltaYPct = (deltaYPx / rect.height) * 100;

        const item = localItems.find(i => i.id === state.itemId);
        if (!item) return;

        const updateLocalItem = (id: string, updates: Partial<ICanvasItem>) => {
            const next = (localItemsRef.current || localItems).map(i => i.id === id ? { ...i, ...updates } : i);
            localItemsRef.current = next;
            setLocalItems(next);
        };

        if (state.type === 'move') {
            if (!state.hasMoved) {
                const dist = Math.sqrt(deltaXPx * deltaXPx + deltaYPx * deltaYPx);
                if (dist < 3) return;
                state.hasMoved = true;
                setDragActive(true);
                setDragActiveMode('move');

                if (state.isAltDrag && state.originalTargetIds) {
                    const currentItems = localItemsRef.current || localItems;
                    const { clones, nextItems } = cloneItemsForAltDrag(state.originalTargetIds, currentItems);

                    if (clones.length > 0) {
                        localItemsRef.current = nextItems;
                        setLocalItems(nextItems);
                        setSelectedIds(clones.map(c => c.id));
                        state.draggedItems = clones.map(c => ({
                            id: c.id,
                            startItemX: c.x,
                            startItemY: c.y,
                            startItemW: c.width,
                            startItemH: c.height,
                            startRotation: c.rotation || 0,
                            startPivotX: c.pivotX ?? 50,
                            startPivotY: c.pivotY ?? 50,
                        }));
                        const clickedIdx = state.originalTargetIds.indexOf(state.itemId);
                        if (clickedIdx !== -1 && clones[clickedIdx]) {
                            state.itemId = clones[clickedIdx].id;
                        }
                    }
                }

                const targetPresId = usePresentationStore.getState().selectedPresentationId || usePresentationStore.getState().activePresentationId;
                if (targetPresId) {
                    takeSnapshot(targetPresId).catch(console.error);
                }
            }
            const dragged = state.draggedItems || [];
            const draggedIds = dragged.map(d => d.id);
            const otherItems = localItems.filter(i => i.id !== state.itemId && !draggedIds.includes(i.id));

            const primaryItem = localItems.find(i => i.id === state.itemId) || item;
            const rawPrimaryX = state.startItemX + deltaXPct;
            const rawPrimaryY = state.startItemY + deltaYPct;

            const bypassSnap = e.metaKey || e.ctrlKey;
            let finalDeltaXPct = deltaXPct;
            let finalDeltaYPct = deltaYPct;

            if (!bypassSnap) {
                const primaryDims = resolveVisualDimensions(primaryItem);
                const itemW = primaryDims.width;
                const itemH = primaryDims.height;

                const resolvedOtherItems = otherItems.map(other => {
                    const otherDims = resolveVisualDimensions(other);
                    return {
                        ...other,
                        width: otherDims.width,
                        height: otherDims.height,
                    };
                });

                const rawPivotX = primaryItem.pivotX;
                const pX = rawPivotX !== undefined && rawPivotX > 0 && rawPivotX <= 1 ? rawPivotX * 100 : (rawPivotX ?? 50);
                const rawPivotY = primaryItem.pivotY;
                const pY = rawPivotY !== undefined && rawPivotY > 0 && rawPivotY <= 1 ? rawPivotY * 100 : (rawPivotY ?? 50);

                const snap = calculateSmartSnap(
                    rawPrimaryX,
                    rawPrimaryY,
                    itemW,
                    itemH,
                    resolvedOtherItems,
                    1.2,
                    pX,
                    pY,
                    customGuides,
                    gridSnapPct
                );
                finalDeltaXPct = snap.snappedX - state.startItemX;
                finalDeltaYPct = snap.snappedY - state.startItemY;
                setActiveGuides(snap.guides);
            } else {
                setActiveGuides([]);
            }

            if (dragged.length > 0) {
                const updates = dragged.map((di) => {
                    const updatesForItem = calculateMove({
                        ...state,
                        startItemX: di.startItemX,
                        startItemY: di.startItemY,
                    }, finalDeltaXPct, finalDeltaYPct);
                    return {
                        id: di.id,
                        updates: updatesForItem,
                    };
                });
                const next = (localItemsRef.current || localItems).map(it => {
                    const update = updates.find((u) => u.id === it.id);
                    return update ? { ...it, ...update.updates } : it;
                });
                localItemsRef.current = next;
                setLocalItems(next);
            } else {
                const updates = calculateMove(state, finalDeltaXPct, finalDeltaYPct);
                updateLocalItem(state.itemId, updates);
            }
        } else if (state.type === 'resize' && state.corner) {
            if (!state.hasMoved) {
                const dist = Math.sqrt(deltaXPx * deltaXPx + deltaYPx * deltaYPx);
                if (dist < 2) return;
                state.hasMoved = true;
                setDragActive(true);
                setDragActiveMode('resize');
                const targetPresId = usePresentationStore.getState().selectedPresentationId || usePresentationStore.getState().activePresentationId;
                if (targetPresId) {
                    takeSnapshot(targetPresId).catch(console.error);
                }
            }

            // Figma Cmd-drag corner: deform single corner and auto-convert shape to vector path
            if ((e.metaKey || e.ctrlKey) && state.initialPathNodes && (item.type === 'shape' || item.type === 'path')) {
                const itemEl = document.getElementById(`item-${item.id}`);
                const itemW = itemEl?.offsetWidth || rect.width * (item.width / 100);
                const itemH = itemEl?.offsetHeight || rect.height * (item.height / 100);
                const nextNodes = calculateCornerDeformation(
                    state.initialPathNodes,
                    state.corner,
                    deltaXPx,
                    deltaYPx,
                    itemW,
                    itemH,
                    item.rotation || 0
                );

                if (nextNodes) {
                    updateLocalItem(state.itemId, {
                        type: 'path',
                        path: { nodes: nextNodes, isClosed: true },
                        shape: undefined,
                    });
                    return;
                }
            }

            const updates = calculateResize(state, deltaXPx, deltaYPx, rect.width, rect.height, item, e.shiftKey, e.altKey);
            if (updates) updateLocalItem(state.itemId, updates);
        } else if (state.type === 'rotate') {
            if (!state.hasMoved) {
                state.hasMoved = true;
                setDragActive(true);
                setDragActiveMode('rotate');
                const targetPresId = usePresentationStore.getState().selectedPresentationId || usePresentationStore.getState().activePresentationId;
                if (targetPresId) {
                    takeSnapshot(targetPresId).catch(console.error);
                }
            }
            const itemRect = document.getElementById(`item-${state.itemId}`)?.getBoundingClientRect();
            if (!itemRect) return;

            const centerX = itemRect.left + itemRect.width / 2;
            const centerY = itemRect.top + itemRect.height / 2;

            const updates = calculateRotation(state, e.clientX, e.clientY, centerX, centerY, e.shiftKey);
            if (updates) updateLocalItem(state.itemId, updates);
        } else if (state.type === 'pivot') {
            if (!state.hasMoved) {
                state.hasMoved = true;
                setDragActive(true);
                const targetPresId = usePresentationStore.getState().selectedPresentationId || usePresentationStore.getState().activePresentationId;
                if (targetPresId) {
                    takeSnapshot(targetPresId).catch(console.error);
                }
            }
            const updates = calculatePivot(state, deltaXPx, deltaYPx, rect.width, rect.height);
            if (updates) updateLocalItem(state.itemId, updates);
        }
    }, [getContainerRect, localItems, setLocalItems, setSelectedIds, customGuides, gridSnapPct, setDragActive, setDragActiveMode, takeSnapshot]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragState.current) return;
        latestMoveEventRef.current = e;

        if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(() => {
                rafIdRef.current = null;
                if (latestMoveEventRef.current) {
                    processMouseMove(latestMoveEventRef.current);
                }
            });
        }
    }, [processMouseMove]);

    const handleMouseUp = useCallback((e?: Event | React.MouseEvent) => {
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        const hasCoords = e && 'clientX' in e && typeof (e as unknown as MouseEvent).clientX === 'number';
        const finalEvent = hasCoords ? (e as unknown as MouseEvent) : latestMoveEventRef.current;
        if (finalEvent && dragState.current) {
            processMouseMove(finalEvent);
        }
        latestMoveEventRef.current = null;

        const state = dragState.current;
        if (state && state.hasMoved === true) {
            if (state.type === 'move') {
                const currentItem = localItemsRef.current.find(i => i.id === state.itemId);
                if (currentItem) {
                    const dx = currentItem.x - state.startItemX;
                    const dy = currentItem.y - state.startItemY;
                    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
                        getDefaultStore().set(lastDuplicateOffsetAtom, { dx, dy });
                    }
                }
            }
            updateCanvasItemsOrder(slideId, localItemsRef.current).catch(console.error);
            setPendingUpdate(true);
        }

        dragState.current = null;
        setActiveGuides([]);
        setDragActiveMode(null);
        setDragActive(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setRotateCursorAngle(null);
    }, [slideId, processMouseMove, updateCanvasItemsOrder, setPendingUpdate, setDragActive]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('pointerup', handleMouseUp);
        window.addEventListener('pointercancel', handleMouseUp);
        window.addEventListener('blur', handleMouseUp);
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('pointerup', handleMouseUp);
            window.removeEventListener('pointercancel', handleMouseUp);
            window.removeEventListener('blur', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    return {
        handleMouseDown,
        rotateCursorAngle,
        setRotateCursorAngle,
        activeGuides,
        dragActiveMode,
        selectedIds,
        setSelectedIds,
        editingId,
        setEditingId,
        tool,
        setTool,
    };
}
