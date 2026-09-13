import { describe, expect, it } from 'vitest';

import { checkDaemonLoginReply, decideLoginHandoff, decideRelayHandoff } from './daemonHandoff';

const TOKEN = 'gH2_one-time-token-the-app-minted-abc';
const KEY = 'A'.repeat(43);
const REQUEST_URL = `happy://terminal?${KEY}`;

describe('which relay address the daemon should be told', () => {
    it('tells the daemon the address this install resolved', () => {
        expect(decideRelayHandoff({
            shellPresent: true,
            endpoint: { configured: true, url: 'http://127.0.0.1:3016' },
        })).toEqual({ tell: true, url: 'http://127.0.0.1:3016' });
    });

    it('says nothing on the web, where no daemon sits beside the app', () => {
        expect(decideRelayHandoff({
            shellPresent: false,
            endpoint: { configured: true, url: 'https://relay.example.test' },
        })).toEqual({ tell: false, reason: 'no-shell' });
    });

    it('says nothing while no address is configured', () => {
        expect(decideRelayHandoff({ shellPresent: true, endpoint: { configured: false } }))
            .toEqual({ tell: false, reason: 'no-address' });
    });

    it('refuses to pass on an address the daemon could not read back', () => {
        expect(decideRelayHandoff({
            shellPresent: true,
            endpoint: { configured: true, url: 'not a url' },
        })).toEqual({ tell: false, reason: 'no-address' });
        expect(decideRelayHandoff({
            shellPresent: true,
            endpoint: { configured: true, url: 'file:///etc/passwd' },
        })).toEqual({ tell: false, reason: 'no-address' });
    });

    it('hands over the address in the one shape both sides agree on', () => {
        expect(decideRelayHandoff({
            shellPresent: true,
            endpoint: { configured: true, url: 'https://relay.example.test/' },
        })).toEqual({ tell: true, url: 'https://relay.example.test' });
    });
});

describe('whether to ask the daemon to log in', () => {
    it('asks once the app is logged in and a shell is there to ask', () => {
        expect(decideLoginHandoff({ shellPresent: true, loggedIn: true, alreadyAsked: false }))
            .toEqual({ ask: true });
    });

    it('does not ask before there is an account to join', () => {
        expect(decideLoginHandoff({ shellPresent: true, loggedIn: false, alreadyAsked: false }))
            .toEqual({ ask: false, reason: 'not-logged-in' });
    });

    it('does not ask on the web', () => {
        expect(decideLoginHandoff({ shellPresent: false, loggedIn: true, alreadyAsked: false }))
            .toEqual({ ask: false, reason: 'no-shell' });
    });

    it('does not publish a second request while one is in flight', () => {
        expect(decideLoginHandoff({ shellPresent: true, loggedIn: true, alreadyAsked: true }))
            .toEqual({ ask: false, reason: 'already-asked' });
    });
});

describe('approving the daemon\'s own login request', () => {
    it('approves the request the app asked for', () => {
        expect(checkDaemonLoginReply(TOKEN, {
            status: 'awaiting-approval',
            token: TOKEN,
            url: REQUEST_URL,
        })).toEqual({ approve: true, url: REQUEST_URL });
    });

    it('refuses a request that does not carry the token the app minted', () => {
        expect(checkDaemonLoginReply(TOKEN, {
            status: 'awaiting-approval',
            token: `${TOKEN}x`,
            url: REQUEST_URL,
        })).toEqual({ approve: false, reason: 'wrong-token' });
        expect(checkDaemonLoginReply(TOKEN, { status: 'awaiting-approval', url: REQUEST_URL }))
            .toEqual({ approve: false, reason: 'wrong-token' });
    });

    it('refuses every request when the app minted no token', () => {
        expect(checkDaemonLoginReply('', { status: 'awaiting-approval', token: '', url: REQUEST_URL }))
            .toEqual({ approve: false, reason: 'wrong-token' });
    });

    it('approves nothing when the daemon already has an account', () => {
        expect(checkDaemonLoginReply(TOKEN, { status: 'already-authenticated', token: TOKEN }))
            .toEqual({ approve: false, reason: 'nothing-to-approve' });
    });

    it('refuses a reply that is not a reply', () => {
        expect(checkDaemonLoginReply(TOKEN, null)).toEqual({ approve: false, reason: 'nothing-to-approve' });
        expect(checkDaemonLoginReply(TOKEN, 'happy://terminal?' + KEY))
            .toEqual({ approve: false, reason: 'nothing-to-approve' });
    });

    it('refuses anything that is not a one-time login request', () => {
        for (const url of [
            'happy:///account?' + KEY,
            'https://relay.example.test/v1/auth/request',
            'happy://terminal?short',
            'happy://terminal?' + KEY + '/../other',
            'happy://terminal?',
        ]) {
            expect(checkDaemonLoginReply(TOKEN, { status: 'awaiting-approval', token: TOKEN, url }))
                .toEqual({ approve: false, reason: 'not-a-login-request' });
        }
    });
});
