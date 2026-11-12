import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
    slideEditorDragActiveAtom,
    slideEditorPendingUpdateAtom,
    slidePreviewHoveredAtom,
    latestInteractionAreaAtom,
    canvasToolAtom,
    canvasOffsetAtom,
    canvasSafeZonesAtom,
    canvasGridAtom,
    canvasEffectiveScaleAtom,
    canvasResolutionAtom,
    selectedCanvasItemIdsAtom,
    editingCanvasItemIdAtom,
    vectorEditingItemIdAtom,
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ICanvasItem, ICanvasSlide } from '@/core/types';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import CanvasItemView from './CanvasItemView';
import { useCanvasInteraction } from '@/features/presenter/hooks/useCanvasInteraction';
import { RotateCursor } from './CanvasHandles';
import { CanvasSelectionFrame } from './CanvasSelectionFrame';
import { CanvasItemControls } from './CanvasItemControls';
import { CanvasGradientHandles } from './CanvasGradientHandles';
import { CanvasVectorEditor } from './CanvasVectorEditor';
import { CanvasSmartGuides } from './CanvasSmartGuides';
import { CanvasMarqueeBox, IMarqueeRect } from './CanvasMarqueeBox';
import { CanvasDistanceGuides } from './CanvasDistanceGuides';
import { CanvasHUD } from './CanvasHUD';
import { CanvasEqualSpacingGuides } from './CanvasEqualSpacingGuides';
import { CanvasMultiSelectionBox } from './CanvasMultiSelectionBox';
import { CanvasFloatingToolbar } from './CanvasFloatingToolbar';
import { CanvasSmartSelection } from './CanvasSmartSelection';
import { CanvasContextMenu } from './CanvasContextMenu';
import { CanvasSafeZones } from './CanvasSafeZones';
import { CanvasGrid } from './CanvasGrid';
import { CanvasRulers } from './CanvasRulers';
import { useCanvasActions } from './hooks/useCanvasActions';
import { useCanvasPanAndMarquee } from './hooks/useCanvasPanAndMarquee';
import { checkItemIntersectsBox } from '@/core/utils/canvasDistribution';
import { detectEqualSpacing } from '@/core/utils/canvasEqualSpacing';
import { calculateAutoFit } from '@/core/utils/canvasAutoFit';
import { useCanvasDrawing } from './hooks/useCanvasDrawing';
import { useCanvasMediaDrop } from './hooks/useCanvasMediaDrop';
import { CanvasDrawingPreview } from './CanvasDrawingPreview';
import { getCanvasItemStyle } from './utils/itemStyle';
import { MaskGroupRenderer } from './renderers/MaskGroupRenderer';
import { BooleanGroupRenderer } from './renderers/BooleanGroupRenderer';
import { partitionMaskedItems } from '@/core/utils/canvasMasks';
import { partitionBooleanGroups, groupAsBooleanOperation, IBooleanOperation } from '@/core/utils/canvasBooleanGroups';
import { tidyUpItems } from '@/core/utils/tidyUpUtils';
import { isEqual } from '@/core/utils/isEqual';

interface SlideCanvasProps {
    slideId: string;
    canvasItems: ICanvasItem[];
}

/**
 * Canvas overlay on the slide display for drag/resize of positioned items.
 * Uses percentage-based coordinates to maintain consistency across scales.
 */
