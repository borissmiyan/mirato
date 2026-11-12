import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import {
  selectedCanvasItemIdsAtom,
  editingCanvasItemIdAtom,
  slideDesignPanelOpenAtom,
  slideEditorDragActiveAtom,
  slideEditorPendingUpdateAtom,
  slideDesignHoveredAtom,
  slideDesignTabAtom,
  selectedTransitionSlideIdAtom
} from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useShallow } from 'zustand/react/shallow';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore } from '@/core/store/modalStore';
import {
  ImageIcon, Layers, Clock, Palette, Music,
  ArrowRightLeft, Film
} from 'lucide-react';
import { ICanvasItem, IStyleLayer, ICanvasSlide, IVideoSlide } from '@/core/types';
import type { TFunction } from 'i18next';
import { getUniqueSelectionStyles, calculateStyleUpdates } from '../utils/styleExtraction';
import { toast } from '@/core/utils/toast';
import {
  KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove, sortableKeyboardCoordinates
} from '@dnd-kit/sortable';

import {
  TimerTabContent, AudioTabContent, TransitionTabContent, VideoTabContent,
} from './slide-properties';
import { SlideDesignTabBar, PanelTab, ITabDefinition } from './slide-properties/SlideDesignTabBar';
import { SlideDesignLayersTab } from './slide-properties/SlideDesignLayersTab';
import { SlideDesignPropertiesTab } from './slide-properties/SlideDesignPropertiesTab';
import { SlideDesignBackgroundTab } from './slide-properties/SlideDesignBackgroundTab';

const getAlwaysTabs = (t: TFunction): ITabDefinition[] => [
  { id: 'properties', icon: Palette, title: t('properties', { defaultValue: 'Properties' }) },
  { id: 'background', icon: ImageIcon, title: t('background', { defaultValue: 'Background' }) },
  { id: 'layers', icon: Layers, title: t('layers', { defaultValue: 'Layers' }) },
];

