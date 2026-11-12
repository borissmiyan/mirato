import React from 'react';
import { Tv, Lock, X } from 'lucide-react';
import { useRelayStore } from '@/core/store/relayStore';
import { relayTransmitterService } from '@/core/services/RelayTransmitterService';
import { cn } from '@/core/utils/cn';

export interface TransmitterStatusBadgeProps {
    onOpenModal?: () => void;
    className?: string;
}

/**
 * Top-bar floating status badge for speaker laptops actively transmitting
 * commands to a church projector over the network (AirDeck Network Instance).
 */
export const TransmitterStatusBadge: React.FC<TransmitterStatusBadgeProps> = React.memo(({
    onOpenModal,
    className
}) => {
    const isTransmitterConnected = useRelayStore((s) => s.isTransmitterConnected);
    const isReceiverActive = useRelayStore((s) => s.isReceiverActive);
    const isPrivacyActive = useRelayStore((s) => s.isPrivacyActive);

    if (!isTransmitterConnected) return null;

    const handleDisconnect = (e: React.MouseEvent) => {
        e.stopPropagation();
        relayTransmitterService.disconnect();
    };

    return (
        <div
            onClick={onOpenModal}
            role="button"
            tabIndex={0}
            aria-label="Статус трансляции на проектор"
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    onOpenModal?.();
                }
            }}
            className={cn(
                "fixed top-4 z-50 flex items-center gap-3 px-3.5 py-2 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-2 cursor-pointer select-none bg-emerald-950/80 border-emerald-500/30 text-emerald-200 hover:border-emerald-500/50 hover:bg-emerald-950/90",
                isReceiverActive ? "right-56" : "right-4",
                className
            )}
        >
            <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-400 animate-pulse" />
                <Tv className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="flex items-center gap-2 text-xs font-medium">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-white max-w-[160px] truncate">
                        В эфире на проекторе
                    </span>
                    {isPrivacyActive && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xl bg-stone-900/80 text-[10px] text-amber-300 border border-amber-500/30 uppercase tracking-widest font-bold">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Mute</span>
                        </span>
                    )}
                </div>
            </div>

            <button
                type="button"
                onClick={handleDisconnect}
                aria-label="Отключиться от проектора"
                title="Отключиться от проектора"
                className="ml-1 p-1 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
});

TransmitterStatusBadge.displayName = 'TransmitterStatusBadge';
