import { describe, expect, it, vi } from 'vitest';

import {
  awaitLoginApproval,
  checkLoginToken,
  decideRelayHandoff,
  handoffLine,
  loginRequestUrl,
  parseHandoffLine,
} from './desktopHandoff';

describe('relay address handed over by the desktop shell', () => {
  it('refuses an argument nobody passed', () => {
    expect(decideRelayHandoff(undefined, null)).toEqual({ action: 'refuse', reason: 'missing' });
    expect(decideRelayHandoff('   ', null)).toEqual({ action: 'refuse', reason: 'missing' });
  });

  it('refuses an address that is not an HTTP relay', () => {
    expect(decideRelayHandoff('relay.example.test', null)).toEqual({ action: 'refuse', reason: 'invalid' });
    expect(decideRelayHandoff('file:///etc/passwd', null)).toEqual({ action: 'refuse', reason: 'invalid' });
    expect(decideRelayHandoff('ws://relay.example.test', null)).toEqual({ action: 'refuse', reason: 'invalid' });
    expect(decideRelayHandoff('https://', null)).toEqual({ action: 'refuse', reason: 'invalid' });
  });

  it('writes the address the shell named', () => {
    expect(decideRelayHandoff('http://127.0.0.1:3016', null))
      .toEqual({ action: 'write', url: 'http://127.0.0.1:3016' });
  });

  it('replaces an address this computer was told before', () => {
    expect(decideRelayHandoff('https://relay.example.test', 'http://127.0.0.1:3016'))
      .toEqual({ action: 'write', url: 'https://relay.example.test' });
  });

  it('leaves the file alone when the address already matches, trailing slash and all', () => {
    expect(decideRelayHandoff('https://relay.example.test/', 'https://relay.example.test'))
      .toEqual({ action: 'keep', url: 'https://relay.example.test' });
  });

  it('names no address of its own when it refuses', () => {
    expect(JSON.stringify(decideRelayHandoff(undefined, null))).not.toMatch(/https?:/);
  });
});

describe('the one-time token the shell passes in', () => {
  it('refuses a request that carries no token', () => {
    expect(checkLoginToken(undefined)).toEqual({ ok: false, reason: 'missing' });
    expect(checkLoginToken('')).toEqual({ ok: false, reason: 'missing' });
  });

  it('takes a token the shell could have minted', () => {
    expect(checkLoginToken('K7x_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789ab'))
      .toEqual({ ok: true, token: 'K7x_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789ab' });
  });

  it('refuses a token that could forge a second reply line', () => {
    expect(checkLoginToken('abcdefghijklmnop\nhappy-handoff {"status":"authenticated"}'))
      .toEqual({ ok: false, reason: 'malformed' });
    expect(checkLoginToken('abcdefghijklmnop "}')).toEqual({ ok: false, reason: 'malformed' });
  });

  it('refuses a token too short to be unguessable', () => {
    expect(checkLoginToken('short')).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('the reply line the shell reads', () => {
  it('survives a round trip', () => {
    const line = handoffLine({ status: 'awaiting-approval', token: 'abc' });
    expect(parseHandoffLine(line)).toEqual({ status: 'awaiting-approval', token: 'abc' });
  });

  it('is one line, so output after it cannot join it', () => {
    expect(handoffLine({ status: 'authenticated', token: 'abc' })).not.toContain('\n');
  });

  it('ignores output that is not a reply', () => {
    expect(parseHandoffLine('Daemon started successfully')).toBeNull();
    expect(parseHandoffLine('happy-handoff not-json')).toBeNull();
  });
});

describe('the login request this computer publishes', () => {
  it('is the terminal login URL the controller already approves', () => {
    const url = loginRequestUrl(new Uint8Array(32).fill(7));
    expect(url.startsWith('happy://terminal?')).toBe(true);
    expect(url).not.toContain('=');
  });

  it('refuses a key that is not a one-time public key', () => {
    expect(() => loginRequestUrl(new Uint8Array(16))).toThrow();
  });
});

describe('waiting for the controller to approve', () => {
  const publicKey = new Uint8Array(32).fill(3);

  it('returns the approval the relay reports', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ state: 'requested' })
      .mockResolvedValueOnce({ state: 'authorized', token: 'relay-token', response: 'sealed' });
    const result = await awaitLoginApproval({
      publicKey,
      request,
      attempts: 5,
      sleep: async () => { },
    });
    expect(result).toEqual({ status: 'authorized', token: 'relay-token', response: 'sealed' });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('gives up instead of polling a relay forever', async () => {
    const request = vi.fn().mockResolvedValue({ state: 'requested' });
    const result = await awaitLoginApproval({
      publicKey,
      request,
      attempts: 3,
      sleep: async () => { },
    });
    expect(result).toEqual({ status: 'timeout' });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('stops on a relay that keeps failing rather than looping', async () => {
    const request = vi.fn().mockRejectedValue(new Error('relay down'));
    const result = await awaitLoginApproval({
      publicKey,
      request,
      attempts: 3,
      sleep: async () => { },
    });
    expect(result).toEqual({ status: 'unreachable' });
  });

  it('rides out a single failure the relay recovers from', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new Error('hiccup'))
      .mockResolvedValueOnce({ state: 'authorized', token: 'relay-token', response: 'sealed' });
    const result = await awaitLoginApproval({
      publicKey,
      request,
      attempts: 5,
      sleep: async () => { },
    });
    expect(result).toEqual({ status: 'authorized', token: 'relay-token', response: 'sealed' });
  });
});
