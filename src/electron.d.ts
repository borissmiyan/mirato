export interface DesktopCaptureSourceItem {
    id: string;
    name: string;
    thumbnail: string;
    appIcon?: string | null;
}

export interface RemoteServerInfo {
    success: boolean;
    ip?: string;
    port?: number;
    pin?: string;
    availableIps?: Array<{ name: string; ip: string }>;
    error?: string;
    isRunning?: boolean;
}

declare global {
    interface Window {
        electron?: {
            ipcRenderer: {
                send: (channel: string, ...args: unknown[]) => void;
                on: (channel: string, func: (...args: unknown[]) => void) => () => void;
                invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
                selectFile: (options?: unknown) => Promise<string[] | null>;
                selectFolder: () => Promise<string | null>;
                readDirectoryRecursive: (path: string, extensions?: string[]) => Promise<string[]>;
                readFileData: (path: string) => Promise<Uint8Array | { data: Uint8Array; mimeType: string } | null>;
                onAspectRatioChanged: (callback: (ratio: number) => void) => () => void;
                getDesktopSources?: (options?: unknown) => Promise<DesktopCaptureSourceItem[]>;
                templates: {
                    list: () => Promise<string[]>;
                    read: (filename: string) => Promise<Uint8Array | null>;
                    write: (filename: string, data: Uint8Array) => Promise<boolean | void>;
                    delete: (filename: string) => Promise<boolean | void>;
                    getPath: () => Promise<string>;
                    seedBundled: () => Promise<boolean | void>;
                };
                export: {
                    saveFile: (options?: unknown) => Promise<string | null>;
                    saveCollection: (options?: unknown) => Promise<string | null>;
                };
                power: {
                    setWakeLock: (enabled: boolean) => Promise<boolean>;
                };
                remote: {
                    start: () => Promise<RemoteServerInfo>;
                    stop: () => Promise<boolean>;
                    getInfo: () => Promise<RemoteServerInfo>;
                    discoverReceiver?: () => Promise<{ found: boolean; ip?: string; port?: number; isLocal?: boolean }>;
                    refresh: () => Promise<RemoteServerInfo>;
                    selectIp: (ip: string) => Promise<RemoteServerInfo>;
                    updateState: (payload: unknown) => void;
                    onCommand: (callback: (command: string, payload?: unknown) => void) => () => void;
                    sendResults: (requestId: string, results: unknown) => void;
                    onRelaySignal?: (callback: (signal: unknown) => void) => () => void;
                    sendRelaySignal?: (signal: unknown) => void;
                    onSpeakerConnected?: (callback: (speaker: unknown) => void) => () => void;
                    onClientDisconnected?: (callback: () => void) => () => void;
                    onSetPrivacy?: (callback: (active: boolean) => void) => () => void;
                };
                hymns: {
                    getPath: () => Promise<string>;
                    seedBundled: () => Promise<boolean | void>;
                    listHymnals: (libraryDir: string) => Promise<Array<{ path: string; languageFolder?: string; isBundled: boolean }>>;
                    readCover: (hymnalDirPath: string) => Promise<string | null>;
                    readManifest: (hymnalDirPath: string) => Promise<unknown | null>;
                    readEktp: (hymnalDirPath: string, filename: string) => Promise<Uint8Array | null>;
                    readMrtpBatch?: (hymnalDirPath: string, filenames: string[]) => Promise<Array<{
                        filename: string;
                        hash?: string;
                        presentation?: Record<string, unknown>;
                        needsFullUnpack?: boolean;
                        error?: boolean;
                    }>>;
                    importCustom: () => Promise<{ success: boolean; canceled?: boolean; error?: string; manifest?: unknown; dirName?: string }>;
                    removeCustom: (dirName: string) => Promise<boolean>;
                    generateTemplate: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
                };
                hymnalAudio?: {
                    listInstalled: () => Promise<Array<{ hymnalId: string; variant?: 'minus' | 'plus'; packKey?: string; version: number; trackCount: number; bytesOnDisk: number; installedAt?: string }>>;
                    isInstalled: (hymnalId: string, variant?: 'minus' | 'plus') => Promise<boolean>;
                    getAvailableVariants: (hymnalId: string, hymnNumber: number) => Promise<{ minus: boolean; plus: boolean }>;
                    downloadPack: (params: { hymnalId: string; variant?: 'minus' | 'plus'; url?: string; version?: number; expectedSha256?: string; expectedBytes?: number; parts?: Array<{ url: string; sha256?: string; sizeBytes?: number }> }) => Promise<{ success: boolean; canceled?: boolean; error?: string; info?: { hymnalId: string; variant?: 'minus' | 'plus'; packKey?: string; version: number; trackCount: number; bytesOnDisk: number } }>;
                    cancelDownload: (hymnalId: string, variant?: 'minus' | 'plus') => Promise<boolean>;
                    installFromFile: (hymnalId: string, version?: number, variant?: 'minus' | 'plus') => Promise<{ success: boolean; canceled?: boolean; error?: string; info?: { hymnalId: string; variant?: 'minus' | 'plus'; packKey?: string; version: number; trackCount: number; bytesOnDisk: number } }>;
                    removePack: (hymnalId: string, variant?: 'minus' | 'plus') => Promise<{ success: boolean; error?: string }>;
                    onProgress: (callback: (payload: { hymnalId: string; variant?: 'minus' | 'plus'; packKey?: string; phase: 'downloading' | 'verifying' | 'extracting' | 'done' | 'error' | 'canceled'; percent: number; bytesReceived: number; totalBytes: number; speedBytesPerSec?: number; error?: string }) => void) => () => void;
                };
            };
        };
        showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>;
        showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
    }
}
