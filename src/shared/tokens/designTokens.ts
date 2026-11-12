/**
 * Deck.CE Design Tokens
 * 
 * Centralized design system definitions for sizes, spacing, radiuses, colors, and shadows.
 * All UI primitives (Button, Input, Card, Modal, Slider, Dropdown, ContextMenu, etc.)
 * consume these tokens so that tuning any dimension instantly propagates across the entire app.
 */

export const sizeTokens = {
  xs: {
    height: 'h-10', // 40px
    heightPx: 40,
    square: 'w-10 h-10',
    icon: 'w-4 h-4',
    text: 'text-xs',
    padding: 'p-2', // 8px
    px: 'px-3',
    py: 'py-2',
  },
  sm: {
    height: 'h-12', // 48px (Primary Compact / Toolbar Canon)
    heightPx: 48,
    square: 'w-12 h-12',
    icon: 'w-5 h-5',
    text: 'text-xs',
    padding: 'p-3', // 12px (Equal all 4 sides)
    px: 'px-3',
    py: 'py-3',
  },
  md: {
    height: 'h-14', // 56px (Standard Form Canon)
    heightPx: 56,
    square: 'w-14 h-14',
    icon: 'w-5 h-5',
    text: 'text-sm',
    padding: 'p-4', // 16px (Equal all 4 sides)
    px: 'px-4',
    py: 'py-4',
  },
  lg: {
    height: 'h-16', // 64px (Hero / Large Touch Canon)
    heightPx: 64,
    square: 'w-16 h-16',
    icon: 'w-6 h-6',
    text: 'text-base',
    padding: 'p-5', // 20px (Equal all 4 sides)
    px: 'px-5',
    py: 'py-5',
  },
  xl: {
    height: 'h-18', // 72px
    heightPx: 72,
    square: 'w-18 h-18',
    icon: 'w-7 h-7',
    text: 'text-lg',
    padding: 'p-6', // 24px
    px: 'px-6',
    py: 'py-6',
  }
} as const;

export type SizeToken = keyof typeof sizeTokens;

export const spacingTokens = {
  none: { class: 'p-0', gap: 'gap-0', px: 0 },
  xs:   { class: 'p-1', gap: 'gap-1', px: 4 },   // 4px
  sm:   { class: 'p-2', gap: 'gap-2', px: 8 },   // 8px
  md:   { class: 'p-3', gap: 'gap-3', px: 12 },  // 12px
  lg:   { class: 'p-4', gap: 'gap-4', px: 16 },  // 16px
  xl:   { class: 'p-5', gap: 'gap-5', px: 20 },  // 20px
  '2xl': { class: 'p-6', gap: 'gap-6', px: 24 }, // 24px
  '3xl': { class: 'p-8', gap: 'gap-8', px: 32 }, // 32px
  '4xl': { class: 'p-10', gap: 'gap-10', px: 40 }, // 40px
  '5xl': { class: 'p-12', gap: 'gap-12', px: 48 }, // 48px
  '6xl': { class: 'p-16', gap: 'gap-16', px: 64 }, // 64px
} as const;

export type SpacingToken = keyof typeof spacingTokens;

export const radiusTokens = {
  none: 'rounded-none',
  xs:   'rounded-sm',    // 2px - micro borders
  sm:   'rounded-md',    // 6px - compact badges, toolbar micro-buttons
  md:   'rounded-lg',    // 8px - Canonical Apple Desktop Squircle (Buttons, IconButtons, Inputs)
  lg:   'rounded-xl',    // 12px - Cards, popovers, dropdown menus
  xl:   'rounded-2xl',   // 16px - Modals, window frames
  full: 'rounded-full',  // Reserved strictly for status dots & circular avatars
} as const;

export type RadiusToken = keyof typeof radiusTokens;

export const colorTokens = {
  // Surface and Backgrounds
  background: 'bg-stone-950',
  surface: 'bg-stone-900/60 backdrop-blur-md',
  surfaceElevated: 'bg-stone-900/80 backdrop-blur-xl',
  surfaceSolid: 'bg-stone-900',
  surfaceHover: 'hover:bg-white/10',
  surfaceActive: 'active:bg-white/15',

  // Borders
  border: 'border-white/10',
  borderSubtle: 'border-white/5',
  borderHover: 'hover:border-white/20',
  borderFocus: 'focus:border-accent/60',

  // Typography
  textPrimary: 'text-white',
  textSecondary: 'text-stone-300',
  textMuted: 'text-stone-400',
  textSubtle: 'text-stone-500',

  // Accents
  accent: 'bg-accent text-accent-foreground',
  accentHover: 'hover:bg-accent/85',
  accentSubtle: 'bg-accent/10 text-accent border border-accent/20',
  accentGlow: 'shadow-[0_0_20px_rgba(234,179,8,0.25)]',

  // Destructive / Danger
  danger: 'bg-red-600 text-white hover:bg-red-500',
  dangerSubtle: 'bg-red-500/10 text-red-400 border border-red-500/20',
  dangerBorder: 'border-red-500/70',
  dangerGlow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',

  // Focus rings
  ringAccent: 'focus-visible:ring-2 focus-visible:ring-accent/40',
  ringDanger: 'focus-visible:ring-2 focus-visible:ring-red-500/40',
} as const;

export const motionTokens = {
  spring: 'transition-all duration-200 cubic-bezier(0.16, 1, 0.3, 1)',
  press: 'active:scale-[0.97] transition-transform duration-150 ease-out will-change-transform',
  dropdown: 'apple-dropdown',
  modal: 'apple-modal',
  backdrop: 'apple-backdrop',
  timelineSlideIn: 'animate-timeline-slide-in',
  timelineBlockExpand: 'animate-timeline-block-expand',
  hoverGlow: 'transition-all duration-200 hover:shadow-lg hover:border-white/20',

  // Apple HIG Physics Curves (Swift Spring Equivalent)
  springEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  pressEasing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  snappyEasing: 'cubic-bezier(0.25, 1, 0.5, 1)',

  // Apple Spring utility classes
  appleSpring: 'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
  applePress: 'active:scale-[0.97] transition-transform duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform',
  cardHover: 'transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-2xl hover:border-white/20',
  listItemHover: 'transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:translate-x-0.5',
} as const;

export type MotionToken = keyof typeof motionTokens;

export const designTokens = {
  size: sizeTokens,
  spacing: spacingTokens,
  radius: radiusTokens,
  colors: colorTokens,
  motion: motionTokens,
} as const;

export default designTokens;
