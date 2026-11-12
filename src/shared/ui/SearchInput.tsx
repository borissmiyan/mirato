import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input, InputProps } from './Input';
import { SizeToken } from '@/shared/tokens';
import { cn } from '@/core/utils/cn';

export interface SearchInputProps extends InputProps {
  onClear?: () => void;
}

const iconSizes: Record<SizeToken, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-7 h-7',
};

/**
 * Standardized SearchInput component based on Input:
 * - Includes a search icon at the left
 * - Shows an interactive clear button when value is non-empty
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({
  value,
  onChange,
  onClear,
  size = 'sm',
  placeholder = 'Search...',
  className,
  ...props
}, ref) => {
  const hasValue = Boolean(value && String(value).length > 0);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    } else if (onChange) {
      // Simulate change event with empty value
      const event = {
        target: { value: '' },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
  };

  const iconSizeClass = iconSizes[size || 'sm'] || 'w-4 h-4';

  return (
    <Input
      ref={ref}
      size={size}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      leftIcon={<Search className={cn(iconSizeClass, 'text-stone-500')} />}
      rightIcon={hasValue ? (
        <button
          type="button"
          onClick={handleClear}
          className="p-1 rounded-xl text-stone-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Clear search"
        >
          <X className={iconSizeClass} />
        </button>
      ) : null}
      {...props}
    />
  );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;
