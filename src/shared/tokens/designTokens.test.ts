import { describe, it, expect } from 'vitest';
import { motionTokens, designTokens, sizeTokens, spacingTokens, radiusTokens, colorTokens } from './index';

describe('Design Tokens & Motion Tokens', () => {
  it('exports motionTokens with expected Apple HIG values', () => {
    expect(motionTokens).toBeDefined();
    expect(motionTokens.spring).toBe('transition-all duration-200 cubic-bezier(0.16, 1, 0.3, 1)');
    expect(motionTokens.press).toBe('active:scale-[0.97] transition-transform duration-150 ease-out will-change-transform');
    expect(motionTokens.dropdown).toBe('apple-dropdown');
    expect(motionTokens.modal).toBe('apple-modal');
    expect(motionTokens.backdrop).toBe('apple-backdrop');
    expect(motionTokens.timelineSlideIn).toBe('animate-timeline-slide-in');
    expect(motionTokens.timelineBlockExpand).toBe('animate-timeline-block-expand');
    expect(motionTokens.hoverGlow).toBe('transition-all duration-200 hover:shadow-lg hover:border-white/20');
  });

  it('contains Apple physics spring easing curves', () => {
    expect(motionTokens.springEasing).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
    expect(motionTokens.pressEasing).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
  });

  it('exposes motion on default designTokens bundle', () => {
    expect(designTokens.motion).toBe(motionTokens);
    expect(designTokens.size).toBe(sizeTokens);
    expect(designTokens.spacing).toBe(spacingTokens);
    expect(designTokens.radius).toBe(radiusTokens);
    expect(designTokens.colors).toBe(colorTokens);
  });
});
