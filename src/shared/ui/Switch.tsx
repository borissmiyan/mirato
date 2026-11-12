import React, { useId } from 'react';
import { colorTokens } from '../tokens/designTokens';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  id?: string;
  className?: string;
}

const sizeConfig = {
  sm: {
    track: 'w-9 h-5 p-0.5',
    thumb: 'w-4 h-4',
    translate: 'translate-x-4',
    text: 'text-xs',
    desc: 'text-[10px]',
  },
  md: {
    track: 'w-11 h-6 p-0.5',
    thumb: 'w-5 h-5',
    translate: 'translate-x-5',
    text: 'text-sm',
    desc: 'text-xs',
  },
};

/**
 * Apple HIG Spring-animated Switch Component.
 * Supports tactile compression, accessible keyboard navigation, and design token integration.
 */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  size = 'md',
  disabled = false,
  label,
  description,
  id,
  className = '',
}) => {
  const generatedId = useId();
  const switchId = id || generatedId;
  const cfg = sizeConfig[size];

  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div
      className={`inline-flex items-center justify-between gap-3 select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
      onClick={handleToggle}
    >
      {(label || description) && (
        <label htmlFor={switchId} className="flex flex-col cursor-pointer pointer-events-none">
          {label && (
            <span className={`font-medium ${colorTokens.textPrimary} ${cfg.text}`}>
              {label}
            </span>
          )}
          {description && (
            <span className={`${colorTokens.textMuted} ${cfg.desc} leading-tight`}>
              {description}
            </span>
          )}
        </label>
      )}

      <button
        type="button"
        id={switchId}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
          cfg.track
        } ${
          checked
            ? 'bg-accent shadow-sm'
            : 'bg-white/15 hover:bg-white/20 border border-white/5'
        }`}
      >
        <span
          className={`pointer-events-none block rounded-full bg-white shadow-md transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
            cfg.thumb
          } ${
            checked
              ? `${cfg.translate} active:scale-x-110`
              : 'translate-x-0 active:scale-x-110'
          }`}
        />
      </button>
    </div>
  );
};

export default Switch;
