import React from 'react';
import { Radio, Lock, X } from 'lucide-react';
import { useRelayStore } from '@/core/store/relayStore';
import { cn } from '@/core/utils/cn';

export interface ReceiverStatusBadgeProps {
    onStop: () => void;
    className?: string;
}

export const ReceiverStatusBadge: React.FC<ReceiverStatusBadgeProps> = React.memo(({
    onStop,
    className
}) => {
    const isReceiverActive = useRelayStore((s) => s.isReceiverActive);
    const pin = useRelayStore((s) => s.pin);
    const connectedSpeaker = useRelayStore((s) => s.connectedSpeaker);
    const isPrivacyActive = useRelayStore((s) => s.isPrivacyActive);

    if (!isReceiverActive) return null;

    const isConnected = !!connectedSpeaker;

    return (
        <div
            className={cn(
                "fixed top-4 right-4 z-50 flex items-center gap-3 px-3.5 py-2 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-2",
                isConnected
                    ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-200"
                    : "bg-stone-900/90 border-accent/30 text-stone-200",
                className
            )}
        >
            <div className="flex items-center gap-2">
                <div className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0",
                    isConnected ? "bg-emerald-400 animate-pulse" : "bg-accent animate-ping"
                )} />
                <Radio className={cn("w-4 h-4", isConnected ? "text-emerald-400" : "text-accent")} />
            </div>

            <div className="flex items-center gap-2 text-xs font-medium">
                {isConnected ? (
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-white max-w-[130px] truncate">
                            {connectedSpeaker.name || 'Спикер в эфире'}
                        </span>
                        {isPrivacyActive && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xl bg-stone-900/80 text-[10px] text-amber-300 border border-amber-500/30 uppercase tracking-widest font-bold">
                                <Lock className="w-2.5 h-2.5" />
                                <span>Конфиденциально</span>
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="text-stone-400 font-sans">Ожидание спикера...</span>
                        <span className="px-2 py-0.5 rounded-xl bg-stone-950/60 font-sans tabular-nums font-bold text-white border border-white/10 tracking-widest text-sm">
                            {pin}
                        </span>
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={onStop}
                aria-label={isConnected ? "Завершить трансляцию" : "Отмена"}
                title={isConnected ? "Завершить трансляцию спикера" : "Отмена режима приёмника"}
                className="ml-1 p-1 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
});

ReceiverStatusBadge.displayName = 'ReceiverStatusBadge';
