import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '@/core/db';
import { ITemplate, ITemplateSlide } from '@/core/types';
import { EktmpService } from '@/features/presenter/services/ektmpService';
import { toast } from '@/core/utils/toast';
import { ConfirmState, EMPTY_CONFIRM } from './types';

interface UseTemplatePickerDeletionParams {
  allTemplates: ITemplate[];
  isDev: boolean;
  currentView: { type: string; template?: ITemplate };
  refreshNavTemplate: (t: ITemplate) => void;
  popNav: () => void;
  confirmState: ConfirmState;
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState>>;
}

export function useTemplatePickerDeletion({
  allTemplates,
  isDev,
  currentView,
  refreshNavTemplate,
  popNav,
  confirmState,
  setConfirmState,
}: UseTemplatePickerDeletionParams) {
  const { t } = useTranslation();

  const requestDeleteSlide = (template: ITemplate, s: ITemplateSlide | 'base') => {
    if (s === 'base') {
      toast.warning(t('cannot_delete_base_group'));
      return;
    }
    setConfirmState({
      open: true,
      kind: 'slide',
      title: t('confirm_delete_layout'),
      description: t('confirm_delete_layout_desc'),
      template,
      slide: s,
    });
  };

  const requestDeleteBlockBunch = (template: ITemplate, bId: string) => {
    if (template.category === bId) {
      toast.warning(t('cannot_delete_base_group'));
      return;
    }
    setConfirmState({
      open: true,
      kind: 'group',
      title: t('confirm_delete_group'),
      description: t('confirm_delete_group_desc'),
      template,
      blockId: bId,
    });
  };

  const requestDeleteTemplate = (template: ITemplate) => {
    if (!isDev && !template.isUserCreated) return;
    setConfirmState({
      open: true,
      kind: 'template',
      title: t('confirm_delete_template'),
      description: t('confirm_delete_template_desc'),
      template,
      migrationTargetId: undefined,
    });
  };

  const handleConfirm = useCallback(async () => {
    if (confirmState.onConfirmOverride) {
      await confirmState.onConfirmOverride();
      return;
    }
    switch (confirmState.kind) {
      case 'slide': {
        const { template, slide } = confirmState;
        if (!template || !slide || slide === 'base') return;
        const updatedTemplate: ITemplate = {
          ...template,
          templateSlides: template.templateSlides?.filter((ts: ITemplateSlide) => ts.id !== (slide as ITemplateSlide).id),
        };
        await db.templates.put(updatedTemplate);
        refreshNavTemplate(updatedTemplate);
        await EktmpService.saveAsEktmpFile(updatedTemplate.id);
        setConfirmState(EMPTY_CONFIRM);
        toast.success(t('layout_deleted'));
        break;
      }
      case 'group': {
        const { template, blockId: bId } = confirmState;
        if (!template || !bId) return;
        const updatedTemplate: ITemplate = {
          ...template,
          templateSlides: template.templateSlides?.filter((s: ITemplateSlide) => s.categoryId !== bId),
        };
        await db.templates.put(updatedTemplate);
        refreshNavTemplate(updatedTemplate);
        await EktmpService.saveAsEktmpFile(updatedTemplate.id);
        setConfirmState(EMPTY_CONFIRM);
        toast.success(t('group_deleted'));
        break;
      }
      case 'template': {
        const { template, migrationTargetId } = confirmState;
        if (!template) return;

        if (migrationTargetId) {
          const targetTemplate = allTemplates.find(t => t.id === migrationTargetId);
          if (targetTemplate && template.templateSlides?.length) {
            const updatedTarget: ITemplate = {
              ...targetTemplate,
              templateSlides: [...(targetTemplate.templateSlides || []), ...template.templateSlides],
            };
            await db.templates.put(updatedTarget);
            await EktmpService.saveAsEktmpFile(updatedTarget.id);
            toast.success(t('slides_moved'));
          }
        }

        await db.templates.delete(template.id);
        await EktmpService.deleteFromFilesystem(template.id);
        if (currentView.type === 'template' && currentView.template?.id === template.id) popNav();
        setConfirmState(EMPTY_CONFIRM);
        toast.success(t('template_deleted'));
        break;
      }
      case 'block': {
        const { block } = confirmState;
        if (!block) return;
        await db.blocks.delete(block.id);
        setConfirmState(EMPTY_CONFIRM);
        toast.success(t('block_deleted'));
        break;
      }
    }
  }, [confirmState, allTemplates, currentView, popNav, refreshNavTemplate, t, setConfirmState]);

  return {
    requestDeleteSlide,
    requestDeleteBlockBunch,
    requestDeleteTemplate,
    handleConfirm,
  };
}

