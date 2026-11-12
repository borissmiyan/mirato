import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Presentation, Music, ChevronDown, Settings } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { AppMode } from '@/core/types';
import { Button, SearchInput } from '@/shared/ui';

interface NavigationHeaderProps {
  appMode: AppMode;
  isModePickerOpen: boolean;
  onToggleModePicker: (element: HTMLElement | null) => void;
  onCloseModePicker: () => void;
  onSetAppMode: (mode: AppMode) => void;
  onOpenSettings: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = React.memo(({
  appMode,
  isModePickerOpen,
  onToggleModePicker,
  onCloseModePicker,
  onSetAppMode,
  onOpenSettings,
  searchQuery,
  onSearchChange
}) => {
  const { t } = useTranslation();
  const modeLabel = appMode === 'scripture' ? t('scripture') : appMode === 'hymns' ? t('hymns.title', 'Hymns') : t('presentation', 'Presentation');
  const searchPlaceholder = appMode === 'hymns' ? t('hymns.search_placeholder', 'Search hymns...') : t('search.placeholder');

  return (
    <div className="p-4 border-b border-white/5 space-y-3 shrink-0">
      <div className="flex items-center justify-between">
        <div className="relative">
          <button
            type="button"
            onClick={(e) => onToggleModePicker(e.currentTarget)}
            aria-label={modeLabel}
            className="group flex items-center gap-2 px-2.5 py-1.5 -ml-2 rounded-xl hover:bg-white/5 transition-all text-left cursor-pointer"
          >
            <div className="p-1.5 bg-accent/20 rounded-xl group-hover:bg-accent/30 transition-colors">
              {appMode === 'scripture' ? (
                <BookOpen className="w-4 h-4 text-accent" />
              ) : appMode === 'hymns' ? (
                <Music className="w-4 h-4 text-accent" />
              ) : (
                <Presentation className="w-4 h-4 text-accent" />
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <h2 className="font-bold text-stone-200 tracking-tight text-xs uppercase hidden @[200px]:block">
                  {modeLabel}
                </h2>
                <ChevronDown className={cn("w-3 h-3 text-stone-500 transition-transform", isModePickerOpen && "rotate-180")} />
              </div>
            </div>
          </button>
        </div>
        
        <Button
          size="sm"
          square
          variant="ghost"
          onClick={onOpenSettings}
          title={t('settings')}
          aria-label={t('settings')}
          className="text-stone-400 hover:text-white"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      <SearchInput
        size="sm"
        placeholder={searchPlaceholder}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        onClear={() => onSearchChange('')}
      />
    </div>
  );
});

NavigationHeader.displayName = 'NavigationHeader';

export default NavigationHeader;
