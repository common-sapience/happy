import { describe, expect, it } from 'vitest';

import { ONLY_IF_AUTHENTICATED_FLAG, shouldDeferDaemonStart } from './autostart';

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
