import { describe, expect, it } from 'vitest';

import { buildEngineProcessEnv } from './engineEnvironment';
import { MEMORY_DIR_ENV_VAR } from '@/modules/memory/memoryDirectory';
import { PLATFORM_API_KEY_ENV_VAR } from '@/modules/credentials/engineCredentials';
import { ENGINE_PERMISSION_ENV_VAR } from '@/modules/permission/permissionSwitch';
import {
  BROWSER_AUTO_CONNECT_ENV_VAR,
  BROWSER_HEADLESS_ENV_VAR,
} from '@/modules/browser/browserSettings';

const MEMORY_DIR = '/home/user/.happy/memory';

const baseInputs = {
  credentials: {},
  permissionConfirmationEnabled: false,
  memoryDirectory: MEMORY_DIR,
  browserSettings: {},
};

describe('ENG-19 / HOST-12 engine process environment', () => {
  it('always names the shared memory directory, so a host-wide memory is the default', () => {
    expect(buildEngineProcessEnv(baseInputs)[MEMORY_DIR_ENV_VAR]).toBe(MEMORY_DIR);
  });

  it('names the memory directory for a session whose confirmation switch is on too', () => {
    expect(buildEngineProcessEnv({ ...baseInputs, permissionConfirmationEnabled: true })).toEqual({
      [MEMORY_DIR_ENV_VAR]: MEMORY_DIR,
    });
  });

  it('carries the key, the baseline and the memory directory together', () => {
    const env = buildEngineProcessEnv({
      ...baseInputs,
      credentials: { platformApiKey: 'platform-secret' },
    });

    expect(env).toEqual({
      [PLATFORM_API_KEY_ENV_VAR]: 'platform-secret',
      [ENGINE_PERMISSION_ENV_VAR]: '{"*":"allow"}',
      [MEMORY_DIR_ENV_VAR]: MEMORY_DIR,
    });
  });

  it('names no browser switch this host did not set (ENG-04)', () => {
    const env = buildEngineProcessEnv(baseInputs);

    expect(env[BROWSER_HEADLESS_ENV_VAR]).toBeUndefined();
    expect(env[BROWSER_AUTO_CONNECT_ENV_VAR]).toBeUndefined();
  });

  it('passes the browser switches through when the host set them (ENG-04)', () => {
    const env = buildEngineProcessEnv({
      ...baseInputs,
      browserSettings: { headless: true, autoConnect: true },
    });

    expect(env[BROWSER_HEADLESS_ENV_VAR]).toBe('true');
    expect(env[BROWSER_AUTO_CONNECT_ENV_VAR]).toBe('true');
  });

  it('never names an engine config directory: the engine ships its own config', () => {
    const env = buildEngineProcessEnv(baseInputs);

    expect(Object.keys(env).filter((key) => key.includes('CONFIG'))).toEqual([]);
  });
});
