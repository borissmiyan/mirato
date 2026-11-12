import { IHymnTheme, SOURCE_THEME_ID } from '@/core/types/hymn';
import { IStyleLayer } from '@/core/types/style';

export { SOURCE_THEME_ID };

export const DEFAULT_HYMN_THEME_ID = 'builtin-default';

export const DEFAULT_HYMN_THEME: IHymnTheme = {
    id: DEFAULT_HYMN_THEME_ID,
    name: 'Default',
    nameRu: 'По умолчанию',
    isBuiltIn: true,
    isDefault: true,
    background: [
        { type: 'color', color: '#000000', id: 'bg-1', visible: true, opacity: 1, blendMode: 'normal' } as IStyleLayer
    ],
    textStyle: {
        fontFamily: 'Trajan Pro',
        fontSize: 60,
        color: '#FFFFFF',
        alignHorizontal: 'center',
        alignVertical: 'middle',
        lineHeight: 1.2,
        fontWeight: 'normal'
    },
    updatedAt: Date.now()
};

