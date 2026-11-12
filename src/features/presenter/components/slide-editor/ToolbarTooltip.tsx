import React from 'react';
import { Tooltip, Kbd } from '@/shared/ui';

export interface ToolbarTooltipProps {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

export const ToolbarTooltip: React.FC<ToolbarTooltipProps> = ({
  label,
  shortcut,
  disabled = false,
  children,
}) => (
  <Tooltip
    content={
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span>{label}</span>
        {shortcut && <Kbd size="xs">{shortcut}</Kbd>}
      </div>
    }
    position="top"
    disabled={disabled}
  >
    {children}
  </Tooltip>
);

