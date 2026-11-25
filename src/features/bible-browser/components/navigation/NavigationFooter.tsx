import React from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive } from 'lucide-react';
import { AppMode, IServiceFile } from '@/core/types';
import { IHymnal } from '@/core/types/hymn';
import { getBookName } from '@/core/data/bookData';
import { useHymnLiveState } from '@/features/hymns/hooks/useHymnLiveState';
import { CustomHymnalIcon, CustomServiceIcon, NavigationSelectorCard } from '@/shared/ui';

interface HymnalFooterButtonProps {
  activeHymnal?: IHymnal | null;
  isAllHymnals?: boolean;
  totalHymnsCount?: number;
  hymnalTitle: string;
  onBadgeClick: () => void;
  footerRef: React.RefObject<HTMLButtonElement | null>;
  isOpen?: boolean;
  t: (key: string, fallback?: string) => string;
}

const formatHymnalSubtitle = (count: number, language?: string): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11
    ? 'гимн'
    : (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
      ? 'гимна'
      : 'гимнов';
  return language ? `${count} ${word} • ${language.toUpperCase()}` : `${count.toLocaleString('ru-RU')} ${word}`;
};

const HymnalFooterButton: React.FC<HymnalFooterButtonProps> = ({
  activeHymnal,
  isAllHymnals,
  totalHymnsCount = 0,
  hymnalTitle,
  onBadgeClick,
  footerRef,
  isOpen,
  t
}) => {
  const { isLive } = useHymnLiveState(undefined, activeHymnal?.id);

  return (
    <NavigationSelectorCard
      ref={footerRef}
      onClick={onBadgeClick}
      title={hymnalTitle}
      subtitle={
        isAllHymnals
          ? formatHymnalSubtitle(totalHymnsCount)
          : activeHymnal
            ? formatHymnalSubtitle(activeHymnal.itemCount, activeHymnal.language || 'ru')
            : t('hymns.title', 'Hymns')
      }
      coverImageUrl={isAllHymnals ? undefined : activeHymnal?.coverImageUrl}
      badge={<CustomHymnalIcon className="w-4 h-4" />}
      badgeVariant={(isAllHymnals || activeHymnal) ? 'accent' : 'muted'}
      trailing={
        isLive ? (
          <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-xl animate-pulse shrink-0 uppercase tracking-wider">
            LIVE
          </span>
        ) : undefined
      }
      isOpen={isOpen}
      ariaLabel={hymnalTitle}
    />
  );
};

interface NavigationFooterProps {
  appMode: AppMode;
  currentTranslationId: string;
  currentBookId: string | null;
  currentChapter: number | null;
  activeService: IServiceFile | null;
  activeHymnal?: IHymnal | null;
  isAllHymnals?: boolean;
  totalHymnsCount?: number;
  onBadgeClick: (element: HTMLElement | null) => void;
  lang: string;
  isRu: boolean;
  isPickerOpen?: boolean;
}

export const NavigationFooter: React.FC<NavigationFooterProps> = React.memo(({
  appMode,
  currentTranslationId,
  currentBookId,
  currentChapter,
  activeService,
  activeHymnal,
  isAllHymnals = false,
  totalHymnsCount = 0,
  onBadgeClick,
  lang,
  isRu,
  isPickerOpen = false
}) => {
  const { t } = useTranslation();
  const footerRef = React.useRef<HTMLButtonElement>(null);

  const scriptureTitle = currentBookId ? `${getBookName(currentBookId, lang)} ${currentChapter || ''}` : t('select_passage');
  const serviceTitle = activeService ? ((isRu ? activeService.nameRu : activeService.name) || activeService.name) : t('select_service', 'Select Service');
  const hymnalTitle = isAllHymnals
    ? t('all_hymnals', 'Все сборники')
    : activeHymnal
      ? activeHymnal.name
      : t('hymns.select_hymnal', 'Select Hymnal');

  return (
    <div className="shrink-0 p-3 border-t border-white/5 bg-[#141210] relative z-30">
      {appMode === 'scripture' ? (
        <NavigationSelectorCard
          ref={footerRef}
          onClick={() => onBadgeClick(footerRef.current)}
          title={currentBookId ? getBookName(currentBookId, lang) : '-'}
          subtitle={currentChapter ? `${t('chapter')} ${currentChapter}` : '-'}
          badge={currentTranslationId}
          badgeVariant="accent"
          isOpen={isPickerOpen}
          ariaLabel={scriptureTitle}
        />
      ) : appMode === 'hymns' ? (
        <HymnalFooterButton
          activeHymnal={activeHymnal}
          isAllHymnals={isAllHymnals}
          totalHymnsCount={totalHymnsCount}
          hymnalTitle={hymnalTitle}
          onBadgeClick={() => onBadgeClick(footerRef.current)}
          footerRef={footerRef}
          isOpen={isPickerOpen}
          t={(k, f) => t(k, f || '')}
        />
      ) : (
        <NavigationSelectorCard
          ref={footerRef}
          onClick={() => onBadgeClick(footerRef.current)}
          title={serviceTitle}
          subtitle={
            activeService
              ? (activeService.fileHandle ? t('linked', 'Linked') : t('local', 'Local'))
              : t('no_active_service', 'No active service')
          }
          badge={<CustomServiceIcon className="w-4 h-4" />}
          badgeVariant={activeService ? 'accent' : 'muted'}
          trailing={
            activeService?.fileHandle ? (
              <div title={t('linked_to_disk', 'Linked to disk')}>
                <HardDrive className="w-3.5 h-3.5 text-accent" />
              </div>
            ) : undefined
          }
          isOpen={isPickerOpen}
          ariaLabel={serviceTitle}
        />
      )}
    </div>
  );
});

NavigationFooter.displayName = 'NavigationFooter';

export default NavigationFooter;
