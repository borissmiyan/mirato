import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { AlertCircle, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui';

import { Modal, ModalBody, ModalFooter } from '@/shared/ui/modals/Modal';
import { IAudioScope } from '@/core/types';

interface AudioConflictModalProps {
    targetSlideId: string;
    fileId: string;
    fileName?: string;
    overlappingScopes: IAudioScope[];
    [key: string]: unknown;
}

const AudioConflictModal: React.FC = () => {
    const { t } = useTranslation();
    const closeModal = useModalStore(s => s.closeModal);
    const modalData = useModalStore(
        useShallow(s => [...s.stack].reverse().find(m => m.id === ModalType.AUDIO_CONFLICT))
    );
    const isOpen = !!modalData;

    const resolveAudioConflict = usePresentationStore(s => s.resolveAudioConflict);

    if (!isOpen) return null;

    const props = (modalData.props ?? {}) as AudioConflictModalProps;
    const { targetSlideId = '', fileId = '', fileName, overlappingScopes = [] } = props;

    const handleReplace = async () => {
        await resolveAudioConflict('replace', { targetSlideId, fileId, fileName, overlappingScopes });
        closeModal(ModalType.AUDIO_CONFLICT);
    };

    const handleShift = async () => {
        await resolveAudioConflict('shift', { targetSlideId, fileId, fileName, overlappingScopes });
        closeModal(ModalType.AUDIO_CONFLICT);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => closeModal(ModalType.AUDIO_CONFLICT)}
            size="md"
            zIndex={10002}
        >
            <div className="px-6 py-6 flex flex-col items-center text-center space-y-4">
                <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <AlertCircle className="w-7 h-7 text-amber-500" />
                </div>

                <div>
                    <h2 className="text-lg font-bold text-white tracking-tight uppercase">
                        {t('audio_conflict_title', 'Audio Overlap Detected')}
                    </h2>
                    <p className="text-stone-400 text-xs mt-1.5 font-medium leading-relaxed">
                        {t('audio_conflict_desc', 'There is already an audio clip in this position. How would you like to proceed?')}
                    </p>
                </div>

                <div className="w-full space-y-2 mt-2 select-none">
                    <button
                        type="button"
                        onClick={handleReplace}
                        className="w-full group flex items-center gap-3.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 active:scale-[0.98] transition-all text-left cursor-pointer apple-press"
                    >
                        <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Trash2 className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="block text-xs font-bold text-white uppercase tracking-wider">
                                {t('replace_existing', 'Replace Existing')}
                            </span>
                            <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest opacity-80">
                                {t('replace_existing_desc', 'Delete overlapping clip(s)')}
                            </span>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={handleShift}
                        className="w-full group flex items-center gap-3.5 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/40 active:scale-[0.98] transition-all text-left cursor-pointer apple-press"
                    >
                        <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <ArrowRight className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="block text-xs font-bold text-white uppercase tracking-wider">
                                {t('place_and_move', 'Place and Move')}
                            </span>
                            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest opacity-80">
                                {t('place_and_move_desc', 'Shift existing clips forward')}
                            </span>
                        </div>
                    </button>
                </div>
            </div>

            <ModalFooter>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => closeModal(ModalType.AUDIO_CONFLICT)}
                >
                    {t('cancel', 'Cancel')}
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default AudioConflictModal;
