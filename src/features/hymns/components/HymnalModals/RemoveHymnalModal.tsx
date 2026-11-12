import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAtom } from 'jotai';
import { removeHymnalModalAtom } from '@/core/store/uiAtoms';
import { AlertTriangle, CheckCircle2, X, Loader2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { hymnLibraryService, OrphanedSlidesResult } from '../../services/hymnLibraryService';
import { toast } from 'sonner';
import { Button, IconButton } from '@/shared/ui';

export const RemoveHymnalModal: React.FC = () => {
    const { t } = useTranslation();
    const [modalState, setModalState] = useAtom(removeHymnalModalAtom);
    const { isOpen, hymnal } = modalState;
    
    const [isChecking, setIsChecking] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [orphans, setOrphans] = useState<OrphanedSlidesResult | null>(null);

    const checkOrphans = useCallback(() => {
        if (!hymnal) return;
        let isMounted = true;
        setIsChecking(true);
        setHasError(false);
        setOrphans(null);
        
        hymnLibraryService.checkOrphanedSlides(hymnal.id)
            .then(res => {
                if (isMounted) setOrphans(res);
            })
            .catch(err => {
                console.error('Failed to check orphaned slides:', err);
                if (isMounted) setHasError(true);
            })
            .finally(() => {
                if (isMounted) setIsChecking(false);
            });
            
        return () => { isMounted = false; };
    }, [hymnal]);

    useEffect(() => {
        if (isOpen && hymnal) {
            return checkOrphans();
        }
    }, [isOpen, hymnal, checkOrphans]);

    if (!isOpen || !hymnal) return null;

    const handleClose = () => {
        if (isRemoving) return;
        setModalState({ isOpen: false, hymnal: null });
    };

    const handleConfirm = async () => {
        if (isRemoving || (!orphans && !hasError)) return;
        
        if (hasError) {
            // Retry checking instead of removing
            checkOrphans();
            return;
        }

        setIsRemoving(true);
        try {
            await hymnLibraryService.removeCustomHymnal(hymnal, true, orphans!);
            toast.success(t('hymns.removed_title', 'Сборник удалён'), {
                description: t('hymns.removed_desc', { name: hymnal.name, defaultValue: `Сборник ${hymnal.name} был успешно удалён.` })
            });
            handleClose();
        } catch (error) {
            console.error('Failed to remove hymnal:', error);
            toast.error(t('hymns.remove_error_title', 'Ошибка при удалении сборника'), {
                description: t('hymns.remove_error_desc', 'Не удалось завершить операцию. Подробности в консоли.')
            });
        } finally {
            setIsRemoving(false);
        }
    };

    const hasOrphans = orphans && orphans.slideCount > 0;

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center apple-backdrop bg-stone-950/75 backdrop-blur-xl p-4 z-[10020]">
            <div className="bg-stone-900 border border-white/10 ring-1 ring-white/5 rounded-2xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl apple-modal">
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-red-500" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            {t('hymns.delete_modal_title', 'Удаление сборника')}
                        </h3>
                    </div>
                    <IconButton
                        icon={X}
                        label={t('cancel', 'Отмена')}
                        variant="ghost"
                        size="xs"
                        onClick={handleClose}
                        disabled={isRemoving}
                    />
                </div>

                <div className="px-6 py-6">
                    <p className="text-sm text-stone-400 font-medium leading-relaxed mb-4">
                        {t('hymns.delete_confirm_text', { name: hymnal.name, defaultValue: `Вы уверены, что хотите удалить сборник ${hymnal.name}?` })}
                    </p>
                    
                    {isChecking ? (
                        <div className="flex items-center gap-2 text-stone-500 text-xs">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{t('hymns.checking_usage', 'Проверка использования...')}</span>
                        </div>
                    ) : hasError ? (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 mt-4">
                            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                            <div className="text-xs text-red-200 leading-relaxed">
                                <p className="font-bold mb-1 text-red-400 uppercase tracking-wider">{t('hymns.check_error_title', 'Ошибка проверки')}</p>
                                <p>{t('hymns.check_error_desc', 'Не удалось проверить, используется ли этот сборник в служениях.')}</p>
                            </div>
                        </div>
                    ) : (hasOrphans && orphans) ? (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 mt-4">
                            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                            <div className="text-xs text-red-200 leading-relaxed">
                                <p className="font-bold mb-1 text-red-400 uppercase tracking-wider">{t('hymns.warning_title', 'Внимание')}</p>
                                <p>{t('hymns.remove_warning_count', { services: orphans.serviceCount, slides: orphans.slideCount, defaultValue: `Этот сборник используется в ${orphans.serviceCount} служениях (${orphans.slideCount} слайдов).` })}</p>
                                <p className="mt-1 opacity-80">{t('hymns.remove_warning_unlinked', 'При удалении эти гимны будут автоматически откреплены от служений.')}</p>
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="px-6 py-4 bg-stone-950/50 border-t border-white/5 flex justify-end gap-2">
                    <Button 
                        variant="ghost" 
                        size="xs" 
                        onClick={handleClose} 
                        disabled={isRemoving}
                        className="text-[10px] font-bold uppercase tracking-widest"
                    >
                        {t('cancel', 'Отмена')}
                    </Button>
                    {hasError ? (
                        <Button 
                            variant="secondary" 
                            size="xs" 
                            onClick={handleConfirm} 
                            disabled={isChecking || isRemoving}
                            className="text-[10px] font-bold uppercase tracking-widest px-4"
                        >
                            <span>{t('hymns.retry_check', 'Повторить проверку')}</span>
                        </Button>
                    ) : (
                        <Button 
                            variant="danger" 
                            size="xs" 
                            onClick={handleConfirm} 
                            disabled={isChecking || isRemoving}
                            loading={isRemoving}
                            leftIcon={!isRemoving ? <Trash2 className="w-3.5 h-3.5" /> : undefined}
                            className="text-[10px] font-bold uppercase tracking-widest px-4"
                        >
                            <span>{t('hymns.delete_hymnal_btn', 'Удалить сборник')}</span>
                        </Button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
