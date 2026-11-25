import { useEffect, useState } from 'react';
import { ICanvasItem } from '@/core/types';
import { CanvasTool } from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { normalizePathItemBounds } from '../utils/createPathItem';

export interface UseCanvasShortcutsProps {
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
  setShowRulers: React.Dispatch<React.SetStateAction<boolean>>;
  handleZoomFit: () => void;
  handleZoomToSelection: () => void;
  handleFlipH: () => void;
  handleFlipV: () => void;
  handleDelete: () => void;
  handleCopyStyle: () => void;
  handlePasteStyle: () => void;
  handleDuplicate: () => Promise<void>;
  handleGroup: () => void;
  handleUngroup: () => void;
  handleToggleMask: () => void;
  handleToggleLock: () => void;
  handleToggleVisibility: () => void;
  handleBringForward: () => void;
  handleBringToFront: () => void;
  handleSendBackward: () => void;
  handleSendToBack: () => void;
}

export function useCanvasShortcuts({
  slideId,
  resolvedItems,
  selectedIds,
  setSelectedIds,
  editingId,
  setEditingId,
  setToolAt,
  canvasTool,
  setVectorEditingId,
  setShowRulers,
}: UseCanvasShortcutsProps) {
  const [isAltHeld, setIsAltHeld] = useState(false);
  const [isShiftHeld, setIsShiftHeld] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltHeld(true);
      if (e.key === 'Shift') setIsShiftHeld(true);

      const active = document.activeElement;
      const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.getAttribute('contenteditable') === 'true');
      if (isTyping) return;

      // Escape / Enter
      if (e.key === 'Escape' || e.key === 'Enter') {
        if (canvasTool === 'pen') {
          e.preventDefault();
          const activeItem = resolvedItems.find((i) => selectedIds.includes(i.id) && i.type === 'path');
          if (activeItem) {
            if (activeItem.path && activeItem.path.nodes.length < 2 && e.key === 'Escape') {
              usePresentationStore.getState().removeCanvasItem(slideId, [activeItem.id]);
              setSelectedIds([]);
            } else {
              const normalized = normalizePathItemBounds(activeItem);
              if (Object.keys(normalized).length > 0) {
                usePresentationStore.getState().updateCanvasItem(slideId, activeItem.id, normalized);
                usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
              }
            }
          }
          setToolAt('select');
          setVectorEditingId?.(null);
          return;
        }

        if (e.key === 'Escape') {
          if (editingId) {
            setEditingId(null);
            setToolAt('select');
          } else {
            setSelectedIds([]);
          }
          return;
        }
      }

      // Shift+R: Toggle Rulers (layout-independent)
      if (e.shiftKey && (e.code === 'KeyR' || e.key.toLowerCase() === 'r') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShowRulers((prev) => !prev);
        return;
      }
      // Note: Canvas manipulation shortcuts (Cmd+D, Cmd+G, Cmd+[/], Shift+H/V, Shift+1/2/0,
      // Delete/Backspace, Arrow Nudge, etc.) are centrally handled by useGlobalShortcuts +
      // executePresentationHotkeys with zone priority so they never double-fire or hijack timeline shortcuts.
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltHeld(false);
      if (e.key === 'Shift') setIsShiftHeld(false);
    };

    const handleWindowBlur = () => {
      setIsAltHeld(false);
      setIsShiftHeld(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [
    slideId, resolvedItems, selectedIds, editingId, canvasTool,
    setSelectedIds, setEditingId, setToolAt, setVectorEditingId,
    setShowRulers,
  ]);

  return {
    isAltHeld,
    isShiftHeld,
  };
}

