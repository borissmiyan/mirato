import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Layers, Folder } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { IPresentationFile } from '@/core/types';
import { cn } from '@/core/utils/cn';
import IconButton from '@/shared/ui/IconButton';
import SearchInput from '@/shared/ui/SearchInput';
import Badge from '@/shared/ui/Badge';

export interface PresentationPickerSidebarProps {
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    onClose: () => void;
    availablePresentations: IPresentationFile[];
    selectedPresentationId: string | null;
    onSelectPresentation: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, presentation: IPresentationFile) => void;
}

/**
 * Sidebar component for selecting presentations inside PresentationPickerModal with virtual scrolling.
 */
export const PresentationPickerSidebar: React.FC<PresentationPickerSidebarProps> = ({
    searchQuery,
    onSearchQueryChange,
    onClose,
    availablePresentations,
    selectedPresentationId,
    onSelectPresentation,
    onContextMenu,
}) => {
    const { t } = useTranslation();
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: availablePresentations.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 84,
        overscan: 5,
    });

    return (
        <div className="w-80 shrink-0 border-r border-white/5 bg-stone-900/50 flex flex-col z-20">
            <div className="p-6 border-b border-white/5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">
                        {t('store')}
                    </h2>
                    <IconButton
                        icon={<X className="w-4 h-4" />}
                        onClick={onClose}
                        variant="subtle"
                        size="sm"
                        label={t('close', 'Close')}
                    />
                </div>

                <SearchInput
                    value={searchQuery}
                    onChange={(e) => onSearchQueryChange(e.target.value)}
                    placeholder={t('search_presentations', 'Search presentations...')}
                    autoFocus
                />
            </div>

            <div ref={parentRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {availablePresentations.length > 0 ? (
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const p = availablePresentations[virtualRow.index];
                            if (!p) return null;
                            const isSelected = selectedPresentationId === p.id;
                            const slidesCount = p.slides?.length ?? 0;

                            return (
                                <div
                                    key={p.id}
                                    data-index={virtualRow.index}
                                    ref={rowVirtualizer.measureElement}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                        paddingBottom: '8px',
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onSelectPresentation(p.id)}
                                        onContextMenu={(e) => onContextMenu(e, p)}
                                        className={cn(
                                            "w-full flex flex-col text-left p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden shrink-0 apple-press cursor-pointer",
                                            isSelected
                                                ? "bg-accent/10 border-accent/30 shadow-[0_0_20px_rgba(234,179,8,0.15)] ring-1 ring-accent/30"
                                                : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div
                                                className={cn(
                                                    "w-12 h-8 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-black/50 border border-white/10 transition-colors",
                                                    isSelected ? "border-accent/50 text-accent" : "text-stone-400 group-hover:text-stone-300"
                                                )}
                                            >
                                                {p.thumbnailUrl ? (
                                                    <img src={p.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Layers className="w-4 h-4" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p
                                                    className={cn(
                                                        "text-xs font-bold truncate transition-colors",
                                                        isSelected ? "text-white" : "text-stone-300 group-hover:text-white"
                                                    )}
                                                >
                                                    {p.name}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <Badge variant={isSelected ? 'accent' : 'neutral'} size="sm">
                                                {t('slides_count', { count: slidesCount, defaultValue: `${slidesCount} slides` })}
                                            </Badge>
                                            {p.binId && (
                                                <div className="flex items-center gap-1 text-stone-600">
                                                    <Folder className="w-3 h-3" />
                                                    <span className="text-[8px] font-bold uppercase tracking-wider truncate max-w-[80px]">Bin</span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10 flex flex-col items-center justify-center gap-3 text-stone-500">
                        <Layers className="w-8 h-8 opacity-20" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{t('no_presentations_found', 'No presentations found')}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PresentationPickerSidebar;