const SlideDesignPanel: React.FC = () => {
  const { t } = useTranslation();
  const [panelOpen, setPanelOpen] = useAtom(slideDesignPanelOpenAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedCanvasItemIdsAtom);
  const selectedItemId = selectedIds[selectedIds.length - 1] || null;
  const [, setEditingId] = useAtom(editingCanvasItemIdAtom) as [string | null, (v: string | null) => void];
  const [activeTab, setActiveTab] = useAtom(slideDesignTabAtom);
  const selectedTransId = useAtomValue(selectedTransitionSlideIdAtom);
  const setSelectedTransId = useSetAtom(selectedTransitionSlideIdAtom);
  const [dragActive, setDragActive] = useAtom(slideEditorDragActiveAtom);
  const [pendingUpdate, setPendingUpdate] = useAtom(slideEditorPendingUpdateAtom);
  const openModal = useModalStore(s => s.openModal);

  const {
    selectedPresentationId, previewSlideId, updateSlideBackground,
    updateCanvasItem, batchUpdateCanvasItems,
    updateCanvasItemsOrder, removeCanvasItem, 
    selectedAudioScopeId, selectAudioScope, selectedPresentation,
    updateAudioScope, removeAudioScope, applyBackgroundToAll, updateTimerSettings,
    updateSlideTransition, triggerTransitionPreview, updatePresentationEndTransition,
    activePresentationId, updateVideoSettings, takeSnapshot,
  } = usePresentationStore(
    useShallow(s => ({
      selectedPresentationId: s.selectedPresentationId,
      previewSlideId: s.previewSlideId,
      updateSlideBackground: s.updateSlideBackground,
      updateCanvasItem: s.updateCanvasItem,
      batchUpdateCanvasItems: s.updateCanvasItems,
      updateCanvasItemsOrder: s.updateCanvasItemsOrder,
      removeCanvasItem: s.removeCanvasItem,
      selectedAudioScopeId: s.selectedAudioScopeId,
      selectAudioScope: s.selectAudioScope,
      selectedPresentation: s.selectedPresentation,
      updateAudioScope: s.updateAudioScope,
      removeAudioScope: s.removeAudioScope,
      applyBackgroundToAll: s.applyBackgroundToAll,
      updateTimerSettings: s.updateTimerSettings,
      updateSlideTransition: s.updateSlideTransition,
      triggerTransitionPreview: s.triggerTransitionPreview,
      updatePresentationEndTransition: s.updatePresentationEndTransition,
      activePresentationId: s.activePresentationId,
      updateVideoSettings: s.updateVideoSettings,
      takeSnapshot: s.takeSnapshot,
    }))
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ─── Data ───
  const dbPresentation = useLiveQuery(
    () => selectedPresentationId ? db.presentationFiles.get(selectedPresentationId) : undefined,
    [selectedPresentationId]
  );
  const presentation = selectedPresentation || dbPresentation;

  const liveTemplates = useLiveQuery(() => db.templates.toArray());
  const allTemplates = useMemo(() => liveTemplates || [], [liveTemplates]);
  const tmplMap = useMemo(() => new Map(allTemplates.map(item => [item.id, item])), [allTemplates]);

  const selectedSlide = useMemo(
    () => presentation?.slides?.find(s => s.id === previewSlideId),
    [presentation, previewSlideId]
  );
  const template = selectedSlide ? tmplMap.get(selectedSlide.templateId) : undefined;
  const slideBg = selectedSlide?.type === 'normal'
    ? (selectedSlide as ICanvasSlide).backgroundOverride || template?.background
    : template?.background;
  const dbCanvasItems = selectedSlide?.type === 'normal'
    ? (selectedSlide as ICanvasSlide).content?.canvasItems
    : undefined;

  const [localItems, setLocalItems] = useState<ICanvasItem[]>([]);

  useEffect(() => {
    const items = dbCanvasItems || [];
    if (items.length !== localItems.length) {
      setLocalItems(items);
      setPendingUpdate(false);
      return;
    }

    if (!dragActive && !pendingUpdate) {
      setLocalItems(items);
    } else if (pendingUpdate) {
      const timer = setTimeout(() => setPendingUpdate(false), 150);
      return () => clearTimeout(timer);
    }
  }, [dbCanvasItems, dragActive, pendingUpdate, setPendingUpdate, localItems.length]);

  // ─── Audio scopes ───
  const liveAudioScopes = useLiveQuery(
    () => activePresentationId ? db.audioScopes.where('presentationId').equals(activePresentationId).toArray() : [],
    [activePresentationId]
  );
  const dbAudioScopes = useMemo(() => liveAudioScopes || [], [liveAudioScopes]);

  const scope = useMemo(() => {
    if (!selectedAudioScopeId) return undefined;
    return dbAudioScopes.find(s => s.id === selectedAudioScopeId);
  }, [selectedAudioScopeId, dbAudioScopes]);

  const mediaItem = useLiveQuery(async () => {
    if (!scope?.fileId) return undefined;
    const byId = await db.mediaPool.get(scope.fileId);
    if (byId) return byId;
    return db.mediaPool.where('path').equals(scope.fileId).first();
  }, [scope?.fileId]);

  // ─── Selection styles ───
  const selectionStyles = useMemo(
    () => selectedIds.length > 0 ? getUniqueSelectionStyles(selectedIds, localItems) : [],
    [selectedIds, localItems]
  );

  // ─── Handlers ───
  const handleUpdateItem = (id: string, updates: Partial<ICanvasItem>) => {
    setLocalItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const newItem = { ...item, ...updates };
      if (updates.text && item.text) {
        newItem.text = { ...item.text, ...updates.text };
      }
      if (updates.shape && item.shape) {
        newItem.shape = { ...item.shape, ...updates.shape };
      }
      return newItem;
    }));
    if (previewSlideId) updateCanvasItem(previewSlideId, id, updates);
  };

  const handleBatchUpdateByArray = useCallback(async (updates: Array<{ id: string; updates: Partial<ICanvasItem> }>) => {
    setLocalItems(prev => prev.map(item => {
      const update = updates.find(u => u.id === item.id);
      if (!update) return item;

      const newItem = { ...item, ...update.updates };
      if (update.updates.text && item.text) {
        newItem.text = { ...item.text, ...update.updates.text };
      }
      if (update.updates.shape && item.shape) {
        newItem.shape = { ...item.shape, ...update.updates.shape };
      }
      return newItem;
    }));

    if (previewSlideId) {
      await takeSnapshot(previewSlideId);
      batchUpdateCanvasItems(previewSlideId, updates);
    }
  }, [previewSlideId, takeSnapshot, batchUpdateCanvasItems]);

  const handleSelectionStyleUpdate = useCallback((oldLayer: IStyleLayer, updates: Partial<IStyleLayer>) => {
    if (!previewSlideId) return;
    const allUpdates = calculateStyleUpdates(selectedIds, localItems, oldLayer, updates);
    if (allUpdates.length > 0) handleBatchUpdateByArray(allUpdates);
  }, [previewSlideId, selectedIds, localItems, handleBatchUpdateByArray]);

  // ─── Auto-tab switching ───
  useEffect(() => {
    if (selectedItemId) setActiveTab('properties');
    else if (selectedAudioScopeId) setActiveTab('audio');
    else if (selectedTransId) setActiveTab('transition');
    else if (selectedSlide?.type === 'video') setActiveTab('video');
  }, [selectedItemId, selectedAudioScopeId, selectedTransId, selectedSlide?.type, setActiveTab]);

  // ─── Handlers ───
  const handleBgChange = (bg: IStyleLayer[]) => {
    if (previewSlideId) updateSlideBackground(previewSlideId, bg as never);
  };

  const handleRemoveItem = (itemId: string) => {
    setLocalItems(prev => prev.filter(i => i.id !== itemId));
    if (previewSlideId) removeCanvasItem(previewSlideId, itemId);
    if (selectedIds.includes(itemId)) {
      setSelectedIds(selectedIds.filter(i => i !== itemId));
    }
  };

  const handleLayerSelect = useCallback((id: string, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      setSelectedIds(prev =>
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    } else if (e.shiftKey && selectedIds.length > 0) {
      const displayItems = [...localItems].reverse();
      const lastIdx = displayItems.findIndex(i => i.id === selectedIds[selectedIds.length - 1]);
      const thisIdx = displayItems.findIndex(i => i.id === id);
      if (lastIdx !== -1 && thisIdx !== -1) {
        const [from, to] = lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
        const rangeIds = displayItems.slice(from, to + 1).map(i => i.id);
        setSelectedIds(Array.from(new Set([...selectedIds, ...rangeIds])));
      }
    } else {
      setSelectedIds([id]);
    }
  }, [selectedIds, localItems, setSelectedIds]);

  const handleLayerDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDragActive(false);
    if (!over || active.id === over.id || !previewSlideId) return;

    const reversed = [...localItems].reverse();
    const oldIdx = reversed.findIndex(i => i.id === active.id);
    const newIdx = reversed.findIndex(i => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(reversed, oldIdx, newIdx).reverse();
    const withZIndex = reordered.map((item, idx) => ({
      ...item,
      zIndex: idx * 10
    }));
    setPendingUpdate(true);
    setLocalItems(withZIndex);
    updateCanvasItemsOrder(previewSlideId, withZIndex);
  };

  const handleSlideColorClick = useCallback((layer: IStyleLayer) => {
    const matchingIds = localItems.filter(item => {
      const fills = item.type === 'text' ? (item.text?.textFills || []) : (item.fills || []);
      const strokes = item.strokes || [];
      return [...fills, ...strokes].some(f => f.type === 'color' && f.color === layer.color);
    }).map(i => i.id);

    if (matchingIds.length > 0) {
      setSelectedIds(matchingIds);
      setActiveTab('properties');
    }
  }, [localItems, setSelectedIds, setActiveTab]);

  const setSlideDesignHovered = useSetAtom(slideDesignHoveredAtom);

  if (!panelOpen) return null;

  // ─── Build tab list ───
  const hasTimer = selectedSlide?.type === 'timer' ||
    (selectedSlide?.type === 'normal' && !!(selectedSlide as ICanvasSlide).timerSettings);
  const isVideoSlide = selectedSlide?.type === 'video';
  const contextTabs: ITabDefinition[] = [
    ...(hasTimer ? [{ id: 'timer' as PanelTab, icon: Clock, title: t('timer', { defaultValue: 'Timer' }) }] : []),
    ...(isVideoSlide ? [{ id: 'video' as PanelTab, icon: Film, title: t('video', { defaultValue: 'Video' }) }] : []),
    ...(selectedAudioScopeId ? [{ id: 'audio' as PanelTab, icon: Music, title: t('audio', { defaultValue: 'Audio' }) }] : []),
    ...(selectedTransId ? [{ id: 'transition' as PanelTab, icon: ArrowRightLeft, title: t('transition', { defaultValue: 'Transition' }) }] : []),
  ];
  const allTabs = [...getAlwaysTabs(t), ...contextTabs];
  const safeTab = allTabs.some(tab => tab.id === activeTab as string) ? activeTab as string : 'properties';
  const displayItems = [...localItems].reverse();

  return createPortal(
    <div
      data-slide-design-panel="true"
      className="fixed top-0 right-0 h-full w-[320px] z-[60] flex flex-col border-l border-white/6 animate-panel-in"
      style={{ background: 'rgba(10, 9, 8, 0.97)', backdropFilter: 'blur(24px)' }}
      onMouseEnter={() => setSlideDesignHovered(true)}
      onMouseLeave={() => setSlideDesignHovered(false)}
    >
      <SlideDesignTabBar
        tabs={allTabs}
        activeTab={safeTab}
        onTabChange={(id) => setActiveTab(id as PanelTab)}
        onClose={() => {
          setPanelOpen(false);
          selectAudioScope(null);
          setSelectedTransId(null);
        }}
        title={t('design', { defaultValue: 'Design' })}
      />

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {!selectedSlide && safeTab !== 'audio' ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
            <Layers className="w-8 h-8 text-stone-800" strokeWidth={1} />
            <p className="text-[10px] text-stone-600 font-bold uppercase tracking-widest">
              {t('select_slide_to_edit', 'Select a slide')}
            </p>
          </div>
        ) : (
          <>
            {/* ══ Properties Tab ══ */}
            {safeTab === 'properties' && (
              <SlideDesignPropertiesTab
                selectedIds={selectedIds}
                localItems={localItems}
                setLocalItems={setLocalItems}
                selectionStyles={selectionStyles}
                previewSlideId={previewSlideId}
                batchUpdateCanvasItems={batchUpdateCanvasItems}
                handleBatchUpdateByArray={handleBatchUpdateByArray}
                handleSelectionStyleUpdate={handleSelectionStyleUpdate}
                handleSlideColorClick={handleSlideColorClick}
                t={t as never}
              />
            )}

            {/* ══ Background Tab ══ */}
            {safeTab === 'background' && (
              <SlideDesignBackgroundTab
                slideBg={slideBg}
                onChange={handleBgChange}
                applyBackgroundToAll={applyBackgroundToAll}
                t={t as never}
              />
            )}

            {/* ══ Layers Tab ══ */}
            {safeTab === 'layers' && (
              <SlideDesignLayersTab
                localItems={localItems}
                displayItems={displayItems}
                selectedIds={selectedIds}
                sensors={sensors}
                onDragStart={() => setDragActive(true)}
                onDragEnd={handleLayerDragEnd}
                onDragCancel={() => setDragActive(false)}
                onSelect={handleLayerSelect}
                onUpdate={handleUpdateItem}
                onRemove={handleRemoveItem}
                onClearSelection={() => setSelectedIds([])}
                t={t}
              />
            )}

            {/* ══ Timer Tab ══ */}
            {safeTab === 'timer' && hasTimer && selectedSlide && (
              <div className="p-3 animate-in fade-in duration-200">
                <TimerTabContent
                  selectedSlide={selectedSlide}
                  updateTimerSettings={updateTimerSettings}
                  openModal={openModal}
                  t={t as TFunction}
                />
              </div>
            )}

            {/* ══ Audio Tab ══ */}
            {safeTab === 'audio' && (
              <div className="p-3 animate-in fade-in duration-200">
                <AudioTabContent
                  scope={scope}
                  mediaItem={mediaItem}
                  selectedAudioScopeId={selectedAudioScopeId}
                  updateAudioScope={updateAudioScope}
                  removeAudioScope={removeAudioScope}
                  selectAudioScope={selectAudioScope}
                  t={t as TFunction}
                />
              </div>
            )}

            {/* ══ Transition Tab ══ */}
            {safeTab === 'transition' && (selectedSlide || selectedTransId === 'presentation-end') && (
              <div className="p-3 animate-in fade-in duration-200">
                <TransitionTabContent
                  selectedSlide={selectedTransId === 'presentation-end' ? undefined : selectedSlide}
                  transition={selectedTransId === 'presentation-end' ? presentation?.endTransition : undefined}
                  onUpdate={async (trans) => {
                    if (selectedTransId === 'presentation-end') {
                      await updatePresentationEndTransition(trans);
                    } else if (selectedSlide) {
                      await updateSlideTransition(selectedSlide.id, trans);
                    }
                  }}
                  triggerTransitionPreview={triggerTransitionPreview}
                />
              </div>
            )}

            {/* ══ Video Tab ══ */}
            {safeTab === 'video' && isVideoSlide && selectedSlide && (
              <div className="p-3 animate-in fade-in duration-200">
                <VideoTabContent
                  settings={(selectedSlide as IVideoSlide).videoSettings}
                  onUpdate={(updates) => {
                    if (previewSlideId) updateVideoSettings(previewSlideId, updates);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default SlideDesignPanel;
