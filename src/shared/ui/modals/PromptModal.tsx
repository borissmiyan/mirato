import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { useShallow } from 'zustand/react/shallow';
import { CheckCircle2 } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';

interface PromptModalProps {
    title: string;
    defaultValue?: string;
    type?: 'text' | 'password';
    onSelection: (value: string | null) => void;
    [key: string]: unknown;
}

const PromptModal: React.FC = () => {
    const { t } = useTranslation();
    const closeModal = useModalStore(s => s.closeModal);
    const { modalData, stackIndex } = useModalStore(
        useShallow(s => {
            for (let i = s.stack.length - 1; i >= 0; i--) {
                if (s.stack[i].id === ModalType.PROMPT) {
                    return { modalData: s.stack[i], stackIndex: i };
                }
            }
            return { modalData: undefined, stackIndex: -1 };
        })
    );
    const isOpen = !!modalData;
    const props = modalData?.props as PromptModalProps;

    const [value, setValue] = useState(props?.defaultValue || '');

    // Reset local state when modal data changes
    React.useEffect(() => {
        if (props?.defaultValue !== undefined) {
            setValue(props.defaultValue);
        } else {
            setValue('');
        }
    }, [props?.defaultValue, isOpen]);

    if (!isOpen || !props) return null;

    const handleConfirm = () => {
        if (typeof props.onSelection === 'function') {
            props.onSelection(value);
        }
        closeModal(ModalType.PROMPT);
    };

    const handleCancel = () => {
        if (typeof props.onSelection === 'function') {
            props.onSelection(null);
        }
        closeModal(ModalType.PROMPT);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleConfirm();
        if (e.key === 'Escape') handleCancel();
    };

    const zIndex = 10010 + stackIndex * 10;

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleCancel}
            size="sm"
            zIndex={zIndex}
        >
            <div onKeyDown={handleKeyDown}>
                <ModalHeader
                    title={props.title}
                    onClose={handleCancel}
                />

                <ModalBody>
                    <Input
                        autoFocus
                        size="sm"
                        type={props.type || 'text'}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={t('type_here', 'Type here...')}
                    />
                </ModalBody>

                <ModalFooter>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancel}
                    >
                        {t('cancel', 'Cancel')}
                    </Button>
                    <Button
                        size="sm"
                        variant="primary"
                        onClick={handleConfirm}
                        className="gap-2"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('confirm', 'Confirm')}</span>
                    </Button>
                </ModalFooter>
            </div>
        </Modal>
    );
};

export default PromptModal;
