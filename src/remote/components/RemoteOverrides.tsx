import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon } from 'lucide-react';
import { cn } from '../../core/utils/cn';

interface RemoteOverridesProps {
    activeOverride: 'blackout' | 'whiteout' | 'logo' | null | undefined;
    activeLogoUrl: string | undefined;
    onOverrideToggle: (type: 'blackout' | 'whiteout' | 'logo') => void;
    className?: string;
}

export const RemoteOverrides: React.FC<RemoteOverridesProps> = ({
    activeOverride,
    activeLogoUrl,
    onOverrideToggle,
    className
}) => {
    const { t } = useTranslation();

    return (
        <div className={cn("flex items-center justify-center gap-2 bg-stone-900/60 py-2.5 px-3 rounded-4xl border border-white/5 backdrop-blur-md", className)}>
            <button
                type="button"
                aria-label={t('remote.blackout_char')}
                onClick={() => onOverrideToggle('blackout')}
                className={cn(
                    "flex-1 h-full border border-white/5 rounded-2xl flex items-center justify-center apple-press transition-all pt-1",
                    activeOverride === 'blackout' ? "bg-red-600 text-white" : "bg-black/40 text-stone-500"
                )}
            >
                <span className="text-lg font-black">{t('remote.blackout_char')}</span>
            </button>
            <button
                type="button"
                aria-label="Logo"
                onClick={() => onOverrideToggle('logo')}
                className={cn(
                    "flex-1 h-full border border-white/5 rounded-2xl flex items-center justify-center apple-press transition-all overflow-hidden py-2",
                    activeOverride === 'logo' ? "bg-red-600 text-white border-accent/20" : "bg-black/40 text-accent/60"
                )}
            >
                {activeLogoUrl ? (
                    <img
                        src={activeLogoUrl}
                        alt="Logo"
                        className={cn("w-6 h-6 object-contain transition-all", activeOverride === 'logo' && "brightness-0 invert scale-110")}
                    />
                ) : (
                    <ImageIcon size={16} />
                )}
            </button>
            <button
                type="button"
                aria-label={t('remote.whiteout_char')}
                onClick={() => onOverrideToggle('whiteout')}
                className={cn(
                    "flex-1 h-full border border-white/5 rounded-2xl flex items-center justify-center apple-press transition-all pt-1",
                    activeOverride === 'whiteout' ? "bg-red-600 text-white" : "bg-black/40 text-stone-500"
                )}
            >
                <span className="text-lg font-black">{t('remote.whiteout_char')}</span>
            </button>
        </div>
    );
};
