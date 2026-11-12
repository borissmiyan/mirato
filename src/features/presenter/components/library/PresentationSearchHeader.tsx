import React from 'react';
import { Star, ArrowUpDown, Plus, Check, X } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { SearchInput } from '@/shared/ui/SearchInput';
import { DropdownSelector } from '@/shared/ui/DropdownSelector';

interface PresentationSearchHeaderProps {
    search: string;
    setSearch: (v: string) => void;
    filterStarredOnly: boolean;
    setFilterStarredOnly: (v: boolean) => void;
    filterType: 'all' | 'master' | 'usual';
    setFilterType: (v: 'all' | 'master' | 'usual') => void;
    selectedTag: string;
    setSelectedTag: (v: string) => void;
    sortBy: 'lastOpened' | 'alphabetical' | 'createdAt';
    setSortBy: (v: 'lastOpened' | 'alphabetical' | 'createdAt') => void;
    typeOptions: Array<{ value: string; label: string }>;
    tagOptions: Array<{ value: string; label: string }>;
    sortOptions: Array<{ value: string; label: string }>;
    addingNew: boolean;
    setAddingNew: (v: boolean) => void;
    newName: string;
    setNewName: (v: string) => void;
    handleCreatePresentation: () => void;
    t: (key: string, defaultVal?: string) => string;
}

export const PresentationSearchHeader: React.FC<PresentationSearchHeaderProps> = ({
    search,
    setSearch,
    filterStarredOnly,
    setFilterStarredOnly,
    filterType,
    setFilterType,
    selectedTag,
    setSelectedTag,
    sortBy,
    setSortBy,
    typeOptions,
    tagOptions,
    sortOptions,
    addingNew,
    setAddingNew,
    newName,
    setNewName,
    handleCreatePresentation,
    t,
}) => {
    return (
        <>
            {/* Search and Filters */}
            <div className="p-2 border-b border-white/5 bg-stone-950/20 flex flex-col gap-2">
                <SearchInput
                    size="xs"
                    autoFocus
                    placeholder={t('search_presentations', 'Search presentations...')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onClear={() => setSearch('')}
                />

                <div className="flex items-center gap-2 text-[10px]">
                    <Button
                        size="xs"
                        square
                        variant={filterStarredOnly ? "primary" : "ghost"}
                        onClick={() => setFilterStarredOnly(!filterStarredOnly)}
                        title={t('filter_starred', 'Starred Only')}
                    >
                        <Star className={cn("w-3.5 h-3.5", filterStarredOnly ? "fill-current" : "")} />
                    </Button>

                    <DropdownSelector
                        value={filterType}
                        options={typeOptions}
                        onChange={(val) => setFilterType(val as 'all' | 'master' | 'usual')}
                        className="h-8 px-2 text-[10px] bg-white/5 border-white/5 rounded-xl flex-1 min-w-0 font-bold leading-none select-none hover:bg-white/10 hover:border-white/10"
                    />

                    <DropdownSelector
                        value={selectedTag}
                        options={tagOptions}
                        onChange={(val) => setSelectedTag(val)}
                        placeholder={t('filter_tags', 'Tags')}
                        className="h-8 px-2 text-[10px] bg-white/5 border-white/5 rounded-xl flex-1 min-w-0 font-bold leading-none select-none hover:bg-white/10 hover:border-white/10"
                    />

                    <DropdownSelector
                        value={sortBy}
                        options={sortOptions}
                        onChange={(val) => setSortBy(val as 'lastOpened' | 'alphabetical' | 'createdAt')}
                        icon={<ArrowUpDown className="w-2.5 h-2.5 text-stone-500" />}
                        className="h-8 px-2 text-[10px] bg-white/5 border-white/5 rounded-xl shrink-0 min-w-[85px] font-bold leading-none select-none hover:bg-white/10 hover:border-white/10"
                    />
                </div>
            </div>

            {/* New Presentation Input */}
            {addingNew && (
                <div className="p-2 border-b border-white/5 bg-stone-950/20">
                    <div className="flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
                        <Input
                            size="xs"
                            autoFocus
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreatePresentation();
                                if (e.key === 'Escape') { setAddingNew(false); setNewName(''); }
                            }}
                            placeholder={t('presentation_name', 'Presentation Name...')}
                            className="flex-1"
                        />
                        <Button
                            size="xs"
                            square
                            variant="primary"
                            onClick={handleCreatePresentation}
                            title={t('create', 'Create')}
                        >
                            <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            size="xs"
                            square
                            variant="ghost"
                            onClick={() => { setAddingNew(false); setNewName(''); }}
                            title={t('cancel', 'Cancel')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
};

