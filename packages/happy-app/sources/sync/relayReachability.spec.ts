import { describe, expect, it } from 'vitest';

import {
    RELAY_FIRST_LOAD_PATIENCE_MS,
    classifyRelayFailure,
    resolveAgentListBoot,
} from './relayReachability';

describe('classifyRelayFailure', () => {
    it('reads a relay that answered as a refusal of this account', () => {
        expect(classifyRelayFailure(new Error('Failed to fetch sessions: 401'))).toBe('rejected');
        expect(classifyRelayFailure(new Error('Failed to fetch sessions: 403'))).toBe('rejected');
        // The demo relay answers an account it does not know with a 500.
        expect(classifyRelayFailure(new Error('Failed to fetch sessions: 500'))).toBe('rejected');
    });

    it('reads anything that never answered as an address that does not reach a relay', () => {
        expect(classifyRelayFailure(new TypeError('Failed to fetch'))).toBe('unreachable');
        expect(classifyRelayFailure(new Error('Network request failed'))).toBe('unreachable');
        expect(classifyRelayFailure(undefined)).toBe('unreachable');
        expect(classifyRelayFailure('something else entirely')).toBe('unreachable');
    });

    it('does not mistake a number inside the message for a status', () => {
        expect(classifyRelayFailure(new Error('socket hang up after 30 seconds'))).toBe('unreachable');
    });
});

describe('resolveAgentListBoot', () => {
    it('waits while the first load is still out', () => {
        expect(resolveAgentListBoot({ dataReady: false, stalledOn: null })).toEqual({ state: 'loading' });
    });

    it('gives up waiting once the relay has been named as the trouble', () => {
        expect(resolveAgentListBoot({ dataReady: false, stalledOn: 'unreachable' }))
            .toEqual({ state: 'stalled', failure: 'unreachable' });
        expect(resolveAgentListBoot({ dataReady: false, stalledOn: 'rejected' }))
            .toEqual({ state: 'stalled', failure: 'rejected' });
    });

    it('lets a load that finally arrived win over a stall already reported', () => {
        expect(resolveAgentListBoot({ dataReady: true, stalledOn: 'unreachable' })).toEqual({ state: 'ready' });
    });

    it('bounds the wait, so the spinner cannot outlive anyone waiting on it', () => {
        expect(RELAY_FIRST_LOAD_PATIENCE_MS).toBeGreaterThan(0);
        expect(RELAY_FIRST_LOAD_PATIENCE_MS).toBeLessThanOrEqual(30_000);
    });
});
