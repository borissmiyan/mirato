type RelayCommandForwarder = (cmd: string, payload: unknown) => void;
let relayCommandForwarder: RelayCommandForwarder | null = null;

/**
 * Registers an external forwarder (e.g. RelayTransmitterService) to decouple
 * primitive IPC from relay networking and eliminate circular dependencies.
 */
export function setRelayCommandForwarder(forwarder: RelayCommandForwarder | null): void {
    relayCommandForwarder = forwarder;
}

/**
 * Centralized IPC Service to handle all communication between Renderer and Main process.
 * Provides a type-safe wrapper around the Electron bridge.
 */
export const ipcService = {
    /**
     * Checks if the application is running in an Electron environment.
     */
    isElectron(): boolean {
        return !!window.electron?.ipcRenderer;
    },

    /**
     * Sends an asynchronous message to the main process via channel.
     * When wireless relay is connected, forwards projector commands to remote receiver.
     */
    send(channel: string, ...args: unknown[]): void {
        if (channel === 'projector-command') {
            const cmd = args[0];
            if (cmd !== 'video-status' && cmd !== 'audio-status' && cmd !== 'sync-audio-metadata' && cmd !== 'request-video-status') {
                relayCommandForwarder?.(String(args[0]), args[1]);
            }
        }
        if (this.isElectron()) {
            window.electron?.ipcRenderer?.send(channel, ...args);
        } else {
            console.warn(`[IpcService] Attempted to send to channel "${channel}" in non-electron environment.`);
        }
    },

    /**
     * Listens to channel, when a new message arrives func would be called with func(event, args...).
     * Returns an unsubscribe function.
     */
    on(channel: string, func: (...args: unknown[]) => void): () => void {
        if (this.isElectron()) {
            return window.electron?.ipcRenderer?.on(channel, func) || (() => {});
        }
        return () => {};
    },

    /**
     * Sends a message to the main process via channel and expects a result asynchronously.
     */
    async invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
        if (this.isElectron()) {
            return (window.electron?.ipcRenderer?.invoke(channel, ...args) as Promise<T>) || Promise.reject(new Error('ipcRenderer invoke unavailable'));
        }
        throw new Error(`[IpcService] Attempted to invoke channel "${channel}" in non-electron environment.`);
    },

    /**
     * Opens a system file dialog to select files.
     */
    async selectFile(options?: unknown): Promise<string[] | null> {
        if (this.isElectron()) {
            return window.electron?.ipcRenderer?.selectFile(options) || Promise.resolve(null);
        }
        return null;
    },

    /**
     * Opens a system dialog to select a folder.
     */
    async selectFolder(): Promise<string | null> {
        if (this.isElectron()) {
            return window.electron?.ipcRenderer?.selectFolder() || Promise.resolve(null);
        }
        return null;
    },

    /**
     * Recursively lists files in a directory matching specific extensions.
     */
    async readDirectoryRecursive(dirPath: string, extensions?: string[]): Promise<string[]> {
        if (this.isElectron()) {
            return window.electron?.ipcRenderer?.readDirectoryRecursive(dirPath, extensions) || [];
        }
        return [];
    },

    /**
     * Shows a file in the system file manager (Finder / File Explorer).
     */
    async showItemInFolder(filePath: string): Promise<boolean> {
        if (this.isElectron() && filePath) {
            const res = await ipcService.invoke<boolean>('shell:show-item-in-folder', filePath);
            return !!res;
        }
        return false;
    },

    /**
     * Template-related IPC operations.
     */
    templates: {
        list: () => ipcService.invoke<string[]>('templates:list'),
        read: (filename: string) => ipcService.invoke<Uint8Array | null>('templates:read', filename),
        write: (filename: string, data: Uint8Array) => ipcService.invoke<boolean | void>('templates:write', filename, data),
        delete: (filename: string) => ipcService.invoke<boolean | void>('templates:delete', filename),
        getPath: () => ipcService.invoke<string>('templates:get-path'),
        seedBundled: () => ipcService.invoke<boolean | void>('templates:seed-bundled'),
    },

    /**
     * Export-related IPC operations.
     */
    export: {
        saveFile: (options?: unknown) => ipcService.invoke<string | null>('export:save-file', options),
        saveCollection: (options?: unknown) => ipcService.invoke<string | null>('export:save-collection', options),
    },

    /**
     * Power-related IPC operations.
     */
    power: {
        setWakeLock: (enabled: boolean) => ipcService.invoke<boolean>('power:set-wake-lock', enabled),
    },

    /**
     * Clears Chromium app cache and compiled code caches.
     */
    clearAppCache: () => ipcService.invoke<{ success: boolean; error?: string }>('cache:clear'),

    /**
     * Specialized listener for aspect ratio changes.
     */
    onAspectRatioChanged(callback: (ratio: number) => void): () => void {
        if (this.isElectron()) {
            return window.electron?.ipcRenderer?.onAspectRatioChanged(callback) || (() => {});
        }
        return () => {};
    }
};

/** @deprecated Use ipcService instead. */
export const IpcService = ipcService;
