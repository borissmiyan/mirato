import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { Button } from '@/shared/ui/Button';
import { colorTokens, radiusTokens, motionTokens } from '@/shared/tokens';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    className?: string;
    closeOnBackdrop?: boolean;
    closeOnEsc?: boolean;
    zIndex?: number;
}

const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-5xl'
};

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    children,
    size = 'md',
    className,
    closeOnBackdrop = true,
    closeOnEsc = true,
    zIndex = 10000
}) => {
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen || !closeOnEsc) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, closeOnEsc, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className={cn(
                "fixed inset-0 flex items-center justify-center bg-stone-950/75 backdrop-blur-xl p-4 md:p-6",
                motionTokens.backdrop
            )}
            style={{ zIndex }}
            onClick={(e) => {
                if (closeOnBackdrop && e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                ref={contentRef}
                role="dialog"
                aria-modal="true"
                className={cn(
                    "relative w-full bg-stone-900 border flex flex-col overflow-hidden shadow-2xl ring-1 ring-white/5",
                    colorTokens.border,
                    radiusTokens.lg,
                    motionTokens.modal,
                    sizeClasses[size],
                    className
                )}
            >
                {/* Glow ambient highlight */}
                <div className="absolute inset-0 bg-linear-to-b from-white/5 to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col w-full h-full min-h-0">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};

export interface ModalHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    onClose?: () => void;
    className?: string;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
    title,
    description,
    icon,
    onClose,
    className
}) => {
    return (
        <div className={cn("px-6 py-4 border-b border-white/5 flex items-center justify-between gap-4", className)}>
            <div className="flex items-center gap-3 min-w-0">
                {icon && <span className={cn(colorTokens.textMuted, "shrink-0")}>{icon}</span>}
                <div className="min-w-0">
                    <h3 className={cn("text-base font-bold tracking-wide truncate", colorTokens.textPrimary)}>
                        {title}
                    </h3>
                    {description && (
                        <p className={cn("text-xs mt-1 font-medium leading-relaxed", colorTokens.textMuted)}>
                            {description}
                        </p>
                    )}
                </div>
            </div>
            {onClose && (
                <Button
                    size="sm"
                    square
                    variant="ghost"
                    onClick={onClose}
                    className="text-stone-400 hover:text-white shrink-0"
                    aria-label="Close dialog"
                >
                    <X className="w-5 h-5" />
                </Button>
            )}
        </div>
    );
};

export interface ModalBodyProps {
    children: React.ReactNode;
    className?: string;
}

export const ModalBody: React.FC<ModalBodyProps> = ({ children, className }) => {
    return (
        <div className={cn("px-6 py-6 text-stone-300 overflow-y-auto max-h-[75vh]", className)}>
            {children}
        </div>
    );
};

export interface ModalFooterProps {
    children: React.ReactNode;
    className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, className }) => {
    return (
        <div className={cn("px-6 py-4 bg-stone-950/60 border-t border-white/5 flex items-center justify-end gap-3", className)}>
            {children}
        </div>
    );
};

export default Modal;
