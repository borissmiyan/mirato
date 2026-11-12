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
                    importCustom: () => Promise<{ success: boolean; canceled?: boolean; error?: string; manifest?: unknown; dirName?: string }>;
                    removeCustom: (dirName: string) => Promise<boolean>;
                    generateTemplate: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
                };
            };
        };
        showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>;
        showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
    }
}
