/**
 * The credential on the engine's own loopback port (MOD-02).
 *
 * The engine's ACP process opens an HTTP port on the loopback address and calls
 * itself through it. That port enforces a password only when one is named in the
 * process environment, so the host mints one per engine process: another local
 * process holding no credential gets 401, while the engine's own client reads
 * the same variable and keeps working.
 *
 * The password is cryptographically random, lives only in the child process's
 * environment, and is never written to a log, a command line or disk.
 */

import { randomBytes } from 'node:crypto';

export const ENGINE_SERVER_PASSWORD_ENV_VAR = 'OPENCODE_SERVER_PASSWORD';

const ENGINE_SERVER_PASSWORD_BYTES = 32;

export function generateEngineServerPassword(): string {
  return randomBytes(ENGINE_SERVER_PASSWORD_BYTES).toString('base64url');
}

export function buildEngineServerAuthEnv(): Record<string, string> {
  return { [ENGINE_SERVER_PASSWORD_ENV_VAR]: generateEngineServerPassword() };
}
