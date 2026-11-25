import type { HymnalAudioVariant } from '@/core/types/audio';

export type { HymnalAudioVariant };

export interface HymnalAudioPackPart {
    url: string;
    sha256: string;
    sizeBytes: number;
}

export interface HymnalAudioPackEntry {
    hymnalId: string;
    name: string;
    language: string;
    /** 'minus' = instrumental backing track (default), 'plus' = vocal track. */
    variant?: HymnalAudioVariant;
    version: number;
    trackCount: number;
    sizeBytes: number;
    sha256: string;
    downloadUrl: string;
    /** Optional multi-part .mrta list for packs exceeding GitHub Releases' 2 GB single-file limit. */
    parts?: HymnalAudioPackPart[];
}

export const hasPackDownloadSource = (pack: HymnalAudioPackEntry): boolean =>
    Boolean(pack.downloadUrl || (pack.parts && pack.parts.length > 0));

/**
 * Deterministic storage key on disk & in state maps for a hymnal audio pack.
 * 'minus' stays `<hymnalId>` for 100% backward compatibility; 'plus' uses `<hymnalId>__plus`.
 */
export const getAudioPackStorageKey = (
    hymnalId: string,
    variant: HymnalAudioVariant = 'minus'
): string => (variant === 'plus' ? `${hymnalId}__plus` : hymnalId);

/**
 * Builds a deterministic `hymnal-audio://` fileId for a hymnal track number and variant.
 */
export const buildHymnalAudioFileId = (
    hymnalId: string,
    hymnNumber: number,
    variant: HymnalAudioVariant = 'minus',
    ext: string = 'ogg'
): string => {
    const padded = String(Math.max(0, Math.floor(hymnNumber))).padStart(3, '0');
    return variant === 'plus'
        ? `hymnal-audio://${hymnalId}/plus/${padded}.${ext}`
        : `hymnal-audio://${hymnalId}/${padded}.${ext}`;
};

export interface ParsedHymnalAudioFileId {
    hymnalId: string;
    variant: HymnalAudioVariant;
    trackFile: string;
    hymnNumber: number | null;
}

/**
 * Parses `hymnal-audio://<hymnalId>/[plus/]<track>.ogg` into structured parts.
 */
export const parseHymnalAudioFileId = (fileId?: string | null): ParsedHymnalAudioFileId | null => {
    if (!fileId || !fileId.startsWith('hymnal-audio://')) return null;
    const rel = fileId.slice('hymnal-audio://'.length).replace(/^\/+/, '');
    const parts = rel.split('/').filter(Boolean);
    if (parts.length === 2) {
        const [hymnalId, trackFile] = parts;
        const numMatch = trackFile.match(/^0*(\d+)\./);
        return {
            hymnalId,
            variant: 'minus',
            trackFile,
            hymnNumber: numMatch ? Number(numMatch[1]) : null,
        };
    }
    if (parts.length === 3 && (parts[1] === 'plus' || parts[1] === 'minus')) {
        const [hymnalId, variantPart, trackFile] = parts;
        const numMatch = trackFile.match(/^0*(\d+)\./);
        return {
            hymnalId,
            variant: variantPart === 'plus' ? 'plus' : 'minus',
            trackFile,
            hymnNumber: numMatch ? Number(numMatch[1]) : null,
        };
    }
    return null;
};

/**
 * Rewrites a `hymnal-audio://` fileId to the requested variant ('minus' | 'plus').
 */
export const rewriteHymnalAudioFileIdVariant = (
    fileId: string,
    targetVariant: HymnalAudioVariant
): string => {
    const parsed = parseHymnalAudioFileId(fileId);
    if (!parsed) return fileId;
    return targetVariant === 'plus'
        ? `hymnal-audio://${parsed.hymnalId}/plus/${parsed.trackFile}`
        : `hymnal-audio://${parsed.hymnalId}/${parsed.trackFile}`;
};

