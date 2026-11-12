import React from 'react';
import { useTranslation } from 'react-i18next';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
import { Button } from '@/shared/ui/Button';

interface ConfirmModalProps {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
    onSelection: (confirmed: boolean) => void;
    [key: string]: unknown;
}

const ConfirmModal: React.FC = () => {
    const { t } = useTranslation();
    const closeModal = useModalStore(s => s.closeModal);
    const { modalData, stackIndex } = useModalStore(
        useShallow(s => {
            for (let i = s.stack.length - 1; i >= 0; i--) {
                if (s.stack[i].id === ModalType.CONFIRM) {
                    return { modalData: s.stack[i], stackIndex: i };
                }
            }
            return { modalData: undefined, stackIndex: -1 };
        })
    );
    const isOpen = !!modalData;
    const props = modalData?.props as ConfirmModalProps;

    if (!isOpen || !props) return null;

    const handleConfirm = () => {
        if (typeof props.onSelection === 'function') {
            props.onSelection(true);
        }
        closeModal(ModalType.CONFIRM);
    };

    const handleCancel = () => {
        if (typeof props.onSelection === 'function') {
            props.onSelection(false);
        }
        closeModal(ModalType.CONFIRM);
    };

    const zIndex = 10010 + stackIndex * 10;

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleCancel}
            size="sm"
            zIndex={zIndex}
        >
            <ModalHeader
                title={props.title}
                icon={
                    <AlertTriangle
                        className={cn(
                            "w-5 h-5",
                            props.variant === 'danger' ? "text-red-500" : "text-amber-500"
                        )}
                    />
                }
                onClose={handleCancel}
            />

            <ModalBody>
                <p className="text-sm text-stone-300 font-medium leading-relaxed">
                    {props.message}
                </p>
            </ModalBody>

            <ModalFooter>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancel}
                >
                    {props.cancelLabel || t('cancel', 'Cancel')}
                </Button>
                <Button
                    autoFocus
                    size="sm"
                    variant={props.variant === 'danger' ? 'danger' : 'primary'}
                    onClick={handleConfirm}
                    className="gap-2"
                >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{props.confirmLabel || t('confirm', 'Confirm')}</span>
                </Button>
            </ModalFooter>
        </Modal>
    );
};

export default ConfirmModal;
