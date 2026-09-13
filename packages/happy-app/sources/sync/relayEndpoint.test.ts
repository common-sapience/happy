import { describe, expect, it } from 'vitest';

import { checkRelayAddress, describeRelayAddress, normalizeRelayAddress, resolveRelayEndpoint } from './relayEndpoint';

describe('resolveRelayEndpoint', () => {
    it('reports no relay when nothing names one', () => {
        expect(resolveRelayEndpoint({})).toEqual({ configured: false });
        expect(resolveRelayEndpoint({ stored: null, bakedIn: undefined })).toEqual({ configured: false });
        expect(resolveRelayEndpoint({ stored: '   ', bakedIn: '' })).toEqual({ configured: false });
    });

    it('never falls back to an address nobody configured', () => {
        const resolved = resolveRelayEndpoint({});
        expect(resolved.configured).toBe(false);
        expect(JSON.stringify(resolved)).not.toMatch(/http/);
    });

    it('takes the address entered on this device', () => {
        expect(resolveRelayEndpoint({ stored: 'https://relay.example.test' }))
            .toEqual({ configured: true, url: 'https://relay.example.test' });
    });

    it('takes the address the release was built with', () => {
        expect(resolveRelayEndpoint({ bakedIn: 'https://relay.example.test' }))
            .toEqual({ configured: true, url: 'https://relay.example.test' });
    });

    it('lets the device override what the release was built with', () => {
        expect(resolveRelayEndpoint({ stored: 'http://127.0.0.1:3006', bakedIn: 'https://relay.example.test' }))
            .toEqual({ configured: true, url: 'http://127.0.0.1:3006' });
    });

    it('falls through an unusable stored address to the built-in one', () => {
        expect(resolveRelayEndpoint({ stored: 'not a url', bakedIn: 'https://relay.example.test' }))
            .toEqual({ configured: true, url: 'https://relay.example.test' });
    });

    it('drops the trailing slash so paths join predictably', () => {
        expect(resolveRelayEndpoint({ stored: 'https://relay.example.test//' }))
            .toEqual({ configured: true, url: 'https://relay.example.test' });
    });
});

describe('checkRelayAddress', () => {
    it('names an empty address', () => {
        expect(checkRelayAddress('')).toEqual({ valid: false, problem: 'empty' });
        expect(checkRelayAddress(undefined)).toEqual({ valid: false, problem: 'empty' });
    });

    it('refuses a protocol that is not HTTP', () => {
        expect(checkRelayAddress('ws://relay.example.test')).toEqual({ valid: false, problem: 'protocol' });
        expect(checkRelayAddress('file:///etc/passwd')).toEqual({ valid: false, problem: 'protocol' });
    });

    it('refuses what is not a URL at all', () => {
        expect(checkRelayAddress('relay.example.test')).toEqual({ valid: false, problem: 'format' });
    });

    it('accepts both HTTP and HTTPS', () => {
        expect(checkRelayAddress('http://127.0.0.1:3006')).toEqual({ valid: true, url: 'http://127.0.0.1:3006' });
        expect(checkRelayAddress(' https://relay.example.test/ ')).toEqual({ valid: true, url: 'https://relay.example.test' });
    });
});

describe('normalizeRelayAddress', () => {
    it('gives back nothing for an address that cannot be used', () => {
        expect(normalizeRelayAddress('ws://relay.example.test')).toBeNull();
    });
});

describe('describeRelayAddress', () => {
    it('names the host, with the port when there is one', () => {
        expect(describeRelayAddress('https://relay.example.test')).toBe('relay.example.test');
        expect(describeRelayAddress('http://192.168.0.108:3006')).toBe('192.168.0.108:3006');
    });

    it('gives back nothing for an unparsable address', () => {
        expect(describeRelayAddress('relay.example.test')).toBeNull();
    });
});
