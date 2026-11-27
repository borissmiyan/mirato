import { atomWithStorage } from 'jotai/utils';

/**
 * Shared persisted active hymn theme ID for Hymns mode (preview, timeline, and live projector).
 * Kept in its own module so feature components do not couple to core uiAtoms mocks.
 */
export const activeHymnThemeIdAtom = atomWithStorage<string>(
    'mirato-active-hymn-theme',
    'default',
    undefined,
    { getOnInit: true }
);