const SlideCanvas: React.FC<SlideCanvasProps> = ({ slideId, canvasItems }) => {
    const { t } = useTranslation();
    const removeCanvasItem = usePresentationStore(s => s.removeCanvasItem);
    const [, setSlidePreviewHovered] = useAtom(slidePreviewHoveredAtom) as [boolean, (v: boolean) => void];
    const setLatestArea = useSetAtom(latestInteractionAreaAtom);
    const [canvasTool, setToolAt] = useAtom(canvasToolAtom);
    const [offset, setOffset] = useAtom(canvasOffsetAtom);

    // Targeted slide-scoped selector: only triggers re-renders when this specific slide's items change
    const storeCanvasItems = usePresentationStore(
        useCallback(s => {
            const pres = s.selectedPresentation || s.activePresentation;
            const slide = pres?.slides?.find(it => it.id === slideId);
            return slide?.type === 'normal' ? (slide as ICanvasSlide).content?.canvasItems : undefined;
        }, [slideId])
    );

    // Use store items as the primary source; fall back to prop for initial render
    const resolvedItems = storeCanvasItems !== undefined ? storeCanvasItems : canvasItems;

    // Sync props to local state when not dragging
    const [localItems, setLocalItems] = useState<ICanvasItem[]>(resolvedItems);
    const dragActive = useAtomValue(slideEditorDragActiveAtom);
    const [pendingUpdate, setPendingUpdate] = useAtom(slideEditorPendingUpdateAtom);

    useEffect(() => {
        if (isEqual(localItems, resolvedItems)) {
            return;
        }

        // Sync immediately if an item was added or removed
        if (resolvedItems.length !== localItems.length) {
            setLocalItems(resolvedItems);
            setPendingUpdate(false);
            return;
        }

        if (!dragActive && !pendingUpdate) {
            setLocalItems(resolvedItems);
        } else if (pendingUpdate) {
            const timer = setTimeout(() => setPendingUpdate(false), 150);
            return () => clearTimeout(timer);
        }
    }, [resolvedItems, dragActive, pendingUpdate, setPendingUpdate, localItems]);

    const containerRef = useRef<HTMLDivElement>(null);
    const getContainerRect = useCallback(() => {
        return containerRef.current?.getBoundingClientRect() || { left: 0, top: 0, width: 1, height: 1 };
    }, []);

    const { isShiftDropActive, handleDragOver, handleDragLeave, handleDrop } = useCanvasMediaDrop({ slideId, getContainerRect });

    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
    const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

    const [selectedIds, setSelectedIds] = useAtom(selectedCanvasItemIdsAtom);
    const [editingId, setEditingId] = useAtom(editingCanvasItemIdAtom) as [string | null, (v: string | null) => void];
    const [vectorEditingId, setVectorEditingId] = useAtom(vectorEditingItemIdAtom);
    const showSafeZones = useAtomValue(canvasSafeZonesAtom);
    const showGrid = useAtomValue(canvasGridAtom);
    const canvasScale = useAtomValue(canvasEffectiveScaleAtom);
    const canvasResolution = useAtomValue(canvasResolutionAtom);

    const actions = useCanvasActions({
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
    });

    const equalSpacingMatches = React.useMemo(() => {
        if (!dragActive || selectedIds.length !== 1) return [];
        const dragged = resolvedItems.find(i => i.id === selectedIds[0]);
        if (!dragged) return [];
        const others = resolvedItems.filter(i => i.id !== dragged.id && i.visible !== false);
        return detectEqualSpacing(dragged, others);
    }, [dragActive, selectedIds, resolvedItems]);

    const {
        handleMouseDown,
        rotateCursorAngle,
        setRotateCursorAngle,
        activeGuides,
        dragActiveMode,
    } = useCanvasInteraction(slideId, localItems, setLocalItems, getContainerRect, actions.customGuides, showGrid ? 2 : undefined);

    const handleDoubleClick = useCallback((e: React.MouseEvent, item: ICanvasItem) => {
        if (item.locked) return;
        if (selectedIds.length > 1 && item.groupId) {
            e.stopPropagation();
            setSelectedIds([item.id]);
            return;
        }
        if (item.type === 'text') {
            e.stopPropagation();
            setEditingId(item.id);
            setSelectedIds([item.id]);
            setToolAt('text');
            return;
        }
        if (item.type === 'shape' || item.type === 'stroke' || item.type === 'path') {
            e.stopPropagation();
            setVectorEditingId(item.id);
            setSelectedIds([item.id]);
            return;
        }
    }, [selectedIds, setEditingId, setVectorEditingId, setSelectedIds, setToolAt]);

    const handleHandleDoubleClick = useCallback((pos: string, item: ICanvasItem) => {
        const el = document.getElementById(`item-${item.id}`);
        const rect = getContainerRect();
        const updates = calculateAutoFit(pos, item, el?.scrollWidth || 0, el?.scrollHeight || 0, rect.width, rect.height);
        if (updates) {
            usePresentationStore.getState().updateCanvasItem(slideId, item.id, updates);
        }
    }, [slideId, getContainerRect]);

    const handleTextUpdate = useCallback((itemId: string, newContent: string) => {
        usePresentationStore.getState().updateCanvasItem(slideId, itemId, {
            text: {
                ...resolvedItems.find(i => i.id === itemId)?.text!,
                content: newContent
            }
        });
    }, [slideId, resolvedItems]);

    const handleTextSave = useCallback(() => setEditingId(null), [setEditingId]);
    const handleCancel = useCallback(() => { setEditingId(null); setToolAt('select'); }, [setEditingId, setToolAt]);

    // During drag and pending update, use localItems (optimistic). Otherwise, use store items directly (no useEffect delay).
    const renderItems = (dragActive || pendingUpdate) ? localItems : resolvedItems;
    const sortedItems = [...renderItems].sort((a, b) => a.zIndex - b.zIndex);
    const { regularItems: unmaskedItems, maskGroups } = useMemo(() => partitionMaskedItems(sortedItems), [sortedItems]);
    const { regularItems, booleanGroups } = useMemo(() => partitionBooleanGroups(unmaskedItems), [unmaskedItems]);

    const {
        marqueeBox,
        marqueeMovedRef,
        panDownRef,
        isSpaceHeld,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
    } = useCanvasPanAndMarquee({
        canvasTool,
        offset,
        setOffset,
        containerRef,
        getContainerRect,
        sortedItems,
        setSelectedIds,
        setLatestArea,
    });

    const {
        isDrawingTool,
        drawingPreview,
        handleDrawingPointerDown,
        handleDrawingPointerMove,
        handleDrawingPointerUp,
    } = useCanvasDrawing({
        slideId,
        canvasTool,
        setCanvasTool: setToolAt,
        getContainerRect,
        setSelectedIds,
        vectorEditingId,
        setVectorEditingId,
        resolvedItems,
    });

    const onCanvasPointerDown = (e: React.PointerEvent) => isDrawingTool ? handleDrawingPointerDown(e) : handlePointerDown(e);
    const onCanvasPointerMove = (e: React.PointerEvent) => isDrawingTool ? handleDrawingPointerMove(e) : handlePointerMove(e);
    const onCanvasPointerUp = (e: React.PointerEvent) => isDrawingTool ? handleDrawingPointerUp(e) : handlePointerUp(e);

    const handleBooleanOp = useCallback((op: IBooleanOperation) => {
        if (selectedIds.length < 2) return;
        const updated = groupAsBooleanOperation(renderItems, selectedIds, op);
        usePresentationStore.getState().updateCanvasItemsOrder(slideId, updated).catch(console.error);
    }, [selectedIds, renderItems, slideId]);

    const handleTidyUp = useCallback(() => {
        const selected = renderItems.filter(i => selectedIds.includes(i.id));
        if (selected.length < 2) return;
        const tidied = tidyUpItems(selected);
        const updates = tidied.map(item => ({ id: item.id, updates: { x: item.x, y: item.y } }));
        if (updates.length > 0) {
            usePresentationStore.getState().updateCanvasItems(slideId, updates).catch(console.error);
        }
    }, [selectedIds, renderItems, slideId]);

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (e.target === containerRef.current && canvasTool !== 'pan') {
            if (marqueeMovedRef.current) {
                marqueeMovedRef.current = false;
                return;
            }
            if (isDrawingTool) return;
            setSelectedIds([]);
            setEditingId(null);
            setVectorEditingId(null);
            setToolAt('select');
        }
    };

    const isHymn = usePresentationStore(s => (s.selectedPresentation || s.activePresentation)?.metadata?.isHymnLibraryItem === true);
    const getItemStyle = getCanvasItemStyle;

    return (
        <div
            ref={containerRef}
            id="slide-canvas-container"
            className={cn(
                "absolute inset-0 z-20",
                isHymn ? "pointer-events-none" : ((canvasTool === 'pan' || isSpaceHeld) ? (panDownRef.current ? "cursor-grabbing" : "cursor-grab") : (isDrawingTool ? "cursor-crosshair" : (canvasTool === 'text' ? "cursor-text" : "cursor-default"))),
                isShiftDropActive && "ring-2 ring-accent ring-inset shadow-[inset_0_0_24px_rgba(var(--accent-rgb,147,51,234),0.3)] bg-accent/5 transition-all duration-150"
            )}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onClick={handleCanvasClick}
            onContextMenu={(e) => {
                if (e.target === containerRef.current) {
                    e.preventDefault();
                    setContextMenuPos({ x: e.clientX, y: e.clientY });
                }
            }}
            onMouseEnter={() => setSlidePreviewHovered(true)}
            onMouseLeave={() => setSlidePreviewHovered(false)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {showGrid && <CanvasGrid />}
            {isShiftDropActive && (
                <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/90 border border-accent/50 shadow-2xl backdrop-blur-md text-white text-[11px] font-semibold">
                        <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                        {t('drop_as_background', 'Установить как фон слайда')}
                    </div>
                </div>
            )}
            {/* СЛОЙ 1: Визуальный контент слайда — строго обрезан рамкой 16:9 (overflow-hidden) */}
            <div
                className="absolute inset-0 overflow-hidden pointer-events-none z-10"
                style={{ imageRendering: canvasResolution === 'quarter' ? 'pixelated' : 'auto' }}
            >
                <MaskGroupRenderer maskGroups={maskGroups} />
                <BooleanGroupRenderer booleanGroups={booleanGroups} />
                {regularItems.map((item: ICanvasItem) => {
                    if (item.visible === false) return null;
                    const isAutoW = item.type === 'text' && item.text?.resizingMode === 'auto-width';
                    const isAutoH = item.type === 'text' && item.text?.resizingMode === 'auto-height';
                    const isEditing = editingId === item.id;

                    return (
                        <div
                            key={`visual-${item.id}`}
                            id={`visual-${item.id}`}
                            className={cn("absolute overflow-hidden", isEditing && "opacity-0")}
                            style={getItemStyle(item, isAutoW, isAutoH, item.zIndex)}
                        >
                            <CanvasItemView item={item} isEditing={false} />
                        </div>
                    );
                })}
            </div>

            {/* СЛОЙ 2: Оверлей редактора — хендлеры, рамки, тулбар (overflow-visible, выходят за слайд) */}
            <div className="absolute inset-0 overflow-visible pointer-events-none z-20">
                {sortedItems.map((item: ICanvasItem) => {
                    if (item.visible === false) return null;
                    const isSelected = selectedIds.includes(item.id);
                    const isEditing = editingId === item.id;
                    const isAutoWidth = item.type === 'text' && item.text?.resizingMode === 'auto-width';
                    const isAutoHeight = item.type === 'text' && item.text?.resizingMode === 'auto-height';

                    return (
                        <div
                            key={item.id}
                            id={`item-${item.id}`}
                            className={cn(
                                "absolute overflow-visible pointer-events-auto",
                                (item.locked || canvasTool === 'pan') && "pointer-events-none opacity-60",
                                isEditing && "z-50"
                            )}
                            style={{
                                ...getItemStyle(item, isAutoWidth, isAutoHeight, isEditing ? 1000 : item.zIndex),
                                cursor: item.locked ? 'default' : (isEditing ? 'text' : (canvasTool === 'text' && item.type === 'text' ? 'text' : 'default')),
                            }}
                            onPointerEnter={() => !dragActive && setHoveredItemId(item.id)}
                            onPointerLeave={() => setHoveredItemId(prev => prev === item.id ? null : prev)}
                            onMouseDown={(e) => handleMouseDown(e, item, 'move')}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!selectedIds.includes(item.id)) {
                                    setSelectedIds([item.id]);
                                }
                                setContextMenuPos({ x: e.clientX, y: e.clientY });
                            }}
                            onDoubleClick={(e) => handleDoubleClick(e, item)}
                            onDragStart={(e) => e.preventDefault()}
                        >
                            <CanvasSelectionFrame
                                isSelected={isSelected}
                                isEditing={isEditing}
                                isHovered={!actions.isAltHeld && hoveredItemId === item.id}
                                borderRadius={item.borderRadius}
                                canvasScale={canvasScale}
                                itemScale={item.scale || 1}
                                isMultiSelected={selectedIds.length > 1 && isSelected}
                            />

                            {/* Инлайн-редактор текста при двойном клике */}
                            {isEditing && (
                                <CanvasItemView
                                    item={item}
                                    isEditing={true}
                                    onSave={handleTextSave}
                                    onInput={handleTextUpdate}
                                    onCancel={handleCancel}
                                />
                            )}

                            {isSelected && !item.locked && !isEditing && vectorEditingId === item.id && canvasTool !== 'pen' && (
                                <CanvasVectorEditor
                                    item={item}
                                    slideId={slideId}
                                    canvasScale={canvasScale}
                                    onDone={() => setVectorEditingId(null)}
                                />
                            )}

                            {isSelected && !item.locked && !isEditing && vectorEditingId !== item.id && selectedIds.length === 1 && (
                                <>
                                    <CanvasItemControls
                                        item={item} slideId={slideId} canvasScale={canvasScale}
                                        dragActive={dragActive} dragActiveMode={dragActiveMode} isAltHeld={actions.isAltHeld}
                                        onResizeStart={(e, pos) => handleMouseDown(e, item, 'resize', pos)}
                                        onRotateStart={(e, pos) => handleMouseDown(e, item, 'rotate', pos)}
                                        onRotateHover={setRotateCursorAngle} onPivotStart={(e) => handleMouseDown(e, item, 'pivot')}
                                        onDoubleClickHandle={(pos) => handleHandleDoubleClick(pos, item)}
                                    />
                                    {!dragActive && <CanvasGradientHandles item={item} slideId={slideId} canvasScale={canvasScale} />}
                                </>
                            )}
                        </div>
                    );
                })}

                {/* Unified Multi-Selection Bounding Box & Floating Toolbar */}
                {selectedIds.length > 1 && (
                    <>
                        <CanvasMultiSelectionBox
                            selectedItems={renderItems.filter(i => selectedIds.includes(i.id))}
                            slideId={slideId} getContainerRect={getContainerRect}
                            canvasScale={canvasScale} dragActive={dragActive} dragActiveMode={dragActiveMode}
                            isAltHeld={actions.isAltHeld}
                        />
                        <CanvasSmartSelection
                            selectedItems={renderItems.filter(i => selectedIds.includes(i.id))}
                            slideId={slideId}
                            canvasScale={canvasScale}
                        />
                        {!actions.isAltHeld && (
                            <CanvasFloatingToolbar
                                selectedItems={renderItems.filter(i => selectedIds.includes(i.id))}
                                onAlign={actions.handleAlign} onDistribute={actions.handleDistribute}
                                onFlipH={actions.handleFlipH} onFlipV={actions.handleFlipV}
                                onGroup={actions.handleGroup} onUngroup={actions.handleUngroup}
                                onToggleMask={actions.handleToggleMask}
                                onBooleanOp={handleBooleanOp}
                                onTidyUp={handleTidyUp}
                                canvasScale={canvasScale}
                            />
                        )}
                    </>
                )}

                <CanvasSmartGuides guides={activeGuides} />
                <CanvasEqualSpacingGuides matches={equalSpacingMatches} canvasScale={canvasScale} />
                <CanvasMarqueeBox box={marqueeBox} />
                <CanvasDrawingPreview preview={drawingPreview} />

                {/* Alt/Option Distance Measurement Guides */}
                <CanvasDistanceGuides
                    isActive={actions.isAltHeld && selectedIds.length >= 1 && !dragActive}
                    selectedItems={renderItems.filter(i => selectedIds.includes(i.id))}
                    targetItem={hoveredItemId ? resolvedItems.find(i => i.id === hoveredItemId) || null : null}
                    otherItems={resolvedItems}
                    canvasScale={canvasScale}
                />

                {/* Live Standardized Canvas HUD (Move, Resize, Rotate) — Cursor Follower */}
                {dragActive && dragActiveMode && (
                    <CanvasHUD
                        selectedItems={renderItems.filter(i => selectedIds.includes(i.id))}
                        activeMode={dragActiveMode}
                    />
                )}
            </div>

            {/* TV & Projector Safe Zones (Action Safe 95%, Title Safe 90%) */}
            {showSafeZones && <CanvasSafeZones />}

            {/* Rulers and Custom User Guides */}
            <CanvasRulers
                isVisible={actions.showRulers} customGuides={actions.customGuides}
                onAddGuide={actions.handleAddGuide} onUpdateGuide={actions.handleUpdateGuide}
                onRemoveGuide={actions.handleRemoveGuide} getContainerRect={getContainerRect}
            />

            {rotateCursorAngle !== null && <RotateCursor angle={rotateCursorAngle} />}

            {/* Right-click Context Menu */}
            {contextMenuPos && (
                <CanvasContextMenu
                    x={contextMenuPos.x} y={contextMenuPos.y} onClose={() => setContextMenuPos(null)}
                    selectedIds={selectedIds} canvasItems={resolvedItems}
                    canPasteStyle={actions.canPasteStyle} {...actions.contextMenuHandlers}
                />
            )}
        </div>
    );
};

export default SlideCanvas;
