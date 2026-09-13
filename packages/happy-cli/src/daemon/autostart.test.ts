import { describe, expect, it } from 'vitest';

import { ONLY_IF_AUTHENTICATED_FLAG, relayRefusalMessage, shouldDeferDaemonStart } from './autostart';

describe('daemon start requested by the desktop shell', () => {
  it('defers when the computer has no account yet', () => {
    expect(shouldDeferDaemonStart([ONLY_IF_AUTHENTICATED_FLAG], false)).toBe(true);
  });

  it('starts once the computer has an account', () => {
    expect(shouldDeferDaemonStart([ONLY_IF_AUTHENTICATED_FLAG], true)).toBe(false);
  });

  it('leaves the terminal flow alone, where logging in is interactive', () => {
    expect(shouldDeferDaemonStart([], false)).toBe(false);
  });
});

describe('daemon start without a relay', () => {
  it('refuses and names both places an address can come from', () => {
    const message = relayRefusalMessage(null, '/home/someone/.happy/settings.json');
    expect(message).toContain('HAPPY_SERVER_URL');
    expect(message).toContain('/home/someone/.happy/settings.json');
  });

  it('never names an address of its own', () => {
    expect(relayRefusalMessage(null, '/settings.json')).not.toMatch(/https?:\/\//);
  });

  it('starts once an address is configured', () => {
    expect(relayRefusalMessage('http://127.0.0.1:3006', '/settings.json')).toBeNull();
  });
});
