import { useState, useEffect, useRef, useCallback } from 'react';
import { rewriteMediaUrls } from '../utils/mediaUrlRewriter';
import { RemoteSlideState, RemoteSocketOptions } from '../types';
import { useRemoteLifecycleSync } from './useRemoteLifecycleSync';

export type { RemoteSocketOptions };

const getWsUrl = (customHost?: string, customPort?: number) => {
    if (customHost) {
        return `ws://${customHost}:${customPort || 3211}`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const searchParams = new URLSearchParams(window.location.search);
    const overridePort = searchParams.get('wsPort');

    let port = '3211';
    if (overridePort) {
        port = overridePort;
    } else if (window.location.port && window.location.port !== '3210' && window.location.port !== '5173') {
        port = window.location.port;
    }
    return `${protocol}//${window.location.hostname || '127.0.0.1'}:${port}`;
};

export const useRemoteSocket = (options?: RemoteSocketOptions) => {
    const [connected, setConnected] = useState(false);
    const [authError, setAuthError] = useState('');
    const [slideState, setSlideState] = useState<RemoteSlideState | null>(null);
    
    const optionsRef = useRef(options);
    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    const wsRef = useRef<WebSocket | null>(null);
    const pendingRequestsRef = useRef<Record<string, (results: unknown[]) => void>>({});
    const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pendingSignalsRef = useRef<unknown[]>([]);

    // Reconnection & backoff state refs
    const targetPinRef = useRef<string>('');
    const reconnectCountRef = useRef(0);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const maxReconnectAttempts = 5;
    const isManualDisconnectRef = useRef(false);

    const cleanupHeartbeat = useCallback(() => {
        if (heartbeatTimerRef.current) {
            clearInterval(heartbeatTimerRef.current);
            heartbeatTimerRef.current = null;
        }
    }, []);

    const cleanupReconnect = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
    }, []);

    const connect = useCallback((pin: string) => {
        cleanupReconnect();
        cleanupHeartbeat();
        isManualDisconnectRef.current = false;
        targetPinRef.current = pin;

        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
        }
        
        setAuthError('');
        const ws = new WebSocket(getWsUrl(optionsRef.current?.host, optionsRef.current?.port));

        ws.onopen = () => {
            const token = localStorage.getItem('remote_token');
            ws.send(JSON.stringify({
                type: 'AUTH',
                pin,
                token,
                role: optionsRef.current?.role || 'remote',
                speakerName: optionsRef.current?.speakerName
            }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'PONG') {
                    return;
                }

                if (data.type === 'RELAY_SIGNAL') {
                    optionsRef.current?.onSignal?.(data.signal);
                    return;
                }

                if (data.type === 'PRIVACY_UPDATE') {
                    optionsRef.current?.onPrivacyChange?.(data.active);
                    return;
                }

                if (data.type === 'AUTH_SUCCESS') {
                    setConnected(true);
                    reconnectCountRef.current = 0;
                    if (optionsRef.current?.role === 'remote') {
                        localStorage.setItem('remote_token', data.token);
                        localStorage.setItem('remote_pin', pin);
                    }
                    ws.send(JSON.stringify({ type: 'COMMAND', command: 'GET_STATE' }));

                    // Flush any pending WebRTC signals created before auth completed
                    while (pendingSignalsRef.current.length > 0) {
                        const sig = pendingSignalsRef.current.shift();
                        ws.send(JSON.stringify({ type: 'RELAY_SIGNAL', signal: sig }));
                    }

                    // Start NAT keep-alive heartbeat every 15 seconds
                    cleanupHeartbeat();
                    heartbeatTimerRef.current = setInterval(() => {
                        if (wsRef.current?.readyState === WebSocket.OPEN) {
                            wsRef.current.send(JSON.stringify({ type: 'PING' }));
                        }
                    }, 15000);
                } else if (data.type === 'AUTH_ERROR') {
                    setAuthError(data.message);
                    setConnected(false);
                    isManualDisconnectRef.current = true;
                    if (optionsRef.current?.role === 'remote') {
                        localStorage.removeItem('remote_pin');
                        localStorage.removeItem('remote_token');
                    }
                    cleanupHeartbeat();
                } else if (data.type === 'STATE_UPDATE') {
                    const transformed = rewriteMediaUrls(data.payload);
                    setSlideState(transformed);
                } else if (data.type === 'BIBLE_RESULTS') {
                    const resolve = pendingRequestsRef.current[data.requestId];
                    if (resolve) {
                        resolve(data.results);
                        delete pendingRequestsRef.current[data.requestId];
                    }
                }
            } catch (err) {
                console.error('WS Message Parse Error:', err);
            }
        };

        ws.onerror = () => {
            if (optionsRef.current?.role === 'transmitter') {
                setAuthError('Не удалось подключиться к проектору. Проверьте сеть или статус приёмника.');
                isManualDisconnectRef.current = true;
            }
        };

        ws.onclose = () => {
            setConnected(false);
            cleanupHeartbeat();
            
            const isTransmitter = optionsRef.current?.role === 'transmitter';
            if (!isManualDisconnectRef.current && targetPinRef.current && reconnectCountRef.current < maxReconnectAttempts && !isTransmitter) {
                const delay = Math.min(10000, 1000 * Math.pow(2, reconnectCountRef.current));
                
                reconnectCountRef.current += 1;
                reconnectTimerRef.current = setTimeout(() => {
                    connect(targetPinRef.current);
                }, delay);
            }
        };
        wsRef.current = ws;
    }, [cleanupReconnect, cleanupHeartbeat]);

    const sendCommand = useCallback((command: string, payload?: unknown) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'COMMAND', command, payload }));
        }
    }, []);

    const handleBibleQuery = useCallback((type: string, payload: Record<string, unknown>): Promise<unknown[]> => {
        return new Promise((resolve) => {
            const requestId = Math.random().toString(36).substring(7);
            pendingRequestsRef.current[requestId] = resolve as (results: unknown[]) => void;
            sendCommand('BIBLE_QUERY', { type, ...payload, requestId });
        });
    }, [sendCommand]);

    const disconnect = useCallback(() => {
        isManualDisconnectRef.current = true;
        targetPinRef.current = '';
        reconnectCountRef.current = 0;
        cleanupReconnect();
        cleanupHeartbeat();

        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        }
        pendingSignalsRef.current = [];
        setConnected(false);
    }, [cleanupReconnect, cleanupHeartbeat]);

    // Visibility / wake-up reconnect & theme/locale synchronization
    useRemoteLifecycleSync({
        slideState,
        optionsRef,
        isManualDisconnectRef,
        targetPinRef,
        wsRef,
        reconnectCountRef,
        connect
    });

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isManualDisconnectRef.current = true;
            cleanupReconnect();
            cleanupHeartbeat();
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
        };
    }, [cleanupReconnect, cleanupHeartbeat]);

    const sendSignal = useCallback((signal: unknown) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'RELAY_SIGNAL', signal }));
        } else {
            pendingSignalsRef.current.push(signal);
        }
    }, []);

    const setPrivacy = useCallback((active: boolean) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'SET_PRIVACY', active }));
        }
    }, []);

    return {
        connected,
        authError,
        slideState,
        setSlideState,
        connect,
        disconnect,
        sendCommand,
        handleBibleQuery,
        sendSignal,
        setPrivacy
    };
};
