import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { Button } from '@/shared/ui/Button';

export type PanelTab = 'properties' | 'background' | 'layers' | 'audio' | 'timer' | 'transition' | 'video';

export interface ITabDefinition {
  id: PanelTab;
  icon: React.ElementType;
  title: string;
}

interface ISlideDesignTabBarProps {
  tabs: ITabDefinition[];
  activeTab: string;
  onTabChange: (id: PanelTab) => void;
  onClose: () => void;
  title: string;
}

export const SlideDesignTabBar: React.FC<ISlideDesignTabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  onClose,
  title,
}) => {
  return (
    <>
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/6 shrink-0">
        <span className="text-[10px] font-black text-stone-500 uppercase tracking-[0.25em]">
          {title}
        </span>
        <Button
          variant="ghost"
          size="xs"
          square
          onClick={onClose}
          aria-label="Close"
          className="text-stone-500 hover:text-stone-200"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* ─── Tab Bar ─── */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/6 shrink-0">
        {tabs.map(({ id, icon: Icon, title: tabTitle }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            title={tabTitle}
            className={cn(
              "flex-1 flex items-center justify-center py-2 rounded-xl transition-all duration-200 relative group apple-press cursor-pointer",
              activeTab === id
                ? "bg-white/10 text-white shadow-sm"
                : "text-stone-500 hover:text-stone-300 hover:bg-white/5"
            )}
          >
            <Icon
              className={cn(
                "w-4 h-4 transition-all duration-150",
                activeTab === id ? "text-accent scale-105" : ""
              )}
            />
            {/* Active spring indicator */}
            {activeTab === id && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-accent rounded-full shadow-[0_0_8px_var(--color-accent-glow)]" />
            )}
          </button>
        ))}
      </div>
    </>
  );
};
