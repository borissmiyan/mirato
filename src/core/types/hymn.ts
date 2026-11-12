import { IStyleLayer } from './style';
import { ICanvasItemText } from './canvas';

export const SOURCE_THEME_ID = 'source';

export type TextAnchor =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface IHymnTheme {
  id: string;
  name: string;
  nameRu?: string;
  isBuiltIn?: boolean;
  isDefault?: boolean;
  updatedAt?: number;

  // Background
  background: IStyleLayer[];

  // Typography applied to the text layer of the hymn
  textStyle: Partial<ICanvasItemText>;

  // 9-point text positioning anchor on canvas
  textAnchor?: TextAnchor;
}

export interface IHymnal {
  id: string;
  name: string; // Original name (e.g. "Песнь Возрождения")
  description?: string;
  language: string; // e.g. "ru", "en", "uk"
  publisher?: string;
  year?: number;
  itemCount: number; // Number of hymns in the hymnal
  coverImageUrl?: string; // Populated at runtime from cover.jpg via IPC
  isBuiltIn?: boolean; // True if this hymnal is from the bundled-hymnals distribution directory
  customDirName?: string; // The folder name in HYMNALS_DIR/custom where this hymnal is stored (if !isBuiltIn)
  defaultThemeId?: string; // Default IHymnTheme ID for this hymnal
  // Mapping of thematic category name -> array of hymn catalog numbers (e.g. ["1", "42", "143"])
  thematicIndex?: Record<string, string[]>;
  syncedManifestVersion?: number;
  syncedMtimeHash?: string;
}

/**
 * A single hymn entry as stored in `hymnal.json` on disk.
 * The `hymnNumber` is the canonical catalog number (e.g. 142),
 * matching numbers used in the thematicIndex.
 * Must be populated manually when building a hymnal bundle.
 */
export interface IHymnalManifestEntry {
  stableHymnId: string;    // e.g. "pesn_vozrozhdeniya_142"
  hymnNumber: number;      // Catalog/sequential number (e.g. 142)
  number?: number;
  id?: string;
  title: string;           // Hymn title
  file: string;            // Relative path to the .ektp file within the hymnal dir
  previousStableIds?: string[]; // Used for migration if the stableHymnId changes
}

/**
 * The full on-disk `hymnal.json` manifest format.
 * Place this file at the root of the hymnal directory.
 *
 * Directory layout:
 *   <hymnalDir>/
 *     hymnal.json      <- this manifest
 *     cover.jpg        <- book cover (optional, 2:3 ratio)
 *     001-title/       <- one dir per hymn
 *       index.ektp
 *
 * @example
 * {
 *   "id": "pesn-vozrozhdeniya",
 *   "name": "Песнь Возрождения",
 *   "language": "ru",
 *   "publisher": "Евангельские христиане-баптисты",
 *   "year": 1988,
 *   "description": "Сборник духовных гимнов",
 *   "thematicIndex": {
 *     "Прославление": ["1", "2", "5"],
 *     "Рождество": ["142", "143"]
 *   },
 *   "hymns": [
 *     { "stableHymnId": "pv_1", "hymnNumber": 1, "title": "Хвала Творцу", "file": "001/index.ektp" },
 *     { "stableHymnId": "pv_142", "hymnNumber": 142, "title": "Тихая ночь", "file": "142/index.ektp" }
 *   ]
 * }
 */
export interface IHymnalManifest {
  id: string;
  name: string;
  language: string;
  publisher?: string;
  year?: number;
  description?: string;
  isBuiltIn?: boolean;
  defaultThemeId?: string;
  thematicIndex?: Record<string, string[]>;
  hymns: IHymnalManifestEntry[];
  manifestVersion?: number;
}

export interface IHymnStableIdMap {
  stableId: string; // e.g. "pesn_vozrozhdeniya_1"
  hymnalId: string; // FK to IHymnal
  presentationId: string; // FK to the presentation file in the DB
}
