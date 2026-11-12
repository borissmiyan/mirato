import { useEffect, useState, useRef } from 'react';
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
}: UseCanvasShortcutsProps) {
  const [isAltHeld, setIsAltHeld] = useState(false);
  const [isShiftHeld, setIsShiftHeld] = useState(false);
  const nudgeTimerRef = useRef<NodeJS.Timeout | null>(null);

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

      // Shift+R: Toggle Rulers
      if (e.shiftKey && e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowRulers((prev) => !prev);
        return;
      }

      // Shift+1: Zoom to Fit
      if (e.shiftKey && (e.key === '!' || e.key === '1' || e.code === 'Digit1') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleZoomFit();
        return;
      }

      // Shift+2: Zoom to Selection
      if (e.shiftKey && (e.key === '@' || e.key === '"' || e.key === '2' || e.code === 'Digit2') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleZoomToSelection();
        return;
      }

      // Shift+0: Zoom 100%
      if (e.shiftKey && (e.key === '0' || e.code === 'Digit0') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleZoomFit();
        return;
      }

      if (selectedIds.length === 0) return;

      // Flip Horizontal: Shift+H
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleFlipH();
        return;
      }

      // Flip Vertical: Shift+V
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handleFlipV();
        return;
      }

      const isMacCmd = e.metaKey || e.ctrlKey;

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
        return;
      }

      // Copy Style: Cmd+Alt+C
      if (isMacCmd && e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopyStyle();
        return;
      }

      // Paste Style: Cmd+Alt+V
      if (isMacCmd && e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePasteStyle();
        return;
      }

      // Duplicate: Cmd+D
      if (isMacCmd && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicate();
        return;
      }

      // Group: Cmd+G / Ungroup: Cmd+Shift+G
      if (isMacCmd && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) handleUngroup(); else handleGroup();
        return;
      }

      // Toggle Mask: Ctrl+Cmd+M
      if (isMacCmd && (e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleToggleMask();
        return;
      }

      // Lock / Unlock: Cmd+Shift+L
      if (isMacCmd && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleToggleLock();
        return;
      }

      // Hide / Show: Cmd+Shift+H
      if (isMacCmd && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleToggleVisibility();
        return;
      }

      // Bring to Front / Bring Forward
      if (isMacCmd && (e.key === ']' || e.code === 'BracketRight')) {
        e.preventDefault();
        if (e.altKey || e.shiftKey) handleBringToFront(); else handleBringForward();
        return;
      }

      // Send to Back / Send Backward
      if (isMacCmd && (e.key === '[' || e.code === 'BracketLeft')) {
        e.preventDefault();
        if (e.altKey || e.shiftKey) handleSendToBack(); else handleSendBackward();
        return;
      }

      // Arrow Nudge
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;

        if (dx !== 0 || dy !== 0) {
          for (const id of selectedIds) {
            const cur = resolvedItems.find((i) => i.id === id);
            if (cur && !cur.locked) {
              usePresentationStore.getState().updateCanvasItem(slideId, id, {
                x: Math.round((cur.x + dx) * 10) / 10,
                y: Math.round((cur.y + dy) * 10) / 10,
              });
            }
          }
          if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
          nudgeTimerRef.current = setTimeout(() => {
            usePresentationStore.getState().takeSnapshot(slideId).catch(console.error);
            nudgeTimerRef.current = null;
          }, 350);
        }
      }
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
      if (nudgeTimerRef.current) {
        clearTimeout(nudgeTimerRef.current);
        nudgeTimerRef.current = null;
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [
    slideId, resolvedItems, selectedIds, editingId, canvasTool,
    setSelectedIds, setEditingId, setToolAt, setVectorEditingId,
    setShowRulers, handleZoomFit, handleZoomToSelection, handleFlipH,
    handleFlipV, handleDelete, handleCopyStyle, handlePasteStyle,
    handleDuplicate, handleGroup, handleUngroup, handleToggleMask,
    handleToggleLock, handleToggleVisibility, handleBringForward,
    handleBringToFront, handleSendBackward, handleSendToBack,
  ]);

  return {
    isAltHeld,
    isShiftHeld,
  };
}

