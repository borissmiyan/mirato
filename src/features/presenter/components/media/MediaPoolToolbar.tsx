import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, FolderPlus, ArrowUpDown, Filter, Check, Layers, Image as ImageIcon, Film, Music, Info, LayoutGrid, List, FolderTree } from 'lucide-react';
import { MediaType, MediaColorTag } from '@/core/types';
import { MediaSortOrder } from '../../hooks/useMediaPoolData';
import Button from '@/shared/ui/Button';
import IconButton from '@/shared/ui/IconButton';
import { SearchInput } from '@/shared/ui/SearchInput';
import { cn } from '@/core/utils/cn';
import { TAG_COLORS } from './MediaPoolContextMenu';
import { MediaViewMode } from './views';

interface MediaPoolToolbarProps {
  filter: MediaType | 'all';
  setFilter: (filter: MediaType | 'all') => void;
  tagFilter?: MediaColorTag | 'all';
  setTagFilter?: (tag: MediaColorTag | 'all') => void;
  handleImportMedia: () => void;
  handleCreateBin: () => void;
  onOpenInfo?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: MediaSortOrder;
  setSortBy: (s: MediaSortOrder) => void;
  viewMode?: MediaViewMode;
  onSetViewMode?: (mode: MediaViewMode) => void;
  fileCount?: number;
  binCount?: number;
}

/**
 * Standardized Apple HIG toolbar for the Media Pool:
 * - Row 1: Actions (Import + New Bin + Storage Info)
 * - Row 2: Real-time search, Sort dropdown, and Filter/Tag dropdown with synchronized heights
 */
