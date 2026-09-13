/**
 * Where this install is allowed to reach a relay.
 *
 * There is no built-in address: the product never connects to a server the
 * operator did not name. A release either bakes one in at build time or the
 * first screen asks for one.
 */

export type RelayEndpoint =
    | { configured: true; url: string }
    | { configured: false };

export type RelayAddressSources = {
    /** The address entered on this device, kept across logouts. */
    stored?: string | null;
    /** The address this release was built with. */
    bakedIn?: string | null;
};

export type RelayAddressProblem = 'empty' | 'protocol' | 'format';

export type RelayAddressCheck =
    | { valid: true; url: string }
    | { valid: false; problem: RelayAddressProblem };

export function checkRelayAddress(raw: string | null | undefined): RelayAddressCheck {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) {
        return { valid: false, problem: 'empty' };
    }
    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return { valid: false, problem: 'format' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, problem: 'protocol' };
    }
    if (!parsed.hostname) {
        return { valid: false, problem: 'format' };
    }
    return { valid: true, url: trimmed.replace(/\/+$/, '') };
}

export function normalizeRelayAddress(raw: string | null | undefined): string | null {
    const checked = checkRelayAddress(raw);
    return checked.valid ? checked.url : null;
}

export function resolveRelayEndpoint(sources: RelayAddressSources): RelayEndpoint {
    const stored = normalizeRelayAddress(sources.stored);
    if (stored) {
        return { configured: true, url: stored };
    }
    const bakedIn = normalizeRelayAddress(sources.bakedIn);
    if (bakedIn) {
        return { configured: true, url: bakedIn };
    }
    return { configured: false };
}

export function describeRelayAddress(url: string): string | null {
    try {
        const parsed = new URL(url);
        return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    } catch {
        return null;
    }
}
