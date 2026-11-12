import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RemoteSlideState, RemoteSocketOptions } from '../types';

interface UseRemoteLifecycleSyncProps {
    slideState: RemoteSlideState | null;
    optionsRef: React.MutableRefObject<RemoteSocketOptions | undefined>;
    isManualDisconnectRef: React.MutableRefObject<boolean>;
    targetPinRef: React.MutableRefObject<string>;
    wsRef: React.MutableRefObject<WebSocket | null>;
    reconnectCountRef: React.MutableRefObject<number>;
    connect: (pin: string) => void;
}

/**
 * Handles visibility/network wake-up reconnection and theme/locale synchronization for remote socket.
 */
export function useRemoteLifecycleSync({
    slideState,
    optionsRef,
    isManualDisconnectRef,
    targetPinRef,
    wsRef,
    reconnectCountRef,
    connect
}: UseRemoteLifecycleSyncProps) {
    const { i18n } = useTranslation();

    // Screen Unlock / Visibility / Network Restoration Reconnect
    useEffect(() => {
        const handleWakeAndReconnect = () => {
            // Only auto-reconnect for mobile remote web app, NEVER for desktop transmitter
            if (optionsRef.current?.role !== 'remote') return;

            if (document.visibilityState === 'visible' && !isManualDisconnectRef.current) {
                const pin = targetPinRef.current || localStorage.getItem('remote_pin');
                if (pin && wsRef.current?.readyState !== WebSocket.OPEN) {
                    console.log('[RemoteSocket] Tab visible or online, restoring connection...');
                    reconnectCountRef.current = 0;
                    connect(pin);
                }
            }
        };

        document.addEventListener('visibilitychange', handleWakeAndReconnect);
        window.addEventListener('online', handleWakeAndReconnect);

        return () => {
            document.removeEventListener('visibilitychange', handleWakeAndReconnect);
            window.removeEventListener('online', handleWakeAndReconnect);
        };
    }, [connect, isManualDisconnectRef, optionsRef, reconnectCountRef, targetPinRef, wsRef]);

    // Theme & Language Sync
    useEffect(() => {
        const legacySettings = (slideState?.settings ?? {}) as { appearance?: { themeAccent?: string } };
        const theme = slideState?.themeAccent || 
            slideState?.settings?.background?.[0]?.color || 
            legacySettings.appearance?.themeAccent;
        if (theme) {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('remote-theme', theme);
        }

        const targetLang = slideState?.language;
        if (targetLang && !i18n.language.startsWith(targetLang)) {
            i18n.changeLanguage(targetLang);
            localStorage.setItem('remote-lang', targetLang);
        }
    }, [slideState, i18n]);
}
