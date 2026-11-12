import { getDefaultStore } from 'jotai';
import { editingCanvasItemIdAtom, searchOpenAtom } from '@/core/store/uiAtoms';
import { useModalStore } from '@/core/store/modalStore';

/**
 * Checks if the user is currently typing in an input, textarea,
 * contenteditable element, WYSIWYG slide text editor, or active search/modal dialog.
 * When true, global single-key shortcuts like Spacebar must be bypassed to allow normal typing.
 */
export function isUserTyping(): boolean {
    if (typeof document === 'undefined') return false;

    const active = document.activeElement;
    if (active) {
        const tagName = active.tagName.toUpperCase();
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
            return true;
        }
        const contentEditableAttr = active.getAttribute('contenteditable');
        if (
            (active as HTMLElement).isContentEditable ||
            (active as HTMLElement).contentEditable === 'true' ||
            (contentEditableAttr !== null && contentEditableAttr !== 'false')
        ) {
            return true;
        }
        if (active.getAttribute('role') === 'textbox') {
            return true;
        }
        if (active.closest && active.closest('[contenteditable]:not([contenteditable="false"])')) {
            return true;
        }
    }

    // WYSIWYG text block editing active on canvas
    const store = getDefaultStore();
    if (store.get(editingCanvasItemIdAtom) !== null) {
        return true;
    }

    // Search bar is open
    if (store.get(searchOpenAtom)) {
        return true;
    }

    // Modal dialog is open that might capture typing
    if (useModalStore.getState().stack.length > 0) {
        return true;
    }

    return false;
}
