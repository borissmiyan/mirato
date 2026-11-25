import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import IconButton from '../IconButton';

export interface PickerModalShellProps {
    isOpen: boolean;
    onClose: () => void;
    /** Optional width class for the left sidebar (defaults to `w-[340px]`) */
    sidebarWidthClassName?: string;
    /** Accent icon rendered inside the sidebar header badge */
    sidebarIcon: React.ReactNode;
    /** Uppercase sidebar title (e.g. "Вставить гимн") */
    sidebarTitle: React.ReactNode;
    /** Optional controls placed under the sidebar title (e.g. SearchInput) */
    sidebarHeaderExtra?: React.ReactNode;
    /** Main scrollable/virtualized body of the left sidebar */
    sidebarBody: React.ReactNode;
    /** Optional footer pinned to the bottom of the left sidebar (e.g. NavigationSelectorCard) */
    sidebarFooter?: React.ReactNode;
    /** Title of the currently selected item in the right workspace header */
    contentTitle: React.ReactNode;
    /** Optional compact badge rendered next to contentTitle (e.g. slide count) */
    contentBadge?: React.ReactNode;
    /** Optional controls rendered on the right side of the workspace header (before Close button) */
    contentHeaderRight?: React.ReactNode;
    /** Optional secondary bar below the workspace header (e.g. parallel translation selector) */
    contentSubheader?: React.ReactNode;
    /** Main preview area */
    preview: React.ReactNode;
    /** Optional bottom tray above the footer (e.g. verse carousel / slide timeline) */
    tray?: React.ReactNode;
    /** Left-aligned controls or status in the workspace footer */
    footerLeft?: React.ReactNode;
    /** Right-aligned primary action button(s) in the workspace footer */
    footerRight: React.ReactNode;
    /** Extra sibling elements rendered outside the modal card (e.g. ContextMenu, nested pickers) */
    extra?: React.ReactNode;
    /** Optional keyboard handler for Enter / custom shortcuts when modal is open */
    onKeyDown?: (e: KeyboardEvent) => void;
    /** Disable built-in Escape handling (e.g. when a nested popover is open) */
    disableEscapeClose?: boolean;
}

/**
 * Standardized two-pane picker modal shell shared across Hymn, Presentation, and Bible pickers.
 * Guarantees identical window geometry, sidebar header/footer, workspace header, preview surface,
 * and action footer across all timeline insertion modals.
 */
export const PickerModalShell: React.FC<PickerModalShellProps> = ({
    isOpen,
    onClose,
    sidebarWidthClassName = 'w-[340px]',
    sidebarIcon,
    sidebarTitle,
    sidebarHeaderExtra,
    sidebarBody,
    sidebarFooter,
    contentTitle,
    contentBadge,
    contentHeaderRight,
    contentSubheader,
    preview,
    tray,
    footerLeft,
    footerRight,
    extra,
    onKeyDown,
    disableEscapeClose = false,
}) => {
    const { t } = useTranslation();

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !disableEscapeClose) {
                onClose();
                return;
            }
            onKeyDown?.(e);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, onKeyDown, disableEscapeClose]);

    if (!isOpen) return null;

    const modalPortal = createPortal(
        <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-10001 flex items-center justify-center apple-backdrop bg-stone-950/75 backdrop-blur-xl p-6"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !disableEscapeClose) {
                    onClose();
                }
            }}
        >
            <div className="relative bg-stone-900 border border-white/10 ring-1 ring-white/5 rounded-2xl w-full max-w-7xl h-[90vh] flex overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] apple-modal">
                {/* Top-right Close button (first button in DOM order for a11y & tests; 12px inset inside 64px header) */}
                <IconButton
                    icon={<X className="w-4 h-4" />}
                    onClick={onClose}
                    variant="ghost"
                    size="xs"
                    label={t('close', 'Close')}
                    className="absolute top-3 right-3 z-30 text-stone-400 hover:text-white"
                />

                {/* Left Sidebar */}
                <div
                    className={cn(
                        'shrink-0 border-r border-white/[0.06] bg-stone-900 flex flex-col z-20 min-h-0',
                        sidebarWidthClassName
                    )}
                >
                    {/* Sidebar Header (64px height to align horizon line with workspace top bar) */}
                    <div className="h-[64px] px-3 border-b border-white/[0.06] flex items-center gap-2.5 shrink-0">
                        <div
                            title={typeof sidebarTitle === 'string' ? sidebarTitle : undefined}
                            className="w-10 h-10 rounded-lg bg-[#211e1c] border border-white/[0.06] flex items-center justify-center text-accent shrink-0"
                        >
                            {sidebarIcon}
                        </div>
                        {sidebarHeaderExtra ? (
                            <div className="flex-1 min-w-0">
                                {sidebarHeaderExtra}
                            </div>
                        ) : (
                            <h2 className="text-xs font-bold text-stone-100 uppercase tracking-wider truncate">
                                {sidebarTitle}
                            </h2>
                        )}
                    </div>

                    {/* Sidebar Body */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {sidebarBody}
                    </div>

                    {/* Optional Sidebar Footer (e.g. Hymnal / Translation selector card) */}
                    {sidebarFooter && (
                        <div className="shrink-0 p-3 border-t border-white/[0.06] bg-[#141210]">
                            {sidebarFooter}
                        </div>
                    )}
                </div>

                {/* Right Workspace Area */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[#100e0d] min-w-0">
                    {/* Workspace Top Bar (64px height = 12px + 40px Close button + 12px) */}
                    <div className="h-[64px] pl-6 pr-16 border-b border-white/[0.06] flex items-center justify-between gap-4 bg-stone-900 shrink-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <h3 className="text-sm font-bold text-stone-100 tracking-tight truncate">
                                {contentTitle}
                            </h3>
                            {contentBadge}
                        </div>

                        {contentHeaderRight && (
                            <div className="flex items-center gap-2.5 shrink-0">
                                {contentHeaderRight}
                            </div>
                        )}
                    </div>

                    {/* Optional Subheader */}
                    {contentSubheader}

                    {/* Center Preview Area */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {preview}
                    </div>

                    {/* Optional Bottom Tray (Carousel / Mini Timeline) */}
                    {tray}

                    {/* Unified Workspace Footer */}
                    <div className="px-6 py-3.5 border-t border-white/[0.06] bg-stone-900 flex items-center justify-between gap-4 shrink-0 z-20">
                        <div className="flex items-center gap-3 min-w-0">
                            {footerLeft}
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                            {footerRight}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );

    return (
        <>
            {modalPortal}
            {extra}
        </>
    );
};

export default PickerModalShell;
