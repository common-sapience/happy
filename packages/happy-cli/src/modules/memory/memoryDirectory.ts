/**
 * The one auto-memory directory on this host (ENG-19, RULE-11).
 *
 * Every engine session this host starts gets the same directory, so a fact one
 * agent writes is visible to the next agent that starts. The directory lives
 * under HAPPY_HOME_DIR and never leaves the host: the daemon only names it, the
 * engine's memory skill and memory tool are what write into it.
 *
 * The engine defaults the directory under its own data dir when the variable is
 * unset, which would give each engine state dir a private memory. Naming it at
 * every spawn is what makes the memory shared.
 */

import { mkdir, chmod, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { configuration } from '@/configuration';
import { logger } from '@/ui/logger';

/** Environment variable the engine reads the shared memory directory from. */
export const MEMORY_DIR_ENV_VAR = 'HARNESS_MEMORY_DIR';

const MEMORY_DIR_NAME = 'memory';

/**
 * Memory is user content that no other account on this machine may read
 * (PERM-04, RULE-11), so the directory is owner-only.
 */
const REQUIRED_DIR_MODE = 0o700;

export function memoryDirectory(): string {
  return join(configuration.happyHomeDir, MEMORY_DIR_NAME);
}

/**
 * Creates the memory directory if it is missing and tightens its mode if some
 * earlier run or a umask left it readable by others. Returns the path.
 */
export async function ensureMemoryDirectory(): Promise<string> {
  const directory = memoryDirectory();
  await mkdir(directory, { recursive: true, mode: REQUIRED_DIR_MODE });

  try {
    const stats = await stat(directory);
    if ((stats.mode & 0o777) !== REQUIRED_DIR_MODE) {
      await chmod(directory, REQUIRED_DIR_MODE);
      logger.debug(`[MEMORY] Tightened ${directory} to 0700`);
    }
  } catch (error) {
    logger.debug('[MEMORY] Could not enforce the memory directory mode:', error);
  }

  return directory;
}

/** Environment carrying the shared memory directory into the engine process. */
export function buildMemoryEnv(directory: string): Record<string, string> {
  return { [MEMORY_DIR_ENV_VAR]: directory };
}
