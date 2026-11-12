import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '@/core/db';
import { ITemplate, ITemplateSlide, ISlide, ICanvasSlide, IBlock } from '@/core/types';
import { EktmpService } from '@/features/presenter/services/ektmpService';
import { toast } from '@/core/utils/toast';
import { ConfirmState, EMPTY_CONFIRM } from './types';

interface UseTemplatePickerNamingParams {
  currentSlide: ISlide | undefined;
  currentBlock: IBlock | undefined;
  blocksMap: Map<string, IBlock>;
  isDev: boolean;
  refreshNavTemplate: (t: ITemplate) => void;
  pushNav: (level: { type: 'template'; template: ITemplate }) => void;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState>>;
}

export function useTemplatePickerNaming({
  currentSlide,
  currentBlock,
  blocksMap,
  isDev,
  refreshNavTemplate,
  pushNav,
  setConfirmState,
}: UseTemplatePickerNamingParams) {
  const { t } = useTranslation();

  const [isNamingTemplate, setIsNamingTemplate] = useState(false);
  const [namingTargetTemplate, setNamingTargetTemplate] = useState<ITemplate | null>(null);
  const [newName, setNewName] = useState('');
  const [newNameRu, setNewNameRu] = useState('');
  const [targetBlockId, setTargetBlockId] = useState<string | undefined>(undefined);

  const handleSaveAsTemplate = () => {
    if (!currentSlide || !currentBlock) return;
    setNewName(t('template_picker.new_template_en', 'New Template'));
    setNewNameRu(t('template_picker.new_template_ru', 'Новый шаблон'));
    setTargetBlockId(undefined);
    setIsNamingTemplate(true);
    setNamingTargetTemplate(null);
  };

  const confirmSaveTemplate = async () => {
    if (!currentSlide || !currentBlock || !newName) return;
    if (namingTargetTemplate) {
      const canvasSlide = currentSlide.type === 'normal' ? currentSlide as ICanvasSlide : null;
      const newTemplateSlide: ITemplateSlide = {
        id: crypto.randomUUID(),
        type: 'normal',
        name: newName,
        nameRu: newNameRu || newName,
        categoryId: targetBlockId,
        canvasItems: canvasSlide?.content?.canvasItems || [],
        backgroundOverride: canvasSlide?.backgroundOverride,
      };
      const updatedTemplate = {
        ...namingTargetTemplate,
        templateSlides: [...(namingTargetTemplate.templateSlides || []), newTemplateSlide],
      };
      await db.templates.put(updatedTemplate);
      refreshNavTemplate(updatedTemplate);
      await EktmpService.saveAsEktmpFile(updatedTemplate.id);
    } else {
      const canvasSlide = currentSlide.type === 'normal' ? currentSlide as ICanvasSlide : null;
      const newTemplate: ITemplate = {
        id: (isDev ? 'prebuilt-' : 'custom-') + Date.now().toString(),
        name: newName,
        nameRu: newNameRu || newName,
        category: targetBlockId || currentBlock.id,
        isUserCreated: !isDev,
        background: canvasSlide?.backgroundOverride || [{ id: 'bg-1', type: 'color', color: '#000000', visible: true, opacity: 1, blendMode: 'normal' }],
        assets: [],
        structure: { layout: 'custom' },
        canvasItems: canvasSlide?.content?.canvasItems || [],
        templateSlides: [],
      };
      await db.templates.add(newTemplate);
      await EktmpService.saveAsEktmpFile(newTemplate.id);
      pushNav({ type: 'template', template: newTemplate });
    }
    setIsNamingTemplate(false);
    setNamingTargetTemplate(null);
    setNewName('');
    setNewNameRu('');
    toast.success(t('template_saved'));
  };

  const handleAddSlideToTemplate = (e: React.MouseEvent | null, template: ITemplate, bId?: string) => {
    if (e) e.stopPropagation();
    if (!currentSlide || (!isDev && !template.isUserCreated)) return;

    const slideBlockId = currentSlide.blockId;
    const tBlockId = bId || template.category;
    const hasSlideInBlock = template.category === slideBlockId ||
      (template.templateSlides?.some(s => s.categoryId === slideBlockId));

    const initNaming = () => {
      setNewName(t('template_picker.new_layout_en', 'New Layout'));
      setNewNameRu(t('template_picker.new_layout_ru', 'Новый вариант'));
      setNamingTargetTemplate(template);
      setTargetBlockId(tBlockId);
      setIsNamingTemplate(true);
    };

    if (!hasSlideInBlock && slideBlockId !== tBlockId) {
      const blockName = blocksMap.get(slideBlockId)?.name || slideBlockId;
      setConfirmState({
        open: true,
        kind: 'slide',
        title: t('add_category_prompt_title', 'Add Category?'),
        description: t('add_category_prompt_desc', `This template doesn't have layouts for the "{{block}}" category. Do you want to add it as a "{{block}}" layout instead?`, { block: blockName }),
        onConfirmOverride: async () => {
          setTargetBlockId(slideBlockId);
          setConfirmState(EMPTY_CONFIRM);
          initNaming();
        },
      });
      return;
    }

    initNaming();
  };

  return {
    isNamingTemplate,
    setIsNamingTemplate,
    namingTargetTemplate,
    setNamingTargetTemplate,
    newName,
    setNewName,
    newNameRu,
    setNewNameRu,
    targetBlockId,
    setTargetBlockId,
    handleSaveAsTemplate,
    confirmSaveTemplate,
    handleAddSlideToTemplate,
  };
}
