import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDefaultStore } from 'jotai';
import { isUserTyping } from './keyboardUtils';
import { editingCanvasItemIdAtom, searchOpenAtom } from '@/core/store/uiAtoms';
import { useModalStore, ModalType } from '@/core/store/modalStore';

describe('keyboardUtils: isUserTyping', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        // Reset Jotai atoms
        const store = getDefaultStore();
        store.set(editingCanvasItemIdAtom, null);
        store.set(searchOpenAtom, false);

        // Reset modal store
        useModalStore.setState({ stack: [] });
    });

    afterEach(() => {
        container.remove();
        const store = getDefaultStore();
        store.set(editingCanvasItemIdAtom, null);
        store.set(searchOpenAtom, false);
        useModalStore.setState({ stack: [] });
    });

    it('returns false by default when no inputs or modals are active', () => {
        expect(isUserTyping()).toBe(false);
    });

    it('returns true when document.activeElement is an INPUT', () => {
        const input = document.createElement('input');
        container.appendChild(input);
        input.focus();

        expect(document.activeElement).toBe(input);
        expect(isUserTyping()).toBe(true);
    });

    it('returns true when document.activeElement is a TEXTAREA', () => {
        const textarea = document.createElement('textarea');
        container.appendChild(textarea);
        textarea.focus();

        expect(document.activeElement).toBe(textarea);
        expect(isUserTyping()).toBe(true);
    });

    it('returns true when document.activeElement is a SELECT', () => {
        const select = document.createElement('select');
        container.appendChild(select);
        select.focus();

        expect(document.activeElement).toBe(select);
        expect(isUserTyping()).toBe(true);
    });

    it('returns true when document.activeElement is contenteditable', () => {
        const editableDiv = document.createElement('div');
        editableDiv.contentEditable = 'true';
        editableDiv.tabIndex = 0;
        container.appendChild(editableDiv);
        editableDiv.focus();

        expect(document.activeElement).toBe(editableDiv);
        expect(isUserTyping()).toBe(true);
    });

    it('returns true when document.activeElement is inside a contenteditable parent', () => {
        const editableDiv = document.createElement('div');
        editableDiv.setAttribute('contenteditable', 'true');
        const span = document.createElement('span');
        span.tabIndex = 0;
        editableDiv.appendChild(span);
        container.appendChild(editableDiv);
        span.focus();

        expect(isUserTyping()).toBe(true);
    });

    it('returns true when document.activeElement has role="textbox"', () => {
        const customInput = document.createElement('div');
        customInput.setAttribute('role', 'textbox');
        customInput.tabIndex = 0;
        container.appendChild(customInput);
        customInput.focus();

        expect(isUserTyping()).toBe(true);
    });

    it('returns true when WYSIWYG text editing atom is active even if activeElement is not an input', () => {
        const store = getDefaultStore();
        store.set(editingCanvasItemIdAtom, 'text-item-123');

        expect(isUserTyping()).toBe(true);
    });

    it('returns true when search bar is open', () => {
        const store = getDefaultStore();
        store.set(searchOpenAtom, true);

        expect(isUserTyping()).toBe(true);
    });

    it('returns true when a modal dialog is open', () => {
        useModalStore.getState().openModal(ModalType.CUSTOMIZATION);

        expect(isUserTyping()).toBe(true);
    });

    it('returns false when focused on regular buttons or static divs', () => {
        const btn = document.createElement('button');
        container.appendChild(btn);
        btn.focus();

        expect(document.activeElement).toBe(btn);
        expect(isUserTyping()).toBe(false);
    });
});