/**
 * Built-in catalog of downloadable hymnal audio packs (backing tracks & vocal tracks).
 * Additional future hymnals can be added here or via remote catalog.json
 * hosted in a dedicated `mirato-hymnals` GitHub Releases repository without bloating app releases.
 */
const RU_AUDIO_V1_BASE = 'https://github.com/borissmiyan/mirato-hymnals/releases/download/ru-audio-packs-v1';

export const BUILTIN_HYMNAL_AUDIO_CATALOG: HymnalAudioPackEntry[] = [
    {
        hymnalId: 'hymns-of-hope-ru',
        name: 'Гимны Надежды (1–385)',
        language: 'ru',
        variant: 'minus',
        version: 1,
        trackCount: 385,
        sizeBytes: 528536651,
        sha256: 'a23abdf58a3cf6215a047cf4860726b226ffa96ef9129ee3f7b59d2540f81715',
        downloadUrl: 'https://github.com/borissmiyan/mirato-hymnals/releases/download/hymns-of-hope-ru-v1/hymns-of-hope-ru-audio.mrta',
    },
    {
        hymnalId: 'psalmy-siona-ru',
        name: 'Псалмы Сиона',
        language: 'ru',
        variant: 'minus',
        version: 1,
        trackCount: 140,
        sizeBytes: 197841294,
        sha256: 'ddfe755dd692d14e33851f3143bc81607a11e17b56fd7150cf0a6ed8601b0788',
        downloadUrl: `${RU_AUDIO_V1_BASE}/psalmy-siona-ru-minus.mrta`,
    },
    {
        hymnalId: 'psalmy-siona-ru',
        name: 'Псалмы Сиона',
        language: 'ru',
        variant: 'plus',
        version: 1,
        trackCount: 78,
        sizeBytes: 129529783,
        sha256: 'a829404c767a574dac272f3052b8729160362e7b4ef6df6feb018fd49566de75',
        downloadUrl: `${RU_AUDIO_V1_BASE}/psalmy-siona-ru-plus.mrta`,
    },
    {
        hymnalId: 'istochnik-hvaly-ru',
        name: 'Источник хвалы',
        language: 'ru',
        variant: 'minus',
        version: 1,
        trackCount: 58,
        sizeBytes: 101292285,
        sha256: '4fd1c2f8b9f2de0c8e9e6638f3df46bd4bf367ac13544b2762c11a764676b7e0',
        downloadUrl: `${RU_AUDIO_V1_BASE}/istochnik-hvaly-ru-minus.mrta`,
    },
    {
        hymnalId: 'istochnik-hvaly-ru',
        name: 'Источник хвалы',
        language: 'ru',
        variant: 'plus',
        version: 1,
        trackCount: 60,
        sizeBytes: 94184924,
        sha256: 'f7758eee0c7401ae25a17106f11c7c02e159f7bc700c771462d771b20fb1ba2b',
        downloadUrl: `${RU_AUDIO_V1_BASE}/istochnik-hvaly-ru-plus.mrta`,
    },
    {
        hymnalId: 'rodnik-hvaly-ru',
        name: 'Родник хвалы и вдохновения',
        language: 'ru',
        variant: 'minus',
        version: 1,
        trackCount: 38,
        sizeBytes: 72025612,
        sha256: 'bd3bd2ced1d9f82a98f2c4e132b49330c34be8beb75ca3fb121c58de56c34f7f',
        downloadUrl: `${RU_AUDIO_V1_BASE}/rodnik-hvaly-ru-minus.mrta`,
    },
    {
        hymnalId: 'rodnik-hvaly-ru',
        name: 'Родник хвалы и вдохновения',
        language: 'ru',
        variant: 'plus',
        version: 1,
        trackCount: 12,
        sizeBytes: 20486538,
        sha256: 'dd868dbc5ca90f372ef96ae03289281825fd0a7e6658c97b579b57ec81a6ef19',
        downloadUrl: `${RU_AUDIO_V1_BASE}/rodnik-hvaly-ru-plus.mrta`,
    },
    {
        hymnalId: 'pesn-vozrozhdeniya-3300-ru',
        name: 'Песнь возрождения',
        language: 'ru',
        variant: 'minus',
        version: 1,
        trackCount: 42,
        sizeBytes: 69419339,
        sha256: '87ba3e51ae6513312dbdd183b7cc1b8c723304b4fae1d7bb65aac41e45eb323c',
        downloadUrl: `${RU_AUDIO_V1_BASE}/pesn-vozrozhdeniya-3300-ru-minus.mrta`,
    },
    {
        hymnalId: 'pesn-vozrozhdeniya-3300-ru',
        name: 'Песнь возрождения',
        language: 'ru',
        variant: 'plus',
        version: 1,
        trackCount: 2126,
        sizeBytes: 4570336081,
        sha256: '',
        downloadUrl: '',
        parts: [
            {
                url: `${RU_AUDIO_V1_BASE}/pesn-vozrozhdeniya-3300-ru-plus-part1.mrta`,
                sizeBytes: 1878539947,
                sha256: '604c98e32782234a9db7ba7686afe454dbeb59a3e0eccfb8470e7af924e4efbd',
            },
            {
                url: `${RU_AUDIO_V1_BASE}/pesn-vozrozhdeniya-3300-ru-plus-part2.mrta`,
                sizeBytes: 1876736920,
                sha256: 'f4c2ef09cefd08e7e3dc2cdafb0e0e717598d7fb37f3c380f388d91e26fbb279',
            },
            {
                url: `${RU_AUDIO_V1_BASE}/pesn-vozrozhdeniya-3300-ru-plus-part3.mrta`,
                sizeBytes: 815059214,
                sha256: '77f8a5c03a429aebb51b76240ef7131689e7fb214c66c8893ae5311e54929d44',
            },
        ],
    },
    {
        hymnalId: 'blizhe-byt-k-tebe-ru',
        name: 'Ближе быть к Тебе',
        language: 'ru',
        variant: 'minus',
        version: 1,
        trackCount: 3,
        sizeBytes: 5219544,
        sha256: 'c5acc1f7af571a03a029a7ed4494c2b701e9a17a34fac0992f4bc00e2fb4a80a',
        downloadUrl: `${RU_AUDIO_V1_BASE}/blizhe-byt-k-tebe-ru-minus.mrta`,
    },
    {
        hymnalId: 'blizhe-byt-k-tebe-ru',
        name: 'Ближе быть к Тебе',
        language: 'ru',
        variant: 'plus',
        version: 1,
        trackCount: 11,
        sizeBytes: 22259172,
        sha256: '9f69977d6f3219a7d3a3e2949530278324e9a68c780c2251527e3f2f1ab3f786',
        downloadUrl: `${RU_AUDIO_V1_BASE}/blizhe-byt-k-tebe-ru-plus.mrta`,
    },
    {
        hymnalId: 'poyuschie-serdechki-ru',
        name: 'Поющие сердечки',
        language: 'ru',
        variant: 'minus',
        version: 1,
        trackCount: 5,
        sizeBytes: 4934708,
        sha256: '0ddadd4fb8e4d44fb15c88e1f68504ef5ee0c65ad4512681f8fadf689c1cf4e6',
        downloadUrl: `${RU_AUDIO_V1_BASE}/poyuschie-serdechki-ru-minus.mrta`,
    },
];

export const formatBytesMb = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 МБ';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} ГБ`;
    return `${mb.toFixed(1)} МБ`;
};

export const formatTrackCount = (count: number): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word = mod10 === 1 && mod100 !== 11
        ? 'мелодия'
        : (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
            ? 'мелодии'
            : 'мелодий';
    return `${count} ${word}`;
};
