import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Trash2, Copy, ArrowLeft, ArrowRight, LayoutTemplate, BookOpen,
    ChevronsLeft, ChevronsRight, Unplug, Scissors, Clipboard as ClipboardIcon, CopyPlus, Music, Palette
} from 'lucide-react';
import { ICanvasSlide, INestedSlide, IPresentationFile } from '@/core/types';
import { IHymnSlide } from '@/core/types/presentation';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useHymnThemeEditorStore } from '@/features/hymns/store/useHymnThemeEditorStore';
import { resolveEffectiveThemeId } from '@/features/hymns/services/hymnThemeResolver';
import { useSetAtom } from 'jotai';
import { slideDesignPanelOpenAtom } from '@/core/store/uiAtoms';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { LibraryImportService } from '../../services/LibraryImportService';

interface TimelineContextMenuProps {
    contextMenu: { x: number; y: number; slideId: string; presentationId: string } | null;
    onClose: () => void;
    presentationsMap: Map<string, IPresentationFile>;
    activePresentationId: string | null;
}

export const TimelineContextMenu: React.FC<TimelineContextMenuProps> = ({
    contextMenu,
    onClose,
    presentationsMap,
    activePresentationId
}) => {
    const { t } = useTranslation();
    const openModal = useModalStore(s => s.openModal);
    const setSlideDesignPanelOpen = useSetAtom(slideDesignPanelOpenAtom);
    const loadHymnTheme = useHymnThemeEditorStore(s => s.loadTheme);

    const selectedSlideIds = usePresentationStore(s => s.selectedSlideIds);
    const clipboard = usePresentationStore(s => s.clipboard);
    const audioClipboard = usePresentationStore(s => s.audioClipboard);

    const copySlides = usePresentationStore(s => s.copySlides);
    const pasteSlides = usePresentationStore(s => s.pasteSlides);
    const pasteAudioScope = usePresentationStore(s => s.pasteAudioScope);
    const duplicateSlide = usePresentationStore(s => s.duplicateSlide);
    const duplicateSlides = usePresentationStore(s => s.duplicateSlides);
    const detachNestedInstance = usePresentationStore(s => s.detachNestedInstance);
    const detachHymnSlide = usePresentationStore(s => s.detachHymnSlide);
    const moveSlide = usePresentationStore(s => s.moveSlide);
    const removeSlide = usePresentationStore(s => s.removeSlide);
    const removeSlides = usePresentationStore(s => s.removeSlides);

    if (!contextMenu) return null;

    const currentPresentation = presentationsMap.get(contextMenu.presentationId);
    const currentSlide = currentPresentation?.slides?.find(s => s.id === contextMenu.slideId);

    return (
        <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={onClose}
        >
            {/* Bible-specific: Change Verse */}
            {currentSlide?.blockId === 'bible' && (
                <ContextMenuItem
                    icon={<BookOpen className="w-4 h-4" />}
                    label={t('change_verse', 'Change Verse')}
                    onClick={() => {
                        openModal(ModalType.BIBLE_SELECTION, { slideId: contextMenu.slideId, presentationId: contextMenu.presentationId });
                        onClose();
                    }}
                />
            )}

            {/* Change Template (non-bible, non-master) */}
            {currentSlide && currentSlide.blockId !== 'bible' && currentSlide.blockId !== 'master-presentation' && (
                <ContextMenuItem
                    icon={<LayoutTemplate className="w-4 h-4" />}
                    label={t('change_template', 'Change Template')}
                    onClick={() => {
                        openModal(ModalType.TEMPLATE_PICKER, {
                            slideId: contextMenu.slideId,
                            blockId: currentSlide.blockId,
                            presentationId: contextMenu.presentationId
                        });
                        onClose();
                    }}
                />
            )}

            {/* Insert Hymn */}
            <ContextMenuItem
                icon={<Music className="w-4 h-4" />}
                label={t('insert_hymn', 'Insert Hymn...')}
                onClick={() => {
                    const slidesArr = currentPresentation?.slides || [];
                    const targetIdx = slidesArr.findIndex(s => s.id === contextMenu.slideId) + 1;
                    openModal(ModalType.HYMN_PICKER, { insertionIndex: targetIdx });
                    onClose();
                }}
            />

            <div className="h-px bg-white/5 my-1" />

            <ContextMenuItem
                icon={<Copy className="w-4 h-4" />}
                label={selectedSlideIds.length > 1 ? t('copy_multiple', 'Copy Selected') : t('copy', 'Copy')}
                onClick={() => {
                    copySlides(contextMenu.presentationId, selectedSlideIds.length > 0 ? selectedSlideIds : [contextMenu.slideId]);
                    onClose();
                }}
                shortcut="CMD+C"
            />

            <ContextMenuItem
                icon={<Scissors className="w-4 h-4" />}
                label={selectedSlideIds.length > 1 ? t('cut_multiple', 'Cut Selected') : t('cut', 'Cut')}
                onClick={() => {
                    copySlides(contextMenu.presentationId, selectedSlideIds.length > 0 ? selectedSlideIds : [contextMenu.slideId], true);
                    onClose();
                }}
                shortcut="CMD+X"
            />

            <ContextMenuItem
                icon={<ClipboardIcon className="w-4 h-4" />}
                label={t('paste', 'Paste')}
                disabled={!clipboard}
                onClick={() => {
                    const slidesArr = currentPresentation?.slides || [];
                    const targetIdx = slidesArr.findIndex(s => s.id === contextMenu.slideId) + 1;
                    pasteSlides(contextMenu.presentationId, targetIdx);
                    onClose();
                }}
                shortcut="CMD+V"
            />

            <ContextMenuItem
                icon={<Music className="w-4 h-4" />}
                label={t('paste_audio', 'Paste Audio')}
                disabled={!audioClipboard}
                onClick={() => {
                    pasteAudioScope(contextMenu.slideId);
                    onClose();
                }}
            />

            <ContextMenuItem
                icon={<CopyPlus className="w-4 h-4" />}
                label={t('import_slides_from_file', 'Import Slides from File...')}
                onClick={() => {
                    const slidesArr = currentPresentation?.slides || [];
                    const targetIdx = slidesArr.findIndex(s => s.id === contextMenu.slideId) + 1;
                    LibraryImportService.selectAndImportSlides(contextMenu.presentationId, targetIdx, t);
                    onClose();
                }}
            />

            <div className="h-px bg-white/5 my-1" />

            <ContextMenuItem
                icon={<CopyPlus className="w-4 h-4" />}
                label={selectedSlideIds.length > 1 ? t('duplicate_multiple', 'Duplicate Selected') : t('duplicate', 'Duplicate')}
                onClick={() => {
                    if (selectedSlideIds.length > 1 && selectedSlideIds.includes(contextMenu.slideId)) {
                        duplicateSlides(contextMenu.presentationId, selectedSlideIds);
                    } else {
                        duplicateSlide(contextMenu.presentationId, contextMenu.slideId);
                    }
                    onClose();
                }}
                shortcut="CMD+D"
            />

            <div className="h-px bg-white/5 my-1" />

            {/* Detach Nested (for linked/master slides) */}
            {(() => {
                if (!currentSlide) return null;
                const isNormal = currentSlide.type === 'normal';
                const isNested = currentSlide.type === 'nested';
                const linkedId = isNormal ? (currentSlide as ICanvasSlide).linkedPresentationId : (isNested ? (currentSlide as INestedSlide).presentationId : undefined);
                const masterId = isNormal ? (currentSlide as ICanvasSlide).masterPresentationId : undefined;

                if (currentSlide.type === 'hymn') {
                    const hymnSlide = currentSlide as IHymnSlide;
                    return (
                        <>
                            <ContextMenuItem
                                icon={<Palette className="w-4 h-4" />}
                                label={t('edit_hymn_theme', 'Edit Hymn Theme')}
                                onClick={async () => {
                                    const sId = contextMenu.slideId;
                                    const pId = activePresentationId || contextMenu.presentationId;
                                    onClose();
                                    const effectiveThemeId = await resolveEffectiveThemeId(undefined, hymnSlide.themeId);
                                    await loadHymnTheme(effectiveThemeId, { presentationId: pId, slideId: sId });
                                    setSlideDesignPanelOpen(true);
                                }}
                            />
                            <ContextMenuItem
                                icon={<Unplug className="w-4 h-4" />}
                                label={t('detach_hymn', 'Detach Hymn Slide')}
                                onClick={async () => {
                                    const sId = contextMenu.slideId;
                                    onClose();
                                    const pId = activePresentationId;
                                    if (!pId) return;
                                    const res = await detachHymnSlide(pId, sId);
                                    if (res.requiresAudioConfirmation) {
                                        const confirmed = window.confirm(
                                            t(
                                                'detach_hymn_audio_warning',
                                                'This slide is part of a multi-verse or global audio track. Detaching it will unbind the audio from this slide. Continue?'
                                            )
                                        );
                                        if (confirmed) {
                                            await detachHymnSlide(pId, sId, true);
                                        }
                                    }
                                }}
                            />
                        </>
                    );
                }

                if (linkedId || masterId) {
                    return (
                        <ContextMenuItem
                            icon={<Unplug className="w-4 h-4" />}
                            label={t('detach_nested', 'Detach Nested')}
                            onClick={() => {
                                detachNestedInstance(contextMenu.slideId);
                                onClose();
                            }}
                        />
                    );
                }
                return null;
            })()}

            <ContextMenuItem
                icon={<ArrowLeft className="w-4 h-4" />}
                label={t('move_back', 'Move Back')}
                disabled={selectedSlideIds.length > 1}
                onClick={() => {
                    moveSlide(contextMenu.presentationId, contextMenu.slideId, 'back');
                    onClose();
                }}
            />
            <ContextMenuItem
                icon={<ArrowRight className="w-4 h-4" />}
                label={t('move_forth', 'Move Forth')}
                disabled={selectedSlideIds.length > 1}
                onClick={() => {
                    moveSlide(contextMenu.presentationId, contextMenu.slideId, 'forth');
                    onClose();
                }}
            />
            <ContextMenuItem
                icon={<ChevronsLeft className="w-4 h-4" />}
                label={t('move_to_start', 'Move to Start')}
                disabled={selectedSlideIds.length > 1}
                onClick={() => {
                    moveSlide(contextMenu.presentationId, contextMenu.slideId, 'start');
                    onClose();
                }}
            />
            <ContextMenuItem
                icon={<ChevronsRight className="w-4 h-4" />}
                label={t('move_to_end', 'Move to End')}
                disabled={selectedSlideIds.length > 1}
                onClick={() => {
                    moveSlide(contextMenu.presentationId, contextMenu.slideId, 'end');
                    onClose();
                }}
            />

            <div className="h-px bg-white/5 my-1" />

            <ContextMenuItem
                icon={<Trash2 className="w-4 h-4" />}
                label={selectedSlideIds.length > 1 ? t('delete_multiple', 'Delete Selected') : t('delete', 'Delete')}
                danger
                onClick={() => {
                    if (selectedSlideIds.length > 1) {
                        removeSlides(contextMenu.presentationId, selectedSlideIds);
                    } else {
                        removeSlide(contextMenu.presentationId, contextMenu.slideId);
                    }
                    onClose();
                }}
                shortcut="Delete"
            />
        </ContextMenu>
    );
};

