import React from 'react';
import { useTranslation } from 'react-i18next';
import { Workflow, Music, HardDrive } from 'lucide-react';
import { AppMode, IServiceFile } from '@/core/types';
import { IHymnal } from '@/core/types/hymn';
import { getBookName } from '@/core/data/bookData';
import { useHymnLiveState } from '@/features/hymns/hooks/useHymnLiveState';
import { NavigationSelectorCard } from '@/shared/ui';

interface HymnalFooterButtonProps {
  activeHymnal?: IHymnal | null;
  hymnalTitle: string;
  onBadgeClick: () => void;
  footerRef: React.RefObject<HTMLButtonElement | null>;
  isOpen?: boolean;
  t: (key: string, fallback?: string) => string;
}

const HymnalFooterButton: React.FC<HymnalFooterButtonProps> = ({
  activeHymnal,
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
      subtitle={activeHymnal ? `${activeHymnal.itemCount} ${activeHymnal.language}` : t('hymns.title', 'Hymns')}
      coverImageUrl={activeHymnal?.coverImageUrl}
      badge={<Music className="w-4 h-4" />}
      badgeVariant={activeHymnal ? 'accent' : 'muted'}
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
  onBadgeClick,
  lang,
  isRu,
  isPickerOpen = false
}) => {
  const { t } = useTranslation();
  const footerRef = React.useRef<HTMLButtonElement>(null);

  const scriptureTitle = currentBookId ? `${getBookName(currentBookId, lang)} ${currentChapter || ''}` : t('select_passage');
  const serviceTitle = activeService ? (isRu ? activeService.nameRu : activeService.name) : t('select_service', 'Select Service');
  const hymnalTitle = activeHymnal ? activeHymnal.name : t('hymns.select_hymnal', 'Select Hymnal');

  return (
    <div className="shrink-0 p-3 border-t border-white/5 bg-stone-950/60 relative z-30">
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
          subtitle={activeService?.fileHandle ? t('linked', 'Linked') : t('local', 'Local')}
          badge={<Workflow className="w-4 h-4" />}
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
