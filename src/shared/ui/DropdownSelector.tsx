import React, { useState, useRef, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import { SearchInput } from './SearchInput';
import { ScrollArea } from './ScrollArea';
import { cn } from '@/core/utils/cn';
import { sizeTokens, SizeToken, radiusTokens, colorTokens } from '@/shared/tokens';

export interface DropdownOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
    /** Optional extra search terms (e.g. English/Russian aliases or font name) */
    keywords?: string;
}

export interface DropdownSelectorProps {
    value: string;
    options: DropdownOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    icon?: React.ReactNode;
    size?: SizeToken;
    /** Enable an inline search bar at the top of the dropdown menu */
    searchable?: boolean;
    /** Placeholder for the inline search input when searchable is true */
    searchPlaceholder?: string;
    /** Optional custom rendering for the selected label */
    renderSelected?: (selected: DropdownOption | undefined) => React.ReactNode;
}

/**
 * A premium, high-fidelity replacement for the native <select> element.
 * Standardized via design tokens to match Button and Input heights and 4/8 grid.
 */
export const DropdownSelector: React.FC<DropdownSelectorProps> = ({
    value,
    options,
    onChange,
    placeholder,
    className,
    icon,
    size = 'sm',
    searchable = false,
    searchPlaceholder,
    renderSelected
}) => {
    const { t } = useTranslation();
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const triggerRef = useRef<HTMLButtonElement>(null);

    const activeOption = options.find(o => o.value === value);
    const displayPlaceholder = placeholder || t('select', 'Select...');

    const filteredOptions = useMemo(() => {
        if (!searchable || !searchQuery.trim()) return options;
        const q = searchQuery.trim().toLowerCase();
        return options.filter((opt) =>
            opt.label.toLowerCase().includes(q)
            || (opt.keywords && opt.keywords.toLowerCase().includes(q))
        );
    }, [options, searchable, searchQuery]);

    const token = sizeTokens[size] || sizeTokens.sm;
    const radiusClass = (size === 'xs' || size === 'sm') ? radiusTokens.md : radiusTokens.lg;

    const handleClose = () => {
        setMenuPos(null);
        setSearchQuery('');
    };

    const handleToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (menuPos) {
            handleClose();
        } else {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (rect) {
                setMenuPos({ x: rect.left, y: rect.bottom + 4 });
            }
        }
    };

    const leadingVisual = icon || (renderSelected ? undefined : activeOption?.icon);

    return (
        <div className="relative w-full">
            <button
                ref={triggerRef}
                type="button"
                onClick={handleToggle}
                className={cn(
                    "w-full bg-stone-950 border text-white flex items-center justify-between transition-colors",
                    colorTokens.border,
                    token.height,
                    token.px,
                    token.text,
                    radiusClass,
                    "hover:bg-stone-900 hover:border-white/20 group cursor-pointer outline-hidden focus-visible:ring-1 focus-visible:ring-accent/40",
                    menuPos && "border-accent/50 bg-stone-900 ring-1 ring-accent/20",
                    className
                )}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    {leadingVisual && (
                        <span className={cn(colorTokens.textSubtle, "group-hover:text-accent transition-colors shrink-0 flex items-center")}>
                            {leadingVisual}
                        </span>
                    )}
                    <div className="truncate font-semibold tracking-tight">
                        {renderSelected ? renderSelected(activeOption) : (activeOption?.label || displayPlaceholder)}
                    </div>
                </div>
                <ChevronDown className={cn(
                    "w-4 h-4 text-stone-500 transition-transform duration-200 shrink-0",
                    menuPos ? "rotate-180 text-accent" : "group-hover:text-stone-300"
                )} />
            </button>

            {menuPos && (
                <ContextMenu
                    x={menuPos.x}
                    y={menuPos.y}
                    onClose={handleClose}
                >
                    <div className="min-w-[220px] flex flex-col">
                        {searchable && (
                            <div
                                className="p-1.5 pb-2 border-b border-white/[0.06] mb-1"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <SearchInput
                                    size="xs"
                                    autoFocus
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onClear={() => setSearchQuery('')}
                                    placeholder={searchPlaceholder || t('search', 'Поиск...')}
                                />
                            </div>
                        )}

                        <ScrollArea wrapperClassName="max-h-[300px]" className="py-1">
                            {filteredOptions.length === 0 ? (
                                <div className="px-4 py-4 text-xs font-bold text-stone-500 uppercase tracking-wider text-center">
                                    {t('no_results', 'Ничего не найдено')}
                                </div>
                            ) : (
                                filteredOptions.map((option) => (
                                    <ContextMenuItem
                                        key={option.value}
                                        label={option.label}
                                        icon={option.icon}
                                        active={value === option.value}
                                        onClick={() => {
                                            onChange(option.value);
                                            handleClose();
                                        }}
                                    />
                                ))
                            )}
                        </ScrollArea>
                    </div>
                </ContextMenu>
            )}
        </div>
    );
};

export default DropdownSelector;
