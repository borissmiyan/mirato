import { ipcRenderer, contextBridge, type IpcRendererEvent } from 'electron';

console.log('⚡️ Preload script initialized');

// --------- Expose some API to the Renderer process ---------
console.log('⚡️ Exposing electron bridge to window...');
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send(channel: string, ...args: unknown[]) {
            ipcRenderer.send(channel, ...args);
        },
        on(channel: string, func: (...args: unknown[]) => void) {
            const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => func(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        },
        invoke(channel: string, ...args: unknown[]) {
            return ipcRenderer.invoke(channel, ...args);
        },
        selectFile(options?: unknown) {
            return ipcRenderer.invoke('select-file', options);
        },
        selectFolder() {
            return ipcRenderer.invoke('select-folder');
        },
        readDirectoryRecursive(path: string, extensions?: string[]) {
            return ipcRenderer.invoke('read-directory-recursive', path, extensions);
        },
        readFileData(path: string) {
            return ipcRenderer.invoke('read-file-data', path);
        },
        templates: {
            list: () => ipcRenderer.invoke('templates:list'),
            read: (filename: string) => ipcRenderer.invoke('templates:read', filename),
            write: (filename: string, data: Uint8Array) => ipcRenderer.invoke('templates:write', filename, data),
            delete: (filename: string) => ipcRenderer.invoke('templates:delete', filename),
            getPath: () => ipcRenderer.invoke('templates:get-path'),
            seedBundled: () => ipcRenderer.invoke('templates:seed-bundled'),
        },
        export: {
            saveFile: (options?: unknown) => ipcRenderer.invoke('export:save-file', options),
            saveCollection: (options?: unknown) => ipcRenderer.invoke('export:save-collection', options),
        },
        onAspectRatioChanged(callback: (ratio: number) => void) {
            const sub = (_event: IpcRendererEvent, ratio: number) => callback(ratio);
            ipcRenderer.on('on-aspect-ratio-changed', sub);
            return () => ipcRenderer.removeListener('on-aspect-ratio-changed', sub);
        },
        getDesktopSources: (options?: unknown) => ipcRenderer.invoke('desktop-capturer:get-sources', options),
        remote: {
            start: () => ipcRenderer.invoke('remote:start'),
            stop: () => ipcRenderer.invoke('remote:stop'),
            getInfo: () => ipcRenderer.invoke('remote:get-info'),
            discoverReceiver: () => ipcRenderer.invoke('remote:discover-receiver'),
            refresh: () => ipcRenderer.invoke('remote:refresh'),
            selectIp: (ip: string) => ipcRenderer.invoke('remote:select-ip', ip),
            updateState: (payload: unknown) => ipcRenderer.send('remote:update-state', payload),
            onCommand: (callback: (command: string, payload?: unknown) => void) => {
                const sub = (_event: IpcRendererEvent, command: string, payload?: unknown) => callback(command, payload);
                ipcRenderer.on('remote:command-received', sub);
                return () => ipcRenderer.removeListener('remote:command-received', sub);
            },
            sendResults: (requestId: string, results: unknown) => ipcRenderer.send('remote:bible-results', { requestId, results }),
            onRelaySignal: (callback: (signal: unknown) => void) => {
                const sub = (_event: IpcRendererEvent, signal: unknown) => callback(signal);
                ipcRenderer.on('remote:relay-signal', sub);
                return () => ipcRenderer.removeListener('remote:relay-signal', sub);
            },
            sendRelaySignal: (signal: unknown) => ipcRenderer.send('remote:send-relay-signal', signal),
            onSpeakerConnected: (callback: (speaker: unknown) => void) => {
                const sub = (_event: IpcRendererEvent, speaker: unknown) => callback(speaker);
                ipcRenderer.on('remote:speaker-connected', sub);
                return () => ipcRenderer.removeListener('remote:speaker-connected', sub);
            },
            onClientDisconnected: (callback: () => void) => {
                const sub = () => callback();
                ipcRenderer.on('remote:client-disconnected', sub);
                return () => ipcRenderer.removeListener('remote:client-disconnected', sub);
            },
            onSetPrivacy: (callback: (active: boolean) => void) => {
                const sub = (_event: IpcRendererEvent, active: boolean) => callback(active);
                ipcRenderer.on('remote:set-privacy', sub);
                return () => ipcRenderer.removeListener('remote:set-privacy', sub);
            },
        },
        power: {
            setWakeLock: (enabled: boolean) => ipcRenderer.invoke('power:set-wake-lock', enabled),
        },
        hymns: {
            getPath: () => ipcRenderer.invoke('hymns:get-path'),
            seedBundled: () => ipcRenderer.invoke('hymns:seed-bundled'),
            listHymnals: (libraryDir: string) => ipcRenderer.invoke('hymns:list-hymnals', libraryDir),
            readCover: (hymnalDirPath: string) => ipcRenderer.invoke('hymns:read-cover', hymnalDirPath),
            readManifest: (hymnalDirPath: string) => ipcRenderer.invoke('hymns:read-manifest', hymnalDirPath),
            readEktp: (hymnalDirPath: string, filename: string) => ipcRenderer.invoke('hymns:read-ektp', hymnalDirPath, filename),
            importCustom: () => ipcRenderer.invoke('hymns:import-custom'),
            removeCustom: (dirName: string) => ipcRenderer.invoke('hymns:remove-custom', dirName),
            generateTemplate: () => ipcRenderer.invoke('hymns:generate-template'),
        },
    },
});
