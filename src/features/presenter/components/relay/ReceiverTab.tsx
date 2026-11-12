import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';
import { Switch } from '@/shared/ui/Switch';
import { ConnectedSpeaker } from '@/core/store/relayStore';

export interface ReceiverTabProps {
    isReceiverActive: boolean;
    pin: string | null;
    receiverIp?: string | null;
    connectedSpeaker: ConnectedSpeaker | null;
    onToggleReceiver: () => void;
}

export const ReceiverTab: React.FC<ReceiverTabProps> = React.memo(({
    isReceiverActive,
    pin,
    receiverIp,
    connectedSpeaker,
    onToggleReceiver
}) => {
    const { t } = useTranslation();
    const [copiedPin, setCopiedPin] = useState(false);

    const handleCopyPin = () => {
        if (!pin) return;
        navigator.clipboard.writeText(pin);
        setCopiedPin(true);
        setTimeout(() => setCopiedPin(false), 2000);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Service Toggle Bar: Simple, spacious row without extra cards or on/off badges */}
            <div className="flex items-center justify-between pb-6 border-b border-white/5">
                <div className="space-y-1 pr-4">
                    <h3 className="text-base font-bold text-white tracking-tight">
                        {t('receiver_service_title', 'Приём трансляций на проектор')}
                    </h3>
                    <p className="text-xs text-stone-400">
                        {t('receiver_service_desc', 'Приём нативных слайдов 4K и экрана спикера по локальной сети Wi-Fi')}
                    </p>
                </div>

                <Switch
                    checked={isReceiverActive}
                    onChange={onToggleReceiver}
                    size="md"
                />
            </div>

            {isReceiverActive ? (
                <div className="py-6 space-y-10 text-center">
                    {/* PIN Display Block */}
                    <div className="space-y-3">
                        <span className="text-[11px] font-bold text-stone-500 uppercase tracking-[0.25em] block">
                            {t('connect_code', 'Код подключения')}
                        </span>

                        <div className="flex items-center justify-center gap-3">
                            <span className="text-6xl font-mono font-bold tracking-[0.35em] text-white selection:bg-accent/30 pl-3">
                                {pin || '----'}
                            </span>
                            {pin && (
                                <button
                                    type="button"
                                    onClick={handleCopyPin}
                                    className="p-2.5 rounded-xl bg-stone-900 border border-white/10 hover:border-white/20 text-stone-400 hover:text-white transition-colors cursor-pointer"
                                    title="Скопировать PIN"
                                >
                                    {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                </button>
                            )}
                        </div>

                        <p className="text-xs text-stone-500">
                            {t('pin_stage_note', 'PIN отображается на мониторе спикера (Stage Screen)')}
                        </p>

                    </div>

                    {/* Speaker Connection Status */}
                    <div className="pt-4 border-t border-white/5 text-xs">
                        {connectedSpeaker ? (
                            <div className="flex items-center justify-center gap-2 text-emerald-400 font-medium">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span>Спикер в эфире: <strong className="text-white">{connectedSpeaker.name || 'Спикер'}</strong></span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-2 text-stone-500">
                                <div className="w-2 h-2 rounded-full bg-amber-400/80 animate-pulse" />
                                <span>{t('waiting_for_speaker', 'Ожидание подключения спикера по локальной сети...')}</span>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="py-16 text-center space-y-2">
                    <p className="text-sm font-semibold text-stone-400">
                        Приёмник не активен
                    </p>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                        Включите переключатель выше, чтобы принимать слайды и трансляцию со сцены на проектор.
                    </p>
                </div>
            )}
        </div>
    );
});

ReceiverTab.displayName = 'ReceiverTab';
