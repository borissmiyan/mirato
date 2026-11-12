import React from 'react';
import { Copy } from 'lucide-react';
import { TFunction } from 'i18next';
import { IStyleLayer } from '@/core/types';
import { ensureLayers } from '@/core/utils/styleMigration';
import { toast } from '@/core/utils/toast';
import { Button } from '@/shared/ui/Button';
import { BackgroundPicker } from './BackgroundPicker';

interface SlideDesignBackgroundTabProps {
  slideBg: IStyleLayer[] | undefined;
  onChange: (bg: IStyleLayer[]) => void;
  applyBackgroundToAll: (bg: IStyleLayer[]) => Promise<void>;
  t: TFunction;
}

export const SlideDesignBackgroundTab: React.FC<SlideDesignBackgroundTabProps> = ({
  slideBg,
  onChange,
  applyBackgroundToAll,
  t,
}) => {
  return (
    <div className="p-3 space-y-3 animate-in fade-in duration-200">
      <div className="flex items-center justify-between px-1">
        <span className="text-[9px] font-black text-stone-500 uppercase tracking-[0.2em]">
          {t('slide_background', 'Slide Background')}
        </span>
        <Button
          variant="secondary"
          size="xs"
          onClick={async () => {
            const bg = ensureLayers(slideBg);
            await applyBackgroundToAll(bg);
            toast.success(t('background_applied_to_all', 'Applied to all slides'));
          }}
          className="gap-1.5 text-[9px] font-bold uppercase tracking-wider"
        >
          <Copy className="w-3 h-3 text-accent" />
          {t('apply_to_all', 'Apply to All')}
        </Button>
      </div>
      <BackgroundPicker
        background={slideBg || { type: 'color', color: '#000000' }}
        onChange={onChange}
      />
    </div>
  );
};

