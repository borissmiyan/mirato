import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtom } from 'jotai';
import { hymnalInstructionModalAtom } from '@/core/store/uiAtoms';
import { BookOpen, X, Download, FileJson, Music, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button, IconButton } from '@/shared/ui';

export const HymnalInstructionModal: React.FC = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useAtom(hymnalInstructionModalAtom);
    const [isGenerating, setIsGenerating] = useState(false);

    if (!isOpen) return null;

    const handleGenerateTemplate = async () => {
        setIsGenerating(true);
        try {
            const electron = window.electron;
            const hymnsApi = electron?.ipcRenderer?.hymns;
            if (!hymnsApi) throw new Error('Not running in Electron');
            
            const result = await hymnsApi.generateTemplate();
            
            if (result.canceled) {
                // User closed the dialog, do nothing
                return;
            }
            if (result.success) {
                toast.success('Шаблон сборника успешно создан', {
                    description: 'Папка с примером и инструкциями готова.'
                });
                setIsOpen(false);
            } else {
                toast.error('Ошибка', { description: 'Не удалось создать шаблон' });
            }
        } catch (e) {
            console.error(e);
            toast.error('Ошибка при генерации шаблона');
        } finally {
            setIsGenerating(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center apple-backdrop bg-stone-950/75 backdrop-blur-xl p-4 z-[10020]">
            <div className="bg-stone-900 border border-white/10 ring-1 ring-white/5 rounded-2xl w-full max-w-[480px] flex flex-col overflow-hidden shadow-2xl apple-modal">
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-accent" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            Создание сборника
                        </h3>
                    </div>
                    <IconButton
                        icon={X}
                        label={t('close', 'Закрыть')}
                        variant="ghost"
                        size="xs"
                        onClick={() => setIsOpen(false)}
                        disabled={isGenerating}
                    />
                </div>

                <div className="px-6 py-6 space-y-5">
                    <p className="text-sm text-stone-400 font-medium leading-relaxed">
                        Вы можете добавлять собственные сборники гимнов. Для этого необходимо подготовить папку со специальной структурой:
                    </p>
                    
                    <div className="p-4 bg-stone-950 border border-white/5 rounded-xl space-y-3 font-mono text-[11px] text-stone-300">
                        <div className="flex items-center gap-2 text-stone-100">
                            <BookOpen className="w-3.5 h-3.5 text-stone-500" />
                            <span>My-Custom-Hymnal/</span>
                        </div>
                        <div className="flex items-center gap-2 pl-4">
                            <FileJson className="w-3.5 h-3.5 text-blue-400" />
                            <span>hymnal.json</span>
                            <span className="text-stone-600 font-sans ml-2">— описание и оглавление</span>
                        </div>
                        <div className="flex items-center gap-2 pl-4">
                            <Music className="w-3.5 h-3.5 text-accent" />
                            <span>001-example/index.ektp</span>
                            <span className="text-stone-600 font-sans ml-2">— первый гимн</span>
                        </div>
                        <div className="flex items-center gap-2 pl-4">
                            <Music className="w-3.5 h-3.5 text-accent" />
                            <span>002-another/index.ektp</span>
                            <span className="text-stone-600 font-sans ml-2">— второй гимн</span>
                        </div>
                    </div>
                    
                    <div className="text-sm text-stone-400 font-medium leading-relaxed">
                        Мы рекомендуем скачать шаблон: он содержит правильный <code>hymnal.json</code> и пример гимна (упакованный <code>.ektp</code>).
                    </div>
                </div>

                <div className="px-6 py-4 bg-stone-950/50 border-t border-white/5 flex justify-between gap-2">
                    <Button 
                        variant="ghost" 
                        size="xs" 
                        onClick={() => setIsOpen(false)} 
                        disabled={isGenerating}
                        className="text-[10px] font-bold uppercase tracking-widest"
                    >
                        {t('close', 'Закрыть')}
                    </Button>
                    <Button 
                        variant="secondary" 
                        size="xs" 
                        onClick={handleGenerateTemplate} 
                        disabled={isGenerating}
                        loading={isGenerating}
                        leftIcon={!isGenerating ? <Download className="w-3.5 h-3.5" /> : undefined}
                        className="text-[10px] font-bold uppercase tracking-widest px-4"
                    >
                        <span>Скачать шаблон</span>
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};
