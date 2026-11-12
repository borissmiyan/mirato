import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '@/core/db';
import { ITemplate, ITemplateSlide, ISlide, ICanvasSlide } from '@/core/types';
import { EktmpService } from '@/features/presenter/services/ektmpService';
import { toast } from '@/core/utils/toast';

interface UseTemplatePickerPropertiesParams {
  allTemplates: ITemplate[];
  currentSlide: ISlide | undefined;
  isDev: boolean;
  refreshNavTemplate: (t: ITemplate) => void;
}

export function useTemplatePickerProperties({
  allTemplates,
  currentSlide,
  isDev,
  refreshNavTemplate,
}: UseTemplatePickerPropertiesParams) {
  const { t } = useTranslation();

  const [editingTemplate, setEditingTemplate] = useState<ITemplate | null>(null);
  const [editingLayout, setEditingLayout] = useState<{ template: ITemplate; slide: ITemplateSlide } | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameRu, setEditNameRu] = useState('');
  const [editId, setEditId] = useState('');
  const [editBackgroundColor, setEditBackgroundColor] = useState('#000000');
  const [editCategoryId, setEditCategoryId] = useState<string | undefined>(undefined);
  const [editParentTemplateId, setEditParentTemplateId] = useState<string | undefined>(undefined);
  const [movingBunch, setMovingBunch] = useState<{ template: ITemplate; sourceBlockId: string } | null>(null);

  const handleOpenProperties = (template: ITemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditNameRu(template.nameRu || '');
    setEditId(template.id);
    const bgLayer = template.background?.[0];
    setEditBackgroundColor(bgLayer && bgLayer.type === 'color' ? bgLayer.color : '#000000');
    setEditCategoryId(template.category);
  };

  const handleOpenLayoutProperties = (template: ITemplate, slide: ITemplateSlide) => {
    setEditingLayout({ template, slide });
    setEditName(slide.name || '');
    setEditNameRu(slide.nameRu || '');
    setEditCategoryId(slide.categoryId || template.category);
    setEditParentTemplateId(template.id);
  };

  const handleUpdateTemplateProperties = async () => {
    if (!editingTemplate || !editName || !editId) return;

    const oldId = editingTemplate.id;
    const newId = editId.trim();

    const updatedTemplate: ITemplate = {
      ...editingTemplate,
      id: newId,
      name: editName,
      nameRu: editNameRu || editName,
      category: editCategoryId || editingTemplate.category,
      background: editingTemplate.background.map((bg, idx: number) =>
        idx === 0 && bg.type === 'color' ? { ...bg, color: editBackgroundColor } : bg
      ),
    };

    if (oldId !== newId) {
      const presentations = await db.presentationFiles.toArray();
      for (const pres of presentations) {
        let changed = false;
        const updatedSlides = pres.slides.map(s => {
          if (s.templateId === oldId) {
            changed = true;
            return { ...s, templateId: newId };
          }
          return s;
        });
        if (changed) {
          await db.presentationFiles.update(pres.id, { slides: updatedSlides });
        }
      }
      await db.templates.delete(oldId);
      await EktmpService.deleteFromFilesystem(oldId);
    }

    await db.templates.put(updatedTemplate);
    refreshNavTemplate(updatedTemplate);
    await EktmpService.saveAsEktmpFile(updatedTemplate.id);
    setEditingTemplate(null);
    toast.success(t('edit_properties'));
  };

  const handleUpdateLayoutProperties = async () => {
    if (!editingLayout || !editName) return;
    const { template, slide } = editingLayout;

    if (editParentTemplateId && editParentTemplateId !== template.id) {
      const targetTemplate = allTemplates.find(t => t.id === editParentTemplateId);
      if (targetTemplate) {
        const movedSlide: ITemplateSlide = { ...slide, name: editName, nameRu: editNameRu || editName, categoryId: editCategoryId };
        const updatedSource: ITemplate = { ...template, templateSlides: template.templateSlides?.filter((ts: ITemplateSlide) => ts.id !== slide.id) };
        await db.templates.put(updatedSource);
        refreshNavTemplate(updatedSource);
        await EktmpService.saveAsEktmpFile(updatedSource.id);
        const updatedTarget: ITemplate = { ...targetTemplate, templateSlides: [...(targetTemplate.templateSlides || []), movedSlide] };
        await db.templates.put(updatedTarget);
        await EktmpService.saveAsEktmpFile(updatedTarget.id);
        toast.success(t('layout_moved'));
      }
    } else {
      const updatedTemplate: ITemplate = {
        ...template,
        templateSlides: template.templateSlides?.map((ts: ITemplateSlide) => ts.id === slide.id
          ? { ...ts, name: editName, nameRu: editNameRu || editName, categoryId: editCategoryId }
          : ts
        ),
      };
      await db.templates.put(updatedTemplate);
      refreshNavTemplate(updatedTemplate);
      await EktmpService.saveAsEktmpFile(updatedTemplate.id);
    }
    setEditingLayout(null);
    setEditParentTemplateId(undefined);
  };

  const handleMoveBunch = async (targetBId: string) => {
    if (!movingBunch) return;
    const { template, sourceBlockId } = movingBunch;
    const updatedTemplate: ITemplate = {
      ...template,
      category: template.category === sourceBlockId ? targetBId : template.category,
      templateSlides: template.templateSlides?.map((s: ITemplateSlide) =>
        s.categoryId === sourceBlockId ? { ...s, categoryId: targetBId } : s
      ),
    };
    await db.templates.put(updatedTemplate);
    refreshNavTemplate(updatedTemplate);
    await EktmpService.saveAsEktmpFile(updatedTemplate.id);
    setMovingBunch(null);
    toast.success(t('slides_moved'));
  };

  const handleUpdateSlideContent = async (template: ITemplate, s: ITemplateSlide | 'base') => {
    if (!currentSlide) return;
    if (!isDev && !template.isUserCreated) {
      toast.warning(t('cannot_update_default'));
      return;
    }
    const canvasSlide = currentSlide.type === 'normal' ? currentSlide as ICanvasSlide : null;
    const newCanvasItems = (canvasSlide?.content?.canvasItems || []).map(item => ({ ...item, id: crypto.randomUUID() }));
    let updatedTemplate: ITemplate;
    if (s === 'base') {
      updatedTemplate = { ...template, canvasItems: newCanvasItems, background: canvasSlide?.backgroundOverride || template.background };
    } else {
      updatedTemplate = {
        ...template,
        templateSlides: template.templateSlides?.map((ts: ITemplateSlide) =>
          ts.id === s.id ? { ...ts, canvasItems: newCanvasItems, backgroundOverride: canvasSlide?.backgroundOverride } : ts
        ),
      };
    }
    await db.templates.put(updatedTemplate);
    refreshNavTemplate(updatedTemplate);
    await EktmpService.saveAsEktmpFile(updatedTemplate.id);
    toast.success(t('update_with_current'));
  };

  return {
    editingTemplate,
    setEditingTemplate,
    editingLayout,
    setEditingLayout,
    editName,
    setEditName,
    editNameRu,
    setEditNameRu,
    editId,
    setEditId,
    editBackgroundColor,
    setEditBackgroundColor,
    editCategoryId,
    setEditCategoryId,
    editParentTemplateId,
    setEditParentTemplateId,
    movingBunch,
    setMovingBunch,
    handleOpenProperties,
    handleOpenLayoutProperties,
    handleUpdateTemplateProperties,
    handleUpdateLayoutProperties,
    handleMoveBunch,
    handleUpdateSlideContent,
  };
}

