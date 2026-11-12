import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '@/core/db';
import { ITemplate, ITemplateSlide, ISlide, ICanvasSlide, ICanvasItem, IBlock } from '@/core/types';
import { EktmpService } from '@/features/presenter/services/ektmpService';
import { toast } from '@/core/utils/toast';
import { ModalType } from '@/core/store/modalStore';

import { ConfirmState, EMPTY_CONFIRM } from './template-picker/types';
import { useTemplatePickerNaming } from './template-picker/useTemplatePickerNaming';
import { useTemplatePickerProperties } from './template-picker/useTemplatePickerProperties';
import { useTemplatePickerBlockManager } from './template-picker/useTemplatePickerBlockManager';
import { useTemplatePickerDeletion } from './template-picker/useTemplatePickerDeletion';

export type { ConfirmState };
export { EMPTY_CONFIRM };

interface UseTemplatePickerActionsParams {
  isDev: boolean;
  allTemplates: ITemplate[];
  allBlocks: IBlock[];
  blocksMap: Map<string, IBlock>;
  currentSlide: ISlide | undefined;
  currentBlock: IBlock | undefined;
  refreshNavTemplate: (t: ITemplate) => void;
  pushNav: (level: { type: 'template'; template: ITemplate }) => void;
  popNav: () => void;
  currentView: { type: string; template?: ITemplate };
}

/**
 * Hook for all template picker CRUD actions, orchestrating naming,
 * properties editing, block management, and deletion workflows.
 */
