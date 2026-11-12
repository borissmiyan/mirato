import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { Save, Share2, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/ui';

import { Modal, ModalFooter } from '@/shared/ui/modals/Modal';

const SaveNestedConfirmModal: React.FC = () => {
    const { t } = useTranslation();
    const closeModal = useModalStore(s => s.closeModal);
    // Find the LAST instance to correctly support nested modals
    const modalData = useModalStore(
        useShallow(s => [...s.stack].reverse().find(m => m.id === ModalType.SAVE_NESTED_CONFIRM))
    );
    const isOpen = !!modalData;

    const saveNestedChanges = usePresentationStore(s => s.saveNestedChanges);

    if (!isOpen) return null;

    const handleUpdateOriginal = async () => {
        await saveNestedChanges({ syncBack: true });
        closeModal(ModalType.SAVE_NESTED_CONFIRM);
    };

    const handleKeepLocal = async () => {
        await saveNestedChanges({ syncBack: false });
        closeModal(ModalType.SAVE_NESTED_CONFIRM);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => closeModal(ModalType.SAVE_NESTED_CONFIRM)}
            size="md"
            zIndex={10002}
        >
            <div className="px-6 py-6 flex flex-col items-center text-center space-y-4">
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                    <AlertCircle className="w-7 h-7 text-accent" />
                </div>

                <div>
                    <h2 className="text-lg font-bold text-white tracking-tight uppercase">
                        {t('save_nested_title', 'Update Nested Presentations?')}
                    </h2>
                    <p className="text-stone-400 text-xs mt-1.5 font-medium leading-relaxed">
                        {t('save_nested_desc', "You've edited nested presentations. Do you want to update the original library files or keep these changes only in this presentation?")}
                    </p>
                </div>

                <div className="w-full space-y-2 mt-2 select-none">
                    <button
                        type="button"
                        onClick={handleUpdateOriginal}
                        className="w-full group flex items-center gap-3.5 p-3 rounded-xl bg-accent/10 border border-accent/20 hover:bg-accent/20 hover:border-accent/40 transition-all text-left cursor-pointer apple-press"
                    >
                        <div className="w-9 h-9 rounded-xl bg-accent/20 text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Save className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="block text-xs font-bold text-white uppercase tracking-wider">
                                {t('update_original', 'Update Original')}
                            </span>
                            <span className="text-[10px] text-accent/70 font-bold uppercase tracking-widest">
                                {t('update_original_desc', 'Sync changes back to library')}
                            </span>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={handleKeepLocal}
                        className="w-full group flex items-center gap-3.5 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left cursor-pointer apple-press"
                    >
                        <div className="w-9 h-9 rounded-xl bg-stone-800 text-stone-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Share2 className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="block text-xs font-bold text-white uppercase tracking-wider">
                                {t('keep_local_only', 'Only for this presentation')}
                            </span>
                            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                                {t('keep_local_only_desc', 'Changes stay only in this workflow')}
                            </span>
                        </div>
                    </button>
                </div>
            </div>

            <ModalFooter>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => closeModal(ModalType.SAVE_NESTED_CONFIRM)}
                >
                    {t('cancel', 'Cancel')}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default SaveNestedConfirmModal;
