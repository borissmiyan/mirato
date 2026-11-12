import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useLiveQuery } from 'dexie-react-hooks';
import { PresentationDataService } from '@/features/presenter/services/PresentationDataService';
import { useModalStore, ModalType, ModalState } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { ITemplate, ITemplateSlide } from '@/core/types';
import { X, LayoutTemplate, ChevronLeft, Settings2, Upload, Plus } from 'lucide-react';
import { EktmpService } from '@/features/presenter/services/ektmpService';
import ConfirmDialog from '@/shared/ui/ConfirmDialog';
import DropdownSelector from '@/shared/ui/DropdownSelector';
import { toast } from '@/core/utils/toast';
import { Button, IconButton, SearchInput } from '@/shared/ui';

// Hooks
import { useTemplatePickerData } from '../../hooks/useTemplatePickerData';
import { useTemplatePickerActions, EMPTY_CONFIRM } from '../../hooks/useTemplatePickerActions';

// Sub-components
import { TemplatePickerGrid } from './TemplatePickerGrid';
import { TemplatePickerOverlays } from './TemplatePickerOverlays';
import { TemplatePickerContextMenu } from './TemplatePickerContextMenu';

/**
 * Template picker modal — browse, select, and manage slide templates.
 */
interface TemplatePickerModalContentProps {
    modalData: ModalState;
}

