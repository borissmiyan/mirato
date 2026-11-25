import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder } from 'lucide-react';
import { IPresentationFile } from '@/core/types';
import { cn } from '@/core/utils/cn';
import { CustomSlideStackIcon, VirtualList } from '@/shared/ui';

export interface PresentationPickerListProps {
    searchQuery: string;
    availablePresentations: IPresentationFile[];
    selectedPresentationId: string | null;
    onSelectPresentation: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, presentation: IPresentationFile) => void;
}

/**
 * Virtualized presentation list rendered inside PickerModalShell's sidebarBody.
 * Styled identically to HymnPickerList for consistent navigation across all pickers.
 */
export const PresentationPickerSidebar: React.FC<PresentationPickerListProps> = ({
    searchQuery,
    availablePresentations,
    selectedPresentationId,
    onSelectPresentation,
    onContextMenu,
}) => {
    const { t } = useTranslation();

    const getItemKey = useCallback((p: IPresentationFile) => p.id, []);

    const renderPresentation = useCallback((p: IPresentationFile) => {
        const isSelected = selectedPresentationId === p.id;
        const slidesCount = p.slides?.length ?? 0;

        return (
            <button
                type="button"
                onClick={() => onSelectPresentation(p.id)}
                onContextMenu={(e) => onContextMenu(e, p)}
                className={cn(
                    'w-full h-[54px] flex items-center gap-2.5 text-left px-2.5 rounded-xl border transition-colors duration-150 group relative shrink-0 cursor-pointer',
                    isSelected
                        ? 'bg-stone-800 border-stone-600 text-stone-100'
                        : 'bg-[#1f1c1a] border-stone-800/90 hover:bg-[#262320] hover:border-stone-700'
                )}
            >
                <div
                    className={cn(
                        'w-11 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border transition-colors',
                        isSelected
                            ? 'bg-accent text-stone-950 border-accent'
                            : 'bg-stone-950 border-stone-800 text-stone-400 group-hover:text-stone-200'
                    )}
                >
                    {p.thumbnailUrl ? (
                        <img src={p.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <CustomSlideStackIcon className="w-3.5 h-3.5" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <p
                        className={cn(
                            'text-[13px] font-semibold truncate leading-snug transition-colors',
                            isSelected ? 'text-stone-100' : 'text-stone-300 group-hover:text-white'
                        )}
                    >
                        {p.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-stone-500 min-w-0">
                        <span className="inline-flex items-center gap-1 shrink-0 tabular-nums text-stone-400/75">
                            <CustomSlideStackIcon className="w-3 h-3 opacity-70 shrink-0" />
                            <span>{slidesCount}</span>
                        </span>
                        {p.binId && (
                            <span className="inline-flex items-center gap-1 text-stone-500 truncate">
                                <Folder className="w-2.5 h-2.5 shrink-0" />
                            </span>
                        )}
                    </div>
                </div>
            </button>
        );
    }, [selectedPresentationId, onSelectPresentation, onContextMenu]);

    return (
        <VirtualList
            items={availablePresentations}
            getItemKey={getItemKey}
            renderItem={renderPresentation}
            itemHeight={60}
            gap={6}
            overscan={14}
            resetKey={searchQuery}
            className="px-3 py-2.5"
            emptyState={
                <div className="text-center py-16 flex flex-col items-center justify-center gap-3 text-stone-500">
                    <CustomSlideStackIcon className="w-8 h-8 opacity-20" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                        {t('no_presentations_found', 'No presentations found')}
                    </span>
                </div>
            }
        />
    );
};

export default PresentationPickerSidebar;
