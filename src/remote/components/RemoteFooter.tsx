import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, BookOpen } from 'lucide-react';

interface RemoteFooterProps {
    mode: 'slides' | 'bible' | 'timeline';
    setMode: (mode: 'slides' | 'bible' | 'timeline') => void;
}

export const RemoteFooter: React.FC<RemoteFooterProps> = ({ mode, setMode }) => {
    const { t } = useTranslation();

    return (
        <div className="shrink-0 flex items-center gap-1.5 p-1.5 bg-stone-900/80 rounded-2xl border border-white/10 mt-auto backdrop-blur-2xl shadow-2xl relative z-20 mb-2 pb-safe">
            <button
                type="button"
                onClick={() => setMode('slides')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all cursor-pointer apple-press ${mode === 'slides' || mode === 'timeline' ? 'bg-accent text-accent-foreground font-bold shadow-lg shadow-accent/20' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
            >
                <span className="shrink-0"><Layers size={18} fill={mode === 'slides' || mode === 'timeline' ? 'currentColor' : 'none'} /></span>
                <span className="text-[11px] font-bold uppercase tracking-widest">{t('remote.slides')}</span>
            </button>
            <button
                type="button"
                onClick={() => setMode('bible')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all cursor-pointer apple-press ${mode === 'bible' ? 'bg-accent text-accent-foreground font-bold shadow-lg shadow-accent/20' : 'text-stone-400 hover:text-white hover:bg-white/5'}`}
            >
                <span className="shrink-0"><BookOpen size={18} fill={mode === 'bible' ? 'currentColor' : 'none'} /></span>
                <span className="text-[11px] font-bold uppercase tracking-widest">{t('remote.bible')}</span>
            </button>
        </div>
    );
};
