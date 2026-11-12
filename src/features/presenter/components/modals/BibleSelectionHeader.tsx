import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, X } from 'lucide-react';
import { IconButton } from '@/shared/ui';

interface BibleSelectionHeaderProps {
  slideId?: string;
  onClose: () => void;
}

export const BibleSelectionHeader: React.FC<BibleSelectionHeaderProps> = ({ slideId, onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-stone-900/50 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20">
          <BookOpen className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight uppercase">
            {slideId ? t('edit_verse', 'Edit Verse') : t('select_verse', 'Select Verse')}
          </h2>
          <p className="text-[10px] text-stone-500 font-bold uppercase tracking-[0.2em] mt-0.5">
            {t('bible_browser', 'Bible Browser')}
          </p>
        </div>
      </div>
      <IconButton
        icon={<X className="w-5 h-5" />}
        label={t('close', 'Close')}
        variant="surface"
        size="xs"
        onClick={onClose}
      />
    </div>
  );
};
