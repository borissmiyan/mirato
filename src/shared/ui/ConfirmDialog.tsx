import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { Button } from './Button';

interface ConfirmDialogProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    children?: React.ReactNode;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onConfirm,
    onCancel,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    children,
}) => {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onCancel();
                return;
            }
            if (e.key === 'Enter') {
                const target = e.target as HTMLElement;
                const isInput = target && (
                    target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable
                );
                if (isInput) return;
                onConfirm();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onCancel, onConfirm]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-10010 flex items-center justify-center bg-stone-950/75 backdrop-blur-xl apple-backdrop p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div
                ref={panelRef}
                className={cn(
                    "relative w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden ring-1 ring-white/5 apple-modal",
                    danger
                        ? "bg-stone-900 border-red-500/20"
                        : "bg-stone-900 border-white/10"
                )}
            >
                {/* Glow effect */}
                <div className={cn(
                    "absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-32 rounded-full blur-3xl opacity-15 pointer-events-none",
                    danger ? "bg-red-500" : "bg-accent"
                )} />

                {/* Glass inner highlight */}
                <div className="absolute inset-px rounded-[inherit] bg-linear-to-b from-white/5 to-transparent pointer-events-none" />

                <div className="relative z-10 p-6">
                    {/* Icon + Title */}
                    <div className="flex items-start gap-4 mb-4">
                        <div className={cn(
                            "flex items-center justify-center w-12 h-12 rounded-xl shrink-0 border",
                            danger
                                ? "bg-red-500/10 border-red-500/20"
                                : "bg-accent/10 border-accent/20"
                        )}>
                            {danger
                                ? <Trash2 className="w-5 h-5 text-red-400" />
                                : <AlertTriangle className="w-5 h-5 text-accent" />
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider leading-tight">
                                {title}
                            </h3>
                            {description && (
                                <p className="text-xs text-stone-400 mt-1 leading-relaxed font-medium">
                                    {description}
                                </p>
                            )}
                        </div>
                        <Button
                            size="sm"
                            square
                            variant="ghost"
                            onClick={onCancel}
                            className="text-stone-500 hover:text-stone-300 shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Optional children slot */}
                    {children && (
                        <div className="mb-4 pl-16">
                            {children}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pl-16">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onCancel}
                            className="flex-1"
                        >
                            {cancelLabel}
                        </Button>
                        <Button
                            size="sm"
                            variant={danger ? 'danger' : 'primary'}
                            onClick={onConfirm}
                            className="flex-1"
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmDialog;
