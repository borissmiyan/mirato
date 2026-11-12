import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSetAtom } from 'jotai';
import { Check, Search, X } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { SearchInput } from '@/shared/ui';
import { fontPreviewWeightAtom } from '@/core/store/uiAtoms';
import { getSystemFontData, normalizeFontStyle, getWeightName } from '@/core/services/fontService';
import { AVAILABLE_FONTS } from '@/core/data/fonts';

interface FontWeightPickerProps {
    family: string;
    value: string;
    onSelect: (weight: string) => void;
    className?: string;
}

const getBundledWeights = (t: (key: string, fallback?: string) => string) => [
    { name: t('weight_thin'), value: '100' },
    { name: t('weight_extra_light'), value: '200' },
    { name: t('weight_light'), value: '300' },
    { name: t('weight_regular'), value: '400' },
    { name: t('weight_medium'), value: '500' },
    { name: t('weight_semi_bold'), value: '600' },
    { name: t('weight_bold'), value: '700' },
    { name: t('weight_extra_bold'), value: '800' },
    { name: t('weight_black'), value: '900' },
    { name: `${t('weight_thin')} ${t('italic')}`, value: '100 italic' },
    { name: `${t('weight_light')} ${t('italic')}`, value: '300 italic' },
    { name: t('italic'), value: '400 italic' },
    { name: `${t('weight_medium')} ${t('italic')}`, value: '500 italic' },
    { name: `${t('weight_bold')} ${t('italic')}`, value: '700 italic' },
    { name: `${t('weight_black')} ${t('italic')}`, value: '900 italic' },
];

export const FontWeightPicker: React.FC<FontWeightPickerProps> = ({
    family,
    value,
    onSelect,
    className
}) => {
    const { t } = useTranslation();
    const setWeightPreview = useSetAtom(fontPreviewWeightAtom);
    const [availableStyles, setAvailableStyles] = React.useState<{ name: string; value: string }[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');

    React.useEffect(() => {
        const fetchStyles = async () => {
            setLoading(true);
            const translate = (key: string, fallback?: string): string => String(t(key, fallback || ''));
            const isBundled = AVAILABLE_FONTS.some(f => f.name === family);

            if (isBundled) {
                const def = AVAILABLE_FONTS.find(f => f.name === family);
                // Map weights to localized names
                const mappedWeights = (def?.weights || getBundledWeights(translate)).map(w => ({
                    ...w,
                    name: getWeightName(w.value, translate)
                }));
                setAvailableStyles(mappedWeights);
            } else {
                const allData = await getSystemFontData();
                const familyData = allData.filter(f => f.family === family);

                if (familyData.length > 0) {
                    const styles = familyData.map(f => ({
                        name: getWeightName(f.style, translate),
                        value: f.style
                    }));
                    // De-duplicate if necessary and sort
                    const seen = new Set();
                    const uniqueStyles = styles.filter(s => {
                        if (seen.has(s.value)) return false;
                        seen.add(s.value);
                        return true;
                    });
                    setAvailableStyles(uniqueStyles);
                } else {
                    setAvailableStyles(getBundledWeights(translate)); // Fallback
                }
            }
            setLoading(false);
        };
        fetchStyles();
    }, [family, t]);

    const filteredStyles = React.useMemo(() => {
        if (!searchQuery.trim()) return availableStyles;
        const q = searchQuery.toLowerCase();
        return availableStyles.filter(s => s.name.toLowerCase().includes(q));
    }, [availableStyles, searchQuery]);

    return (
        <div className={cn("flex flex-col gap-2 min-w-[200px] max-h-[400px]", className)}>
            {/* Search */}
            <div className="px-1 mb-1">
                <SearchInput
                    size="xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery('')}
                    placeholder={t('search_styles_placeholder')}
                    className="w-full bg-black/40 border-white/5 font-sans"
                />
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-1">
                {loading ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 opacity-30">
                        <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredStyles.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                        {filteredStyles.map((style) => (
                            <button
                                type="button"
                                key={style.value}
                                onClick={() => onSelect(style.value)}
                                onMouseEnter={() => setWeightPreview(style.value)}
                                onMouseLeave={() => setWeightPreview(null)}
                                className={cn(
                                    "flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 group text-left apple-press cursor-pointer",
                                    value === style.value
                                        ? "bg-accent/10 text-accent font-bold"
                                        : "text-stone-400 hover:bg-white/5 hover:text-stone-200"
                                )}
                            >
                                <span className="text-[11px] font-medium truncate" style={{ fontFamily: family }}>
                                    {style.name}
                                </span>
                                {value === style.value && (
                                    <Check className="w-3 h-3 shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="py-6 text-center opacity-30">
                        <span className="text-[10px] uppercase tracking-widest font-black">{t('no_styles_found')}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
