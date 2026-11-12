import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { AlertTriangle, X, Trash2, AudioLines } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IAudioScope } from '@/core/types/audio';
import { toast } from 'sonner';
import { Button, IconButton } from '@/shared/ui';
import { hymnLibraryService } from '../../services/hymnLibraryService';

export const OrphanAudioScopesModal: React.FC = () => {
    const { t } = useTranslation();
    const isOpen = useModalStore(s => s.stack.some(m => m.id === ModalType.ORPHAN_AUDIO_SCOPES));
    const closeModal = useModalStore(s => s.closeModal);
    const [isRemoving, setIsRemoving] = useState<string | null>(null);

    const orphanScopes = useLiveQuery(() => db.audioScopes.filter(s => s.needsManualReview === true).toArray(), []) || [];
    const presentations = useLiveQuery(() => db.presentationFiles.toArray(), []) || [];

    if (!isOpen) return null;

    const handleClose = () => {
        closeModal(ModalType.ORPHAN_AUDIO_SCOPES);
    };

    const handleDeleteScope = async (scope: IAudioScope) => {
        setIsRemoving(scope.id);
        try {
            await db.transaction('rw', [db.audioScopes, db.presentationFiles], async () => {
                const oldPresentationId = scope.presentationId;
                await db.audioScopes.delete(scope.id);
                
                // Cleanup presentation if it's the last reference
                if (oldPresentationId) {
                    await hymnLibraryService.cleanupUnreferencedPresentation(oldPresentationId);
                }
            });
            toast.success('Аудио-клип удален', {
                description: 'Связь с аудио разорвана.'
            });
            
            if (orphanScopes.length <= 1) {
                handleClose();
            }
        } catch (error) {
            console.error('Failed to delete audio scope:', error);
            toast.error('Ошибка при удалении', {
                description: 'Не удалось завершить операцию. Подробности в консоли.'
            });
        } finally {
            setIsRemoving(null);
        }
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center apple-backdrop bg-stone-950/75 backdrop-blur-xl p-4 z-50">
            <div className="bg-stone-900 border border-white/10 ring-1 ring-white/5 rounded-2xl w-full max-w-lg flex flex-col overflow-hidden shadow-2xl apple-modal max-h-[85vh]">
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            {t('hymns.sync.orphan_badge', 'Ошибки аудио')}
                        </h3>
                    </div>
                    <IconButton
                        icon={X}
                        label={t('common.close', 'Закрыть')}
                        variant="ghost"
                        size="xs"
                        onClick={handleClose}
                    />
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <p className="text-sm text-stone-400 font-medium leading-relaxed mb-6">
                        {t('hymns.sync.orphan_scopes_description', 'После обновления сборника границы некоторых аудио-клипов не удалось перенести автоматически. Найдите их в таймлайне и удалите или перенастройте вручную.')}
                    </p>
                    
                    {orphanScopes.length === 0 ? (
                        <div className="text-center text-stone-500 py-8 text-sm">
                            Нет ошибок аудио для проверки.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {orphanScopes.map(scope => {
                                const presentation = presentations.find(p => p.id === scope.presentationId);
                                const contextName = presentation?.name || presentation?.metadata?.hymnTitle || scope.presentationId;
                                
                                return (
                                    <div key={scope.id} className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex shrink-0 items-center justify-center">
                                            <AudioLines className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white font-medium truncate">
                                                {contextName}
                                            </p>
                                            <p className="text-xs text-stone-500 truncate mt-0.5">
                                                ID: {scope.id}
                                            </p>
                                        </div>
                                        <IconButton
                                            icon={Trash2}
                                            label="Удалить привязку"
                                            variant="danger"
                                            size="xs"
                                            onClick={() => handleDeleteScope(scope)}
                                            disabled={isRemoving === scope.id}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-stone-950/50 border-t border-white/5 flex justify-end gap-2">
                    <Button
                        variant="secondary"
                        size="xs"
                        onClick={handleClose}
                        className="px-6 text-xs font-bold uppercase tracking-widest"
                    >
                        Закрыть
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};
