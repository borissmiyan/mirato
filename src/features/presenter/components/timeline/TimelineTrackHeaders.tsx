import React from 'react';
import { Music } from 'lucide-react';
import { TFunction } from 'i18next';
import { cn } from '@/core/utils/cn';
import { CustomSlideStackIcon } from './TimelineIcons';

interface TimelineTrackHeadersProps {
    t: TFunction;
    hasSlides: boolean;
    type?: 'slides' | 'audio' | 'both';
    className?: string;
}

export const TimelineTrackHeaders: React.FC<TimelineTrackHeadersProps> = ({ t, hasSlides, type = 'both', className }) => {
    const showSlides = type === 'slides' || type === 'both';
    const showAudio = (type === 'audio' || type === 'both') && (hasSlides || type === 'audio');

    return (
        <div className={cn(
"w-20 shrink-0 flex flex-col z-30 bg-stone-950 border-r border-white/5",
            className
        )}>
            {/* Slide Track Label */}
            {showSlides && (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                    <CustomSlideStackIcon className="w-4 h-4 mb-0.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('slides', 'Slides')}</span>
                </div>
            )}

            {/* Audio Track Label */}
            {showAudio && (
                <div className="shrink-0 h-[88px] flex flex-col items-center justify-center gap-1 border-t border-white/5 bg-purple-500/10 text-purple-200/60 hover:text-purple-100 hover:bg-purple-500/20 transition-all">
                    <Music className="w-4 h-4 mb-0.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{t('audio', 'Audio')}</span>
                </div>
            )}
        </div>
    );
};
