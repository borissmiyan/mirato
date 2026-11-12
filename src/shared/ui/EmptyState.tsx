import React from 'react';
import { colorTokens, radiusTokens } from '../tokens/designTokens';

export interface EmptyStateProps {
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  borderStyle?: 'dashed' | 'solid' | 'none';
  border?: 'dashed' | 'solid' | 'none';
  className?: string;
}

const sizeConfig = {
  xs: {
    container: 'p-4 gap-2',
    iconBox: 'w-8 h-8',
    iconSize: 'w-4 h-4',
    title: 'text-[11px] font-bold',
    description: 'text-[10px]',
  },
  sm: {
    container: 'p-6 gap-3',
    iconBox: 'w-10 h-10',
    iconSize: 'w-5 h-5',
    title: 'text-xs font-bold',
    description: 'text-[11px]',
  },
  md: {
    container: 'p-8 sm:p-10 gap-4',
    iconBox: 'w-14 h-14',
    iconSize: 'w-7 h-7',
    title: 'text-sm font-bold',
    description: 'text-xs',
  },
  lg: {
    container: 'p-12 sm:p-16 gap-5',
    iconBox: 'w-20 h-20',
    iconSize: 'w-10 h-10',
    title: 'text-base font-bold',
    description: 'text-sm',
  },
};

const borderStyles = {
  dashed: 'border-2 border-dashed border-white/5 bg-stone-900/20',
  solid: 'border border-white/10 bg-stone-900/40',
  none: 'border-0 bg-transparent',
};

/**
 * Standardized Apple HIG Empty State Component.
 * Supports configurable sizes, customizable icon box, titles, descriptions, and call-to-actions.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  size = 'md',
  borderStyle,
  border = 'dashed',
  className = '',
}) => {
  const cfg = sizeConfig[size] || sizeConfig.md;
  const bStyle = borderStyles[borderStyle || border || 'dashed'] || borderStyles.dashed;

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'function' || typeof icon === 'object') {
      const IconComp = icon as React.ComponentType<{ className?: string }>;
      return <IconComp className={cfg.iconSize} />;
    }
    return icon;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center text-center select-none ${
        radiusTokens.lg
      } ${cfg.container} ${bStyle} ${className}`}
    >
      {icon && (
        <div
          className={`flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-stone-500 shadow-inner ${cfg.iconBox}`}
        >
          {renderIcon()}
        </div>
      )}

      <div className="space-y-1 max-w-sm">
        <h4 className={`${cfg.title} ${colorTokens.textPrimary} tracking-tight`}>
          {title}
        </h4>
        {description && (
          <p className={`${cfg.description} ${colorTokens.textMuted} leading-relaxed`}>
            {description}
          </p>
        )}
      </div>

      {action && <div className="mt-2 flex items-center gap-3">{action}</div>}
    </div>
  );
};

export default EmptyState;
