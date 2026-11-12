import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtom } from 'jotai';
import { importCollisionModalAtom } from '@/core/store/uiAtoms';
import { AlertTriangle, CheckCircle2, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { db } from '@/core/db';
import { Button, IconButton } from '@/shared/ui';
import { hymnLibraryService } from '../../services/hymnLibraryService';

export const ImportCollisionModal: React.FC = () => {
    const { t } = useTranslation();
    const [modalState, setModalState] = useAtom(importCollisionModalAtom);
    const { isOpen, existingId, newDirName } = modalState;
    
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen || !existingId || !newDirName) return null;

    const electron = window.electron;
    const hymnsApi = electron?.ipcRenderer?.hymns;

    const handleClose = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            // Cancel means we rollback the imported folder
            if (hymnsApi) await hymnsApi.removeCustom(newDirName);
            setModalState({ isOpen: false, existingId: null, newDirName: null });
        } catch (e) {
            console.error('Failed to rollback conflicting folder', e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirm = async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const existingHymnal = await db.hymnals.get(existingId);
            if (existingHymnal) {
                // Remove the old hymnal. skipAudioConfirmation = true because we are replacing it.
                await hymnLibraryService.removeCustomHymnal(existingHymnal, true);
            }
            // Now sync file system to register the new one
            await hymnLibraryService.syncFileSystemHymnals();
            setModalState({ isOpen: false, existingId: null, newDirName: null });
        } catch (e) {
            console.error('Failed to replace hymnal:', e);
        } finally {
            setIsProcessing(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center apple-backdrop bg-stone-950/75 backdrop-blur-xl p-4 z-[10020]">
            <div className="bg-stone-900 border border-white/10 ring-1 ring-white/5 rounded-2xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl apple-modal">
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            Конфликт сборников
                        </h3>
                    </div>
                    <IconButton
                        icon={X}
                        label={t('cancel', 'Отмена')}
                        variant="ghost"
                        size="xs"
                        onClick={handleClose}
                        disabled={isProcessing}
                    />
                </div>

                <div className="px-6 py-6">
                    <p className="text-sm text-stone-400 font-medium leading-relaxed mb-4">
                        Сборник с таким ID уже установлен. Вы хотите заменить его новым? 
                    </p>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        <div className="text-xs text-amber-200/80 leading-relaxed">
                            <p>Старая версия будет удалена, а новая добавлена.</p>
                            <p className="mt-1">Гимны в существующих служениях автоматически переключатся на новую версию, если структура файлов не изменилась.</p>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-stone-950/50 border-t border-white/5 flex justify-end gap-2">
                    <Button 
                        variant="ghost" 
                        size="xs" 
                        onClick={handleClose} 
                        disabled={isProcessing}
                        className="text-[10px] font-bold uppercase tracking-widest"
                    >
                        {t('cancel', 'Отмена')}
                    </Button>
                    <Button 
                        variant="primary" 
                        size="xs" 
                        onClick={handleConfirm} 
                        disabled={isProcessing}
                        loading={isProcessing}
                        leftIcon={!isProcessing ? <CheckCircle2 className="w-3.5 h-3.5" /> : undefined}
                        className="text-[10px] font-bold uppercase tracking-widest px-4"
                    >
                        <span>Заменить</span>
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};
