import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Verse } from '@/core/types';
import { Save, X, Edit3, Keyboard } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui';

interface VerseEditorProps {
    verse: Verse;
    onSave: (newText: string) => void;
    onCancel: () => void;
}

const VerseEditor: React.FC<VerseEditorProps> = ({ verse, onSave, onCancel }) => {
    const { t } = useTranslation();
    const [text, setText] = useState(verse.text);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [text]);

    const handleSave = useCallback(() => {
        onSave(text);
    }, [onSave, text]);

    const handleCancel = useCallback(() => {
        onCancel();
    }, [onCancel]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Stop event from bubbling to global listeners
        e.nativeEvent.stopImmediatePropagation();
        e.stopPropagation();

        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    }, [handleSave, handleCancel]);

    return (
        <div className="w-full p-6 bg-stone-900/60 backdrop-blur-xl border-b border-white/5 animate-in slide-in-from-left-2 fade-in duration-300">
            <div className="flex gap-6">
                {/* Verse Number Indicator */}
                <div className="flex flex-col items-center min-w-8 pt-1">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center border border-accent/20 mb-2">
                        <span className="text-xs font-black text-accent">{verse.verseNumber}</span>
                    </div>
                    <div className="w-px flex-1 bg-linear-to-b from-accent/20 to-transparent" />
                </div>

                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-stone-500">
                            <Edit3 className="w-3.5 h-3.5" />
                            <span className="text-[10px] uppercase font-bold tracking-[0.2em] whitespace-nowrap">
                                {t('editing_verse')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 opacity-40 ml-5">
                            <span className="text-[9px] font-bold text-stone-500 uppercase flex items-center gap-1 whitespace-nowrap">
                                <Keyboard className="w-3 h-3" />
                                {t('cmd_enter_to_save')}
                            </span>
                        </div>
                    </div>

                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={cn(
                            "w-full bg-stone-950/50 text-stone-100 font-serif text-lg leading-relaxed p-4 rounded-xl",
                            "border border-white/5 focus:border-accent/40 focus:ring-4 focus:ring-accent/5 outline-none",
                            "resize-none overflow-hidden transition-all duration-300 placeholder:text-stone-700"
                        )}
                        placeholder={t('verse_text_placeholder')}
                        autoFocus
                        rows={1}
                    />

                    <div className="flex gap-2 mt-2">
                        <Button
                            variant="primary"
                            onClick={handleSave}
                            title={t('save_changes')}
                            aria-label={t('save_changes')}
                            className="flex-1 h-10 shadow-lg shadow-accent/10 whitespace-nowrap"
                        >
                            <Save className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleCancel}
                            title={t('cancel')}
                            aria-label={t('cancel')}
                            className="flex-1 h-10 text-stone-500 hover:text-stone-200 group whitespace-nowrap"
                        >
                            <X className="w-5 h-5 transition-transform group-hover:rotate-90" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerseEditor;
