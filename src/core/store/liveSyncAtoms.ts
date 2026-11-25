import { atom, PrimitiveAtom } from 'jotai';

/** True when the currently live slide has unsent edits waiting for "Update Live". */
export const hasPendingLiveUpdateAtom = atom(false) as PrimitiveAtom<boolean>;

/** Monotonically incremented when the operator clicks "Update Live" to push staged edits. */
export const liveUpdateTriggerAtom = atom(0) as PrimitiveAtom<number>;

/**
 * Arrow navigation mode:
 * - false (Linked): arrows advance Live & Preview together from the Live slide.
 * - true (Unlinked): arrows advance Live only, keeping Preview locked on the edited slide.
 */
export const previewLockedAtom = atom(false) as PrimitiveAtom<boolean>;
