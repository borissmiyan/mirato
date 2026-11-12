import React from 'react';
import { Music } from 'lucide-react';

export interface ModalAudioScopeProps {
    scope: { fileName?: string; fileId?: string; id?: string };
    startIdx: number;
    endIdx: number;
    visualTimeline: Array<{ x: number; width: number }>;
}

export const ModalAudioScope: React.FC<ModalAudioScopeProps> = ({
    scope,
    startIdx,
    endIdx,
    visualTimeline,
}) => {
    const left = visualTimeline[startIdx]?.x || 0;
    const right = visualTimeline[endIdx] ? (visualTimeline[endIdx].x + visualTimeline[endIdx].width) : left;
    const width = right - left;

    if (width <= 0) return null;

    return (
        <div
            className="absolute top-0 h-10 bg-purple-500/20 border border-purple-500/30 rounded-xl flex items-center px-3 overflow-hidden backdrop-blur-sm shadow-lg shadow-purple-500/5 animate-in fade-in zoom-in-95 duration-300"
            style={{ left, width, marginTop: '8px' }}
        >
            <Music className="w-3.5 h-3.5 text-purple-400 mr-2 shrink-0" />
            <span className="text-[10px] font-black text-purple-100 truncate uppercase tracking-wider">
                {scope.fileName || 'Audio Track'}
            </span>
        </div>
    );
};