export const MediaPoolToolbar: React.FC<MediaPoolToolbarProps> = ({
  filter,
  setFilter,
  tagFilter = 'all',
  setTagFilter,
  handleImportMedia,
  handleCreateBin,
  onOpenInfo,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  viewMode = 'grid',
  onSetViewMode,
}) => {
  const { t } = useTranslation();
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const filterOptions = useMemo<{ value: MediaType | 'all'; label: string; icon: React.ReactNode }[]>(() => [
    { value: 'all', label: t('media_pool.all', 'All'), icon: <Layers className="w-3.5 h-3.5 text-stone-400" /> },
    { value: 'image', label: t('media_pool.image', 'Image'), icon: <ImageIcon className="w-3.5 h-3.5 text-stone-400" /> },
    { value: 'video', label: t('media_pool.video', 'Video'), icon: <Film className="w-3.5 h-3.5 text-stone-400" /> },
    { value: 'audio', label: t('media_pool.audio', 'Audio'), icon: <Music className="w-3.5 h-3.5 text-stone-400" /> },
  ], [t]);

  const sortOptions = useMemo<{ value: MediaSortOrder; label: string }[]>(() => [
    { value: 'date-desc', label: t('media_pool.sort_newest', 'Newest first') },
    { value: 'date-asc', label: t('media_pool.sort_oldest', 'Oldest first') },
    { value: 'name-asc', label: t('media_pool.sort_name_asc', 'Name (A-Z)') },
    { value: 'name-desc', label: t('media_pool.sort_name_desc', 'Name (Z-A)') },
    { value: 'type', label: t('media_pool.sort_type', 'By Type') },
  ], [t]);

  // Click outside to close dropdowns
  useEffect(() => {
    if (!isSortOpen && !isFilterOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (sortRef.current && !sortRef.current.contains(target)) {
        setIsSortOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(target)) {
        setIsFilterOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isSortOpen, isFilterOpen]);

  return (
    <div className="flex flex-col gap-2 mb-2 shrink-0">
      {/* Row 1: Title on the left, View Mode Switcher on the right */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1.5 select-none">
          <Music className="w-3 h-3 text-stone-500" />
          {t('media_pool.title', 'Media Pool')}
        </span>

        {/* View Mode Segmented Switcher */}
        {onSetViewMode && (
          <div className="flex items-center p-0.5 rounded-xl bg-stone-900/60 border border-white/5 shrink-0 gap-0.5" role="group" aria-label={t('media_pool.view_mode', 'View mode')}>
            <button
              type="button"
              onClick={() => onSetViewMode('grid')}
              className={cn(
                "p-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center",
                viewMode === 'grid'
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
              )}
              title={t('media_pool.view_grid', 'Grid View')}
              aria-label={t('media_pool.view_grid', 'Grid View')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSetViewMode('list')}
              className={cn(
                "p-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center",
                viewMode === 'list'
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
              )}
              title={t('media_pool.view_list', 'List View')}
              aria-label={t('media_pool.view_list', 'List View')}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSetViewMode('tree')}
              className={cn(
                "p-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center",
                viewMode === 'tree'
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-stone-400 hover:text-stone-200 hover:bg-white/5"
              )}
              title={t('media_pool.view_tree', 'Tree List View')}
              aria-label={t('media_pool.view_tree', 'Tree List View')}
            >
              <FolderTree className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Row 2: Larger Import Button + Create Bin + Info */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="md"
          variant="secondary"
          onClick={handleImportMedia}
          leftIcon={<Plus className="w-4 h-4" />}
          className="flex-1 font-semibold"
        >
          {t('media_pool.import', 'Import')}
        </Button>

        <IconButton
          size="md"
          variant="secondary"
          icon={<FolderPlus className="w-4 h-4" />}
          onClick={handleCreateBin}
          label={t('media_pool.create_bin', 'Create Bin')}
        />

        {onOpenInfo && (
          <IconButton
            size="md"
            variant="secondary"
            icon={<Info className="w-4 h-4" />}
            onClick={onOpenInfo}
            label={t('media_pool.info', 'Storage & Statistics')}
          />
        )}
      </div>

      {/* Row 3: Search + Sort dropdown + Filter dropdown */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex-1 min-w-0">
          <SearchInput
            size="sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            placeholder={t('media_pool.search_placeholder', 'Search media...')}
            className="w-full bg-stone-900/60 border-white/5 focus:border-accent/40"
          />
        </div>

        {/* Sort Trigger & Dropdown */}
        <div className="relative shrink-0" ref={sortRef}>
          <IconButton
            size="sm"
            variant={isSortOpen ? "primary" : "secondary"}
            icon={<ArrowUpDown className="w-4 h-4" />}
            onClick={() => {
              setIsSortOpen(prev => !prev);
              setIsFilterOpen(false);
            }}
            label={t('media_pool.sort', 'Sort')}
          />

          {isSortOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-40 py-1 rounded-xl bg-stone-900/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              {sortOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSortBy(opt.value);
                    setIsSortOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                    sortBy === opt.value
                      ? "text-accent bg-accent/10"
                      : "text-stone-300 hover:text-white hover:bg-white/5"
                  )}
                >
                  <span>{opt.label}</span>
                  {sortBy === opt.value && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter Trigger & Dropdown */}
        <div className="relative shrink-0" ref={filterRef}>
          <IconButton
            size="sm"
            variant={isFilterOpen || filter !== 'all' || tagFilter !== 'all' ? "primary" : "secondary"}
            icon={<Filter className="w-4 h-4" />}
            onClick={() => {
              setIsFilterOpen(prev => !prev);
              setIsSortOpen(false);
            }}
            label={t('media_pool.filter', 'Filter')}
            active={filter !== 'all' || tagFilter !== 'all'}
            className={cn(
              (filter !== 'all' || tagFilter !== 'all') && "bg-accent/20 text-accent border-accent/40 hover:bg-accent/30"
            )}
          />

          {isFilterOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 py-1 rounded-xl bg-stone-900/95 border border-white/10 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150 max-h-80 overflow-y-auto no-scrollbar">
              <div className="px-2.5 py-1 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                {t('media_pool.type', 'Type')}
              </div>
              {filterOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setFilter(opt.value);
                    setIsFilterOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                    filter === opt.value
                      ? "text-accent bg-accent/10"
                      : "text-stone-300 hover:text-white hover:bg-white/5"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {opt.icon}
                    <span>{opt.label}</span>
                  </span>
                  {filter === opt.value && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                </button>
              ))}

              {setTagFilter && (
                <>
                  <div className="my-1 border-t border-white/5" />
                  <div className="px-2.5 py-1 text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    {t('media_pool.tags', 'Tags')}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTagFilter('all');
                      setIsFilterOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer",
                      tagFilter === 'all'
                        ? "text-accent bg-accent/10"
                        : "text-stone-300 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <span>{t('media_pool.all_tags', 'All Tags')}</span>
                    {tagFilter === 'all' && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                  </button>
                  {(['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as MediaColorTag[]).map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setTagFilter(color);
                        setIsFilterOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between w-full px-2.5 py-1.5 text-xs font-medium transition-colors text-left cursor-pointer capitalize",
                        tagFilter === color
                          ? "text-accent bg-accent/10"
                          : "text-stone-300 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full", TAG_COLORS[color]?.bg)} />
                        <span>{TAG_COLORS[color]?.name || color}</span>
                      </span>
                      {tagFilter === color && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaPoolToolbar;
