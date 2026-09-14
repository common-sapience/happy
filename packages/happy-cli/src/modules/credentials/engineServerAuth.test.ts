import { describe, expect, it } from 'vitest';

import {
  ENGINE_SERVER_PASSWORD_ENV_VAR,
  buildEngineServerAuthEnv,
  generateEngineServerPassword,
} from './engineServerAuth';

describe('MOD-02 engine server password', () => {
  it('names the variable the engine reads for the credential on its own port', () => {
    expect(ENGINE_SERVER_PASSWORD_ENV_VAR).toBe('OPENCODE_SERVER_PASSWORD');
  });

  it('mints a different password every time, so one engine process cannot read another', () => {
    const passwords = new Set(Array.from({ length: 64 }, () => generateEngineServerPassword()));

    expect(passwords.size).toBe(64);
  });

  it('mints at least 256 bits of randomness in a form that survives an environment variable', () => {
    const password = generateEngineServerPassword();

    expect(password).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });

  it('names the password in the environment of the engine process', () => {
    const env = buildEngineServerAuthEnv();

    expect(Object.keys(env)).toEqual([ENGINE_SERVER_PASSWORD_ENV_VAR]);
    expect(env[ENGINE_SERVER_PASSWORD_ENV_VAR]).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });

  it('gives each engine process its own password', () => {
    const first = buildEngineServerAuthEnv()[ENGINE_SERVER_PASSWORD_ENV_VAR];
    const second = buildEngineServerAuthEnv()[ENGINE_SERVER_PASSWORD_ENV_VAR];

    expect(first).not.toBe(second);
  });
});
