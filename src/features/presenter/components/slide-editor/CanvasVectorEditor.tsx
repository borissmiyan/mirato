import React, { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Check, Plus } from 'lucide-react';
import { ICanvasItem, ICanvasSlide, IVectorNode } from '@/core/types';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import {
  shapeItemToVectorNodes,
  getMirroredHandle,
  findClosestSegmentInPath,
  splitBezierSegment,
} from './renderers/vectorGeometry';
import { normalizePathItemBounds } from './utils/createPathItem';

interface CanvasVectorEditorProps {
  item: ICanvasItem;
  slideId: string;
  canvasScale: number;
  onDone: () => void;
}

type DragTarget =
  | { type: 'node'; nodeId: string }
  | { type: 'handleOut'; nodeId: string }
  | { type: 'handleIn'; nodeId: string };

/**
 * Interactive Figma-Grade Vector Path Editor.
 * Displays editable anchor vertices, cubic Bezier handles, mirror symmetry,
 * and Alt-key handle break. Double click toggles sharp/smooth nodes.
 */
export const CanvasVectorEditor: React.FC<CanvasVectorEditorProps> = memo(({
  item,
  slideId,
  canvasScale,
  onDone,
}) => {
  const safeScale = canvasScale > 0 ? canvasScale : 1;
  const counterScale = 1 / safeScale;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoverSplit, setHoverSplit] = useState<{ segmentIndex: number; t: number; point: { x: number; y: number } } | null>(null);
  const dragRef = useRef<{
    target: DragTarget;
    startX: number;
    startY: number;
    nodeInitial: IVectorNode;
    isAlt: boolean;
  } | null>(null);
  const rafRef = useRef<number | null>(null);

  const fallbackVector = useMemo(() => shapeItemToVectorNodes(item), [item]);
  const isAlreadyPath = item.type === 'path' && Boolean(item.path?.nodes && item.path.nodes.length > 0);
  const nodes = useMemo(() => {
    if (isAlreadyPath && item.path?.nodes) return item.path.nodes;
    return fallbackVector.nodes;
  }, [isAlreadyPath, item.path?.nodes, fallbackVector.nodes]);
  const isClosedPath = item.path?.isClosed ?? fallbackVector.isClosed;

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // Cleanup pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleDone = useCallback(() => {
    const pres = usePresentationStore.getState().selectedPresentation || usePresentationStore.getState().activePresentation;
    const slide = pres?.slides?.find((s) => s.id === slideId);
    const currentItem = (slide?.type === 'normal' ? (slide as ICanvasSlide).content?.canvasItems : undefined)
      ?.find((i) => i.id === item.id) || item;

    const normalized = normalizePathItemBounds(currentItem);
    if (Object.keys(normalized).length > 0) {
      usePresentationStore.getState().updateCanvasItem(slideId, item.id, normalized);
      usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
    }
    onDone();
  }, [slideId, item, onDone]);

  // Normalize path bounds if unmounted abruptly (e.g. click outside or tool switch)
  useEffect(() => {
    return () => {
      const pres = usePresentationStore.getState().selectedPresentation || usePresentationStore.getState().activePresentation;
      const slide = pres?.slides?.find((s) => s.id === slideId);
      const current = (slide?.type === 'normal' ? (slide as ICanvasSlide).content?.canvasItems : undefined)
        ?.find((i) => i.id === item.id);
      if (current) {
        const normalized = normalizePathItemBounds(current);
        if (Object.keys(normalized).length > 0) {
          usePresentationStore.getState().updateCanvasItem(slideId, current.id, normalized);
          usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
        }
      }
    };
  }, [slideId, item.id]);

  // Global keydown: Delete node, Enter/Esc to finish
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleDone();
        return;
      }

      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedNodeId) {
        if (nodes.length <= 2) return; // Maintain minimal valid segment
        e.preventDefault();
        const nextNodes = nodes.filter((n) => n.id !== selectedNodeId);
        usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
          type: 'path',
          path: {
            nodes: nextNodes,
            isClosed: isClosedPath,
          },
          shape: undefined,
        });
        usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
        setSelectedNodeId(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId, nodes, item, slideId, handleDone, isClosedPath]);

  const handlePointerDown = useCallback((
    e: React.PointerEvent,
    target: DragTarget,
    node: IVectorNode
  ) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (target.type === 'node') {
      setSelectedNodeId(node.id);
    }

    const itemEl = document.getElementById(`item-${item.id}`);
    const itemRect = itemEl ? itemEl.getBoundingClientRect() : null;
    const itemW = itemEl?.offsetWidth || itemRect?.width || 100;
    const itemH = itemEl?.offsetHeight || itemRect?.height || 100;
    const rotation = item.rotation || 0;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    dragRef.current = {
      target,
      startX: e.clientX,
      startY: e.clientY,
      nodeInitial: { ...node },
      isAlt: e.altKey,
    };

    const onPointerMove = (me: PointerEvent) => {
      if (!dragRef.current || !itemRect) return;

      const screenDx = me.clientX - dragRef.current.startX;
      const screenDy = me.clientY - dragRef.current.startY;
      const localDx = screenDx * cos + screenDy * sin;
      const localDy = -screenDx * sin + screenDy * cos;
      const dxPct = (localDx / itemW) * 100;
      const dyPct = (localDy / itemH) * 100;
      const initial = dragRef.current.nodeInitial;
      const isAlt = me.altKey || dragRef.current.isAlt;

      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!dragRef.current) return;

        const updatedNodes = nodes.map((n) => {
          if (n.id !== initial.id) return n;

          if (target.type === 'node') {
            const newX = Math.round((initial.x + dxPct) * 10) / 10;
            const newY = Math.round((initial.y + dyPct) * 10) / 10;
            const shiftX = newX - initial.x;
            const shiftY = newY - initial.y;

            return {
              ...n,
              x: newX,
              y: newY,
              handleIn: initial.handleIn
                ? { x: initial.handleIn.x + shiftX, y: initial.handleIn.y + shiftY }
                : undefined,
              handleOut: initial.handleOut
                ? { x: initial.handleOut.x + shiftX, y: initial.handleOut.y + shiftY }
                : undefined,
            };
          }

          if (target.type === 'handleOut') {
            const initH = initial.handleOut || { x: initial.x, y: initial.y };
            const newOut = {
              x: Math.round((initH.x + dxPct) * 10) / 10,
              y: Math.round((initH.y + dyPct) * 10) / 10,
            };
            const newIn = !isAlt
              ? getMirroredHandle(n.x, n.y, newOut.x, newOut.y)
              : n.handleIn;

            return {
              ...n,
              handleOut: newOut,
              handleIn: newIn,
              isCorner: false,
            };
          }

          if (target.type === 'handleIn') {
            const initH = initial.handleIn || { x: initial.x, y: initial.y };
            const newIn = {
              x: Math.round((initH.x + dxPct) * 10) / 10,
              y: Math.round((initH.y + dyPct) * 10) / 10,
            };
            const newOut = !isAlt
              ? getMirroredHandle(n.x, n.y, newIn.x, newIn.y)
              : n.handleOut;

            return {
              ...n,
              handleIn: newIn,
              handleOut: newOut,
              isCorner: false,
            };
          }

          return n;
        });

        usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
          type: 'path',
          path: {
            nodes: updatedNodes,
            isClosed: isClosedPath,
          },
          shape: undefined,
        });
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      dragRef.current = null;
      usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }, [nodes, item, slideId, isClosedPath]);

  // Double click node to toggle sharp corner vs smooth curve
  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    const updated = nodes.map((n) => {
      if (n.id !== nodeId) return n;
      if (n.isCorner || (!n.handleIn && !n.handleOut)) {
        // Switch to smooth: generate 10% horizontal handles
        return {
          ...n,
          isCorner: false,
          handleIn: { x: n.x - 10, y: n.y },
          handleOut: { x: n.x + 10, y: n.y },
        };
      }
      // Switch to corner: clear handles
      return {
        ...n,
        isCorner: true,
        handleIn: undefined,
        handleOut: undefined,
      };
    });

    usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
      type: 'path',
      path: {
        nodes: updated,
        isClosed: isClosedPath,
      },
      shape: undefined,
    });
    usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
  }, [nodes, item, slideId, isClosedPath]);

  const handleSvgPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      if (hoverSplit) setHoverSplit(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const itemEl = document.getElementById(`item-${item.id}`);
    const itemW = itemEl?.offsetWidth || rect.width;
    const itemH = itemEl?.offsetHeight || rect.height;
    const rotation = item.rotation || 0;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const diffX = e.clientX - centerX;
    const diffY = e.clientY - centerY;
    const localX = diffX * cos + diffY * sin;
    const localY = -diffX * sin + diffY * cos;

    const curX = (localX / itemW + 0.5) * 100;
    const curY = (localY / itemH + 0.5) * 100;
    const match = findClosestSegmentInPath({ x: curX, y: curY }, nodes, isClosedPath, 4.0);
    setHoverSplit(match);
  }, [nodes, isClosedPath, hoverSplit, item.id, item.rotation]);

  const handleInsertNode = useCallback((e: React.PointerEvent, split: { segmentIndex: number; t: number; point: { x: number; y: number } }) => {
    e.preventDefault();
    e.stopPropagation();

    const i = split.segmentIndex;
    const nextIdx = (i + 1) % nodes.length;
    const n1 = nodes[i];
    const n2 = nodes[nextIdx];
    if (!n1 || !n2) return;

    const { updatedN1, newNode, updatedN2 } = splitBezierSegment(n1, n2, split.t);
    const nextNodes = [...nodes];
    nextNodes[i] = updatedN1;
    if (nextIdx === 0 && isClosedPath) {
      nextNodes[nextNodes.length - 1] = updatedN1;
      nextNodes[0] = updatedN2;
      nextNodes.push(newNode);
    } else {
      nextNodes[nextIdx] = updatedN2;
      nextNodes.splice(i + 1, 0, newNode);
    }

    usePresentationStore.getState().updateCanvasItem(slideId, item.id, {
      type: 'path',
      path: {
        nodes: nextNodes,
        isClosed: isClosedPath,
      },
      shape: undefined,
    });
    usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
    setSelectedNodeId(newNode.id);
    setHoverSplit(null);
  }, [nodes, isClosedPath, slideId, item.id]);

  return (
    <div
      className="absolute inset-0 pointer-events-auto z-50 overflow-visible"
      onPointerMove={handleSvgPointerMove}
      onPointerLeave={() => setHoverSplit(null)}
    >
      {/* Floating Toolbar Badge for Vector Edit Mode */}
      <div
        className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-900 border border-accent/40 shadow-xl pointer-events-auto select-none"
        style={{ transform: `translateX(-50%) scale(${counterScale})`, transformOrigin: 'bottom center' }}
      >
        <span className="text-[11px] font-semibold text-stone-200">Режим вектора</span>
        <button
          onClick={handleDone}
          className="flex items-center gap-1 ml-1.5 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          title="Готово (Enter / Esc)"
        >
          <Check className="w-3 h-3" />
          <span>Готово</span>
        </button>
      </div>

      {/* Tangent Handle Lines & Heads for Selected Node */}
      {selectedNode && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          {selectedNode.handleIn && (
            <line
              x1={selectedNode.x}
              y1={selectedNode.y}
              x2={selectedNode.handleIn.x}
              y2={selectedNode.handleIn.y}
              stroke="var(--color-accent, #3b82f6)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {selectedNode.handleOut && (
            <line
              x1={selectedNode.x}
              y1={selectedNode.y}
              x2={selectedNode.handleOut.x}
              y2={selectedNode.handleOut.y}
              stroke="var(--color-accent, #3b82f6)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      )}

      {/* Tangent Handle Controls */}
      {selectedNode && selectedNode.handleIn && (
        <div
          className="absolute w-2.5 h-2.5 rounded-full bg-white border border-accent ring-1 ring-black/40 pointer-events-auto cursor-pointer hover:scale-125 transition-transform"
          style={{
            left: `${selectedNode.handleIn.x}%`,
            top: `${selectedNode.handleIn.y}%`,
            transform: `translate(-50%, -50%) scale(${counterScale})`,
          }}
          onPointerDown={(e) => handlePointerDown(e, { type: 'handleIn', nodeId: selectedNode.id }, selectedNode)}
          title="Handle In (Alt to break symmetry)"
        />
      )}
      {selectedNode && selectedNode.handleOut && (
        <div
          className="absolute w-2.5 h-2.5 rounded-full bg-white border border-accent ring-1 ring-black/40 pointer-events-auto cursor-pointer hover:scale-125 transition-transform"
          style={{
            left: `${selectedNode.handleOut.x}%`,
            top: `${selectedNode.handleOut.y}%`,
            transform: `translate(-50%, -50%) scale(${counterScale})`,
          }}
          onPointerDown={(e) => handlePointerDown(e, { type: 'handleOut', nodeId: selectedNode.id }, selectedNode)}
          title="Handle Out (Alt to break symmetry)"
        />
      )}

      {/* Hover Curve Split Point Handle (+) */}
      {hoverSplit && (
        <div
          className="absolute w-4 h-4 rounded-full bg-accent text-accent-foreground flex items-center justify-center pointer-events-auto cursor-copy shadow-md hover:scale-125 transition-transform"
          style={{
            left: `${hoverSplit.point.x}%`,
            top: `${hoverSplit.point.y}%`,
            transform: `translate(-50%, -50%) scale(${counterScale})`,
          }}
          onPointerDown={(e) => handleInsertNode(e, hoverSplit)}
          title="Вставить опорную точку (Click to split segment)"
        >
          <Plus className="w-2.5 h-2.5 stroke-[3]" />
        </div>
      )}

      {/* Anchor Nodes */}
      {nodes.map((node) => {
        const isSelected = selectedNodeId === node.id;
        const isSharp = node.isCorner ?? (!node.handleIn && !node.handleOut);

        return (
          <div
            key={node.id}
            className={`absolute pointer-events-auto cursor-pointer transition-transform hover:scale-125 ${
              isSharp ? 'w-2.5 h-2.5 rounded-xs' : 'w-3 h-3 rounded-full'
            } ${
              isSelected
                ? 'bg-accent border-2 border-white ring-2 ring-black/50 shadow-md'
                : 'bg-white border-2 border-accent ring-1 ring-black/40 shadow-xs'
            }`}
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              transform: `translate(-50%, -50%) scale(${counterScale})`,
            }}
            onPointerDown={(e) => handlePointerDown(e, { type: 'node', nodeId: node.id }, node)}
            onDoubleClick={() => handleNodeDoubleClick(node.id)}
            title="Anchor Node (Double-click to toggle smooth/corner, Drag to move, Delete to remove)"
          />
        );
      })}
    </div>
  );
});

CanvasVectorEditor.displayName = 'CanvasVectorEditor';

