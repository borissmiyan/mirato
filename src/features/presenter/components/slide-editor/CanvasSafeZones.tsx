import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * TV & Projector Safe Zones overlay for church / live displays.
 * Action Safe: 95% (2.5% inset) — graphic elements won't be cut off by screen bezels.
 * Title Safe: 90% (5% inset) — lyrics and scriptures guaranteed fully readable.
 */
export const CanvasSafeZones: React.FC = React.memo(() => {
    const { t } = useTranslation();

    return (
        <div className="absolute inset-0 pointer-events-none z-30 select-none overflow-hidden">
            {/* Center Crosshair */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-px bg-white/40" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-px bg-white/40" />
            </div>

            {/* Action Safe Zone (95% area / 2.5% inset) */}
            <div
                className="absolute border border-dashed border-white/20"
                style={{
                    left: '2.5%',
                    top: '2.5%',
                    width: '95%',
                    height: '95%',
                }}
            >
                <span className="absolute top-1 left-1.5 px-1 py-0.5 rounded text-[8px] font-sans tabular-nums font-bold tracking-wider uppercase bg-black/70 text-stone-400 border border-white/10 shadow-sm backdrop-blur-xs">
                    {t('safe_zone_action', 'Action Safe 95%')}
                </span>
            </div>

            {/* Title Safe Zone (90% area / 5% inset) */}
            <div
                className="absolute border border-dashed border-accent/50 ring-1 ring-black/40"
                style={{
                    left: '5%',
                    top: '5%',
                    width: '90%',
                    height: '90%',
                }}
            >
                <span className="absolute bottom-1 right-1.5 px-1 py-0.5 rounded text-[8px] font-sans tabular-nums font-bold tracking-wider uppercase bg-black/80 text-accent border border-accent/40 shadow-sm backdrop-blur-xs">
                    {t('safe_zone_title', 'Title Safe 90%')}
                </span>
            </div>
        </div>
    );
});

CanvasSafeZones.displayName = 'CanvasSafeZones';

