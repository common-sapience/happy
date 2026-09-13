import { MMKV } from 'react-native-mmkv';

import { describeRelayAddress, normalizeRelayAddress, resolveRelayEndpoint, type RelayEndpoint } from './relayEndpoint';

// Separate MMKV instance for server config that persists across logouts
const serverConfigStorage = new MMKV({ id: 'server-config' });

const SERVER_KEY = 'custom-server-url';
const LOG_SERVER_KEY = 'log-server-url';

function bakedInRelayAddress(): string | null {
    return (globalThis as any).__HAPPY_CONFIG__?.serverUrl
        ?? process.env.EXPO_PUBLIC_HAPPY_SERVER_URL
        ?? null;
}

export class RelayNotConfiguredError extends Error {
    constructor() {
        super('No relay address is configured on this device');
        this.name = 'RelayNotConfiguredError';
    }
}

export function getRelayEndpoint(): RelayEndpoint {
    return resolveRelayEndpoint({
        stored: serverConfigStorage.getString(SERVER_KEY),
        bakedIn: bakedInRelayAddress(),
    });
}

export function isRelayConfigured(): boolean {
    return getRelayEndpoint().configured;
}

/**
 * The relay every request goes to. Callers reach it only past the first screen,
 * which does not let the app run until an address is configured; throwing here
 * keeps an unconfigured install from reaching a server nobody chose.
 */
export function getServerUrl(): string {
    const endpoint = getRelayEndpoint();
    if (!endpoint.configured) {
        throw new RelayNotConfiguredError();
    }
    return endpoint.url;
}

/** The relay host as the headers show it, or null while no relay is configured. */
export function getRelayLabel(): string | null {
    const endpoint = getRelayEndpoint();
    return endpoint.configured ? describeRelayAddress(endpoint.url) : null;
}

export function rewriteLoopbackHost(url: string): string {
    try {
        const target = new URL(url);
        if (target.hostname !== 'localhost' && target.hostname !== '127.0.0.1' && target.hostname !== '::1') {
            return url;
        }
        const reachable = new URL(getServerUrl());
        target.protocol = reachable.protocol;
        target.host = reachable.host;
        return target.toString();
    } catch {
        return url;
    }
}

export function setServerUrl(url: string | null): void {
    const normalized = normalizeRelayAddress(url);
    if (normalized) {
        serverConfigStorage.set(SERVER_KEY, normalized);
    } else {
        serverConfigStorage.delete(SERVER_KEY);
    }
}

export function getLogServerUrl(): string | null {
    return serverConfigStorage.getString(LOG_SERVER_KEY) ||
           process.env.EXPO_PUBLIC_LOG_SERVER_URL ||
           null;
}

export function setLogServerUrl(url: string | null): void {
    if (url && url.trim()) {
        serverConfigStorage.set(LOG_SERVER_KEY, url.trim());
    } else {
        serverConfigStorage.delete(LOG_SERVER_KEY);
    }
}