export function useTemplatePickerActions({
  isDev,
  allTemplates,
  allBlocks,
  blocksMap,
  currentSlide,
  currentBlock,
  refreshNavTemplate,
  pushNav,
  popNav,
  currentView,
}: UseTemplatePickerActionsParams) {
  const { t } = useTranslation();

  // ─── Context Menu State ───
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'template' | 'block' | 'slide'; data: Record<string, unknown> } | null>(null);

  // ─── Confirm Dialog State ───
  const [confirmState, setConfirmState] = useState<ConfirmState>(EMPTY_CONFIRM);

  // ─── Subhooks ───
  const naming = useTemplatePickerNaming({
    currentSlide,
    currentBlock,
    blocksMap,
    isDev,
    refreshNavTemplate,
    pushNav,
    setConfirmState,
  });

  const properties = useTemplatePickerProperties({
    allTemplates,
    currentSlide,
    isDev,
    refreshNavTemplate,
  });

  const blockManager = useTemplatePickerBlockManager({
    setConfirmState,
  });

  const deletion = useTemplatePickerDeletion({
    allTemplates,
    isDev,
    currentView,
    refreshNavTemplate,
    popNav,
    confirmState,
    setConfirmState,
  });

  /** Select a template and insert slide into presentation */
  const handleSelectTemplate = async (
    template: ITemplate,
    nestedSlide: ITemplateSlide | undefined,
    activePresentationId: string,
    presentation: { slides: ISlide[] },
    slideId: string,
    updatePresentationSlides: (id: string, slides: ISlide[]) => Promise<void>,
    setPreviewSlide: (id: string | null, pid?: string, rootId?: string, parentId?: string | null) => void,
    closeModal: (type?: ModalType) => void,
    modalType: ModalType
  ) => {
    const currentIndex = presentation.slides.findIndex(s => s.id === slideId);
    if (currentIndex === -1) return;
    const cs = presentation.slides[currentIndex];
    const sourceCanvasItems = nestedSlide?.canvasItems || template.canvasItems || [];
    const newCanvasItems = (sourceCanvasItems as ICanvasItem[]).map(item => ({ ...item, id: crypto.randomUUID() }));
    const newSlide: ICanvasSlide = {
      id: crypto.randomUUID(),
      type: 'normal',
      order: 0,
      blockId: cs.blockId,
      templateId: template.id,
      backgroundOverride: nestedSlide?.backgroundOverride,
      content: { variables: {}, canvasItems: newCanvasItems.length > 0 ? newCanvasItems : undefined },
    };
    const newSlides = [...presentation.slides];
    newSlides.splice(currentIndex + 1, 0, newSlide);
    const orderedSlides = newSlides.map((s, i) => ({ ...s, order: i }));
    await updatePresentationSlides(activePresentationId, orderedSlides);
    setPreviewSlide(newSlide.id, activePresentationId);
    closeModal(modalType);
  };

  /** Duplicate a template */
  const handleDuplicateTemplate = async (template: ITemplate) => {
    const duplicatedTemplate: ITemplate = {
      ...template,
      id: (isDev ? 'prebuilt-' : 'custom-') + Date.now().toString(),
      name: `${template.name} (Copy)`,
      nameRu: template.nameRu ? `${template.nameRu} (Копия)` : undefined,
      isUserCreated: !isDev,
      templateSlides: template.templateSlides?.map((ts: ITemplateSlide) => ({ ...ts, id: crypto.randomUUID() }))
    };
    await db.templates.add(duplicatedTemplate);
    await EktmpService.saveAsEktmpFile(duplicatedTemplate.id);
    toast.success(t('template_duplicated', 'Template duplicated'));
  };

  /** Export a template as .ektmp */
  const handleExportTemplate = async (template: ITemplate) => {
    try {
      await EktmpService.saveAsEktmpFile(template.id);
      const fileBlob = await EktmpService.pack(template.id);
      if (!fileBlob) throw new Error('File not found');

      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.id}.ektmp`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('export_success', 'Template exported'));
    } catch (e) {
      console.error(e);
      toast.error(t('export_error', 'Failed to export template'));
    }
  };

  return {
    // Naming
    isNamingTemplate: naming.isNamingTemplate,
    setIsNamingTemplate: naming.setIsNamingTemplate,
    namingTargetTemplate: naming.namingTargetTemplate,
    setNamingTargetTemplate: naming.setNamingTargetTemplate,
    newName: naming.newName,
    setNewName: naming.setNewName,
    newNameRu: naming.newNameRu,
    setNewNameRu: naming.setNewNameRu,
    targetBlockId: naming.targetBlockId,
    setTargetBlockId: naming.setTargetBlockId,
    // Context Menu
    contextMenu,
    setContextMenu,
    // Confirm
    confirmState,
    setConfirmState,
    // Edit Properties
    editingTemplate: properties.editingTemplate,
    setEditingTemplate: properties.setEditingTemplate,
    editingLayout: properties.editingLayout,
    setEditingLayout: properties.setEditingLayout,
    editName: properties.editName,
    setEditName: properties.setEditName,
    editNameRu: properties.editNameRu,
    setEditNameRu: properties.setEditNameRu,
    editId: properties.editId,
    setEditId: properties.setEditId,
    editBackgroundColor: properties.editBackgroundColor,
    setEditBackgroundColor: properties.setEditBackgroundColor,
    editCategoryId: properties.editCategoryId,
    setEditCategoryId: properties.setEditCategoryId,
    editParentTemplateId: properties.editParentTemplateId,
    setEditParentTemplateId: properties.setEditParentTemplateId,
    // Move
    movingBunch: properties.movingBunch,
    setMovingBunch: properties.setMovingBunch,
    // Block Manager
    showBlockManager: blockManager.showBlockManager,
    setShowBlockManager: blockManager.setShowBlockManager,
    editingBlock: blockManager.editingBlock,
    setEditingBlock: blockManager.setEditingBlock,
    isAddingBlock: blockManager.isAddingBlock,
    setIsAddingBlock: blockManager.setIsAddingBlock,
    blockFormName: blockManager.blockFormName,
    setBlockFormName: blockManager.setBlockFormName,
    blockFormNameRu: blockManager.blockFormNameRu,
    setBlockFormNameRu: blockManager.setBlockFormNameRu,
    blockFormColor: blockManager.blockFormColor,
    setBlockFormColor: blockManager.setBlockFormColor,
    blockFormIcon: blockManager.blockFormIcon,
    setBlockFormIcon: blockManager.setBlockFormIcon,
    // Handlers
    handleSelectTemplate,
    handleDuplicateTemplate,
    handleExportTemplate,
    handleSaveAsTemplate: naming.handleSaveAsTemplate,
    confirmSaveTemplate: naming.confirmSaveTemplate,
    handleAddSlideToTemplate: naming.handleAddSlideToTemplate,
    handleOpenProperties: properties.handleOpenProperties,
    handleOpenLayoutProperties: properties.handleOpenLayoutProperties,
    handleUpdateTemplateProperties: properties.handleUpdateTemplateProperties,
    handleUpdateLayoutProperties: properties.handleUpdateLayoutProperties,
    handleMoveBunch: properties.handleMoveBunch,
    handleUpdateSlideContent: properties.handleUpdateSlideContent,
    requestDeleteSlide: deletion.requestDeleteSlide,
    requestDeleteBlockBunch: deletion.requestDeleteBlockBunch,
    requestDeleteTemplate: deletion.requestDeleteTemplate,
    openBlockForm: blockManager.handleStartEditBlock,
    saveBlock: blockManager.saveBlock,
    requestDeleteBlock: blockManager.requestDeleteBlock,
    handleConfirm: deletion.handleConfirm,
  };
}