const TemplatePickerModalContent: React.FC<TemplatePickerModalContentProps> = ({ modalData }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.language?.substring(0, 2) || 'en';
    const isRu = lang === 'ru';
    const isDev = import.meta.env.DEV;

    const closeModal = useModalStore(s => s.closeModal);
    const slideId = modalData?.props?.slideId as string | undefined;
    const blockId = modalData?.props?.blockId as string | undefined;

    const { activePresentationId, updatePresentationSlides, setPreviewSlide } = usePresentationStore(
        useShallow(s => ({
            activePresentationId: s.activePresentationId,
            updatePresentationSlides: s.updatePresentationSlides,
            setPreviewSlide: s.setPreviewSlide,
        }))
    );

    const presentation = useLiveQuery(
        () => activePresentationId ? PresentationDataService.getPresentation(activePresentationId) : undefined,
        [activePresentationId]
    );

    // ─── Data Hook ───
    const data = useTemplatePickerData(blockId);
    const { templates, blocksMap, currentView, allBlocks, allTemplates } = data;

    const currentSlide = presentation?.slides?.find(s => s.id === slideId);
    const currentBlock = currentSlide ? blocksMap.get(currentSlide.blockId) : undefined;

    // ─── Actions Hook ───
    const actions = useTemplatePickerActions({
        isDev,
        allTemplates,
        allBlocks,
        blocksMap,
        currentSlide,
        currentBlock,
        refreshNavTemplate: data.refreshNavTemplate,
        pushNav: data.pushNav,
        popNav: data.popNav,
        currentView,
    });

    // ─── Wrapped handleSelectTemplate (binds presentation context) ───
    const onSelectTemplate = (template: ITemplate, nestedSlide?: ITemplateSlide) => {
        if (!activePresentationId || !presentation || !slideId) return;
        actions.handleSelectTemplate(
            template, nestedSlide,
            activePresentationId, presentation, slideId,
            updatePresentationSlides, setPreviewSlide,
            closeModal, ModalType.TEMPLATE_PICKER
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-10001 flex items-center justify-center bg-stone-950/75 backdrop-blur-xl apple-backdrop p-4 md:p-6">
            <div className="bg-stone-900 border border-white/10 rounded-2xl w-full max-w-xl max-h-[75vh] flex flex-col overflow-hidden shadow-2xl ring-1 ring-white/5 apple-modal">
                {/* ── Header ── */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        {data.navStack.length > 1 ? (
                            <IconButton
                                icon={<ChevronLeft className="w-5 h-5" />}
                                label="Back"
                                variant="surface"
                                size="xs"
                                onClick={data.popNav}
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                                <LayoutTemplate className="w-5 h-5 text-accent" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight uppercase">
                                {currentView.type === 'template' ? (isRu ? currentView.template.nameRu : currentView.template.name) :
                                    currentView.type === 'block' ? (isRu ? blocksMap.get(currentView.blockId)?.nameRu || currentView.blockId : blocksMap.get(currentView.blockId)?.name || currentView.blockId) :
                                        t('all_templates')}
                            </h2>
                            <p className="text-[9px] text-stone-500 font-bold uppercase tracking-[0.2em] mt-0.5">
                                {currentView.type === 'template' ? t('select_block') :
                                    currentView.type === 'block' ? t('select_layout') :
                                        t('organized_by_template')}
                            </p>
                        </div>
                    </div>

                    {currentView.type === 'all' && (
                        <div className="flex-1 max-w-xs mx-4">
                            <SearchInput
                                value={data.searchQuery}
                                onChange={(e) => data.setSearchQuery(e.target.value)}
                                placeholder={t('search_templates', 'Search templates...')}
                                size="sm"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-2 ml-auto shrink-0">
                        <IconButton
                            icon={<Settings2 className="w-4 h-4" />}
                            label={t('manage_blocks', 'Manage Blocks')}
                            variant="surface"
                            size="xs"
                            onClick={() => actions.setShowBlockManager(true)}
                        />
                        <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.ektmp';
                                input.onchange = async (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (!file) return;
                                    try {
                                        const imported = await EktmpService.unpack(file);
                                        await PresentationDataService.addTemplate(imported);
                                        toast.success(t('import'));
                                    } catch {
                                        toast.error('Failed to import.');
                                    }
                                };
                                input.click();
                            }}
                            leftIcon={<Upload className="w-3.5 h-3.5" />}
                        >
                            {t('import')}
                        </Button>
                        <Button
                            size="xs"
                            variant="primary"
                            onClick={actions.handleSaveAsTemplate}
                            disabled={!currentSlide}
                            leftIcon={<Plus className="w-3.5 h-3.5" />}
                        >
                            {isDev ? t('add_prebuilt') : t('save_as_template')}
                        </Button>
                    </div>
                    <div className="w-px h-8 bg-white/5 mx-2 shrink-0" />
                    <IconButton
                        icon={<X className="w-5 h-5" />}
                        label={t('close', 'Close')}
                        variant="surface"
                        size="xs"
                        onClick={() => closeModal(ModalType.TEMPLATE_PICKER)}
                    />
                </div>

                {/* ── Content Grid ── */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-5">
                    <TemplatePickerGrid
                        currentView={currentView}
                        templates={templates}
                        blocksMap={blocksMap}
                        currentSlide={currentSlide}
                        currentBlock={currentBlock}
                        isRu={isRu}
                        lang={lang}
                        pushNav={data.pushNav}
                        setContextMenu={actions.setContextMenu}
                        handleSelectTemplate={onSelectTemplate}
                        searchQuery={data.searchQuery}
                    />
                </div>
            </div>

            {/* ── Overlays ── */}
            <TemplatePickerOverlays
                isDev={isDev}
                isRu={isRu}
                allBlocks={allBlocks}
                allTemplates={allTemplates}
                isNamingTemplate={actions.isNamingTemplate}
                setIsNamingTemplate={actions.setIsNamingTemplate}
                namingTargetTemplate={actions.namingTargetTemplate}
                newName={actions.newName}
                setNewName={actions.setNewName}
                newNameRu={actions.newNameRu}
                setNewNameRu={actions.setNewNameRu}
                targetBlockId={actions.targetBlockId}
                setTargetBlockId={actions.setTargetBlockId}
                confirmSaveTemplate={actions.confirmSaveTemplate}
                editingTemplate={actions.editingTemplate}
                setEditingTemplate={actions.setEditingTemplate}
                editName={actions.editName}
                setEditName={actions.setEditName}
                editNameRu={actions.editNameRu}
                setEditNameRu={actions.setEditNameRu}
                editId={actions.editId}
                setEditId={actions.setEditId}
                editBackgroundColor={actions.editBackgroundColor}
                setEditBackgroundColor={actions.setEditBackgroundColor}
                editCategoryId={actions.editCategoryId}
                setEditCategoryId={actions.setEditCategoryId}
                handleUpdateTemplateProperties={actions.handleUpdateTemplateProperties}
                editingLayout={actions.editingLayout}
                setEditingLayout={() => actions.setEditingLayout(null)}
                editParentTemplateId={actions.editParentTemplateId}
                setEditParentTemplateId={actions.setEditParentTemplateId}
                handleUpdateLayoutProperties={actions.handleUpdateLayoutProperties}
                movingBunch={actions.movingBunch}
                setMovingBunch={() => actions.setMovingBunch(null)}
                handleMoveBunch={actions.handleMoveBunch}
                showBlockManager={actions.showBlockManager}
                setShowBlockManager={actions.setShowBlockManager}
                editingBlock={actions.editingBlock}
                setEditingBlock={actions.setEditingBlock}
                isAddingBlock={actions.isAddingBlock}
                setIsAddingBlock={actions.setIsAddingBlock}
                blockFormName={actions.blockFormName}
                setBlockFormName={actions.setBlockFormName}
                blockFormNameRu={actions.blockFormNameRu}
                setBlockFormNameRu={actions.setBlockFormNameRu}
                blockFormColor={actions.blockFormColor}
                setBlockFormColor={actions.setBlockFormColor}
                blockFormIcon={actions.blockFormIcon}
                setBlockFormIcon={actions.setBlockFormIcon}
                openBlockForm={actions.openBlockForm}
                saveBlock={actions.saveBlock}
                requestDeleteBlock={actions.requestDeleteBlock}
            />

            {/* ── Context Menu ── */}
            <TemplatePickerContextMenu
                isDev={isDev}
                contextMenu={actions.contextMenu}
                setContextMenu={() => actions.setContextMenu(null)}
                setEditingTemplate={actions.setEditingTemplate}
                setEditName={actions.setEditName}
                setEditNameRu={actions.setEditNameRu}
                setEditId={actions.setEditId}
                setEditCategoryId={actions.setEditCategoryId}
                setEditBackgroundColor={actions.setEditBackgroundColor}
                handleDuplicateTemplate={actions.handleDuplicateTemplate}
                handleExportTemplate={actions.handleExportTemplate}
                requestDeleteTemplate={actions.requestDeleteTemplate}
                handleAddSlideToTemplate={actions.handleAddSlideToTemplate}
                setMovingBunch={actions.setMovingBunch}
                requestDeleteBlockBunch={actions.requestDeleteBlockBunch}
                handleUpdateSlideContent={actions.handleUpdateSlideContent}
                setEditingLayout={actions.setEditingLayout}
                setEditParentTemplateId={actions.setEditParentTemplateId}
                requestDeleteSlide={actions.requestDeleteSlide}
            />

            {/* ── Confirm Dialog ── */}
            <ConfirmDialog
                isOpen={actions.confirmState.open}
                onCancel={() => actions.setConfirmState(EMPTY_CONFIRM)}
                onConfirm={actions.handleConfirm}
                title={actions.confirmState.title}
                description={actions.confirmState.description}
                confirmLabel={actions.confirmState.onConfirmOverride ? t('confirm', 'Confirm') : t('delete')}
                cancelLabel={t('cancel')}
                danger={!actions.confirmState.onConfirmOverride}
            >
                {actions.confirmState.kind === 'template' && actions.confirmState.template?.templateSlides?.length ? (
                    <div className="space-y-2">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 block">{t('move_slides_before_delete')}</label>
                        <DropdownSelector
                            value={actions.confirmState.migrationTargetId || ''}
                            onChange={(val) => actions.setConfirmState(prev => ({ ...prev, migrationTargetId: val || undefined }))}
                            options={[
                                { value: '', label: t('select_target_template') },
                                ...allTemplates.filter(t => t.id !== actions.confirmState.template?.id && t.id !== 'blank-dark').map(tmpl => ({
                                    value: tmpl.id,
                                    label: isRu ? tmpl.nameRu : tmpl.name
                                }))
                            ]}
                            className="py-2.5"
                        />
                    </div>
                ) : null}
            </ConfirmDialog>
        </div>,
        document.body
    );
};

const TemplatePickerModal: React.FC = () => {
    const modalData = useModalStore(
        useShallow(s => [...s.stack].reverse().find(m => m.id === ModalType.TEMPLATE_PICKER))
    );
    if (!modalData) return null;
    return <TemplatePickerModalContent modalData={modalData} />;
};

export default TemplatePickerModal;
