/**
 * Minimal persistence functions for happy CLI
 * 
 * Handles settings and private key storage in ~/.happy/ or local .happy/
 */

import { FileHandle } from 'node:fs/promises'
import { readFile, writeFile, mkdir, open, unlink, rename, stat, chmod } from 'node:fs/promises'
import { existsSync, writeFileSync, readFileSync, unlinkSync, renameSync, linkSync } from 'node:fs'
import { constants } from 'node:fs'
import { configuration } from '@/configuration'
import * as z from 'zod';
import { encodeBase64, decodeBase64 } from '@/api/encryption';
import type { Metadata } from '@/api/types';
import { logger } from '@/ui/logger';

// Settings schema version: Integer for overall Settings structure compatibility
// Incremented when Settings structure changes (e.g., adding profiles array was v1→v2)
// Used for migration logic in readSettings()
export const SUPPORTED_SCHEMA_VERSION = 2;

interface Settings {
  schemaVersion: number
  onboardingCompleted: boolean
  machineId?: string
  machineIdConfirmedByServer?: boolean
  daemonAutoStartWhenRunningHappy?: boolean
  /**
   * Permission confirmation switch for this host (PERM-08). Off by default: the
   * engine runs on an allow baseline and no permission request is surfaced.
   * Any paired control end may flip it.
   */
  permissionConfirmationEnabled?: boolean
  /**
   * Memory consolidation thresholds for this host (ENG-19, T-15). A pass runs
   * once this many sessions have finished since the last one, or once this many
   * hours have passed with at least one finished session. Both fall back to the
   * defaults in `@/modules/memory/memoryConsolidation`.
   */
  dreamAfterSessions?: number
  dreamAfterHours?: number
  /**
   * browser-use switches for this host (ENG-04). Unset means the daemon names
   * nothing and the engine keeps its own default: headed, no auto-connect.
   */
  browserHeadless?: boolean
  browserAutoConnect?: boolean
  serverUrl?: string
  webappUrl?: string
}

const defaultSettings: Settings = {
  schemaVersion: SUPPORTED_SCHEMA_VERSION,
  onboardingCompleted: false,
}

/**
 * Migrate settings from old schema versions to current
 * Always backwards compatible - preserves all data
 */
function migrateSettings(raw: any, fromVersion: number): any {
  let migrated = { ...raw };

  // Future migrations go here:
  // if (fromVersion < 3) { ... }

  return migrated;
}

/**
 * Daemon state persisted locally (different from API DaemonState)
 * This is written to disk by the daemon to track its local process state
 */
export interface DaemonLocallyPersistedState {
  pid: number;
  httpPort: number;
  startTime: string;
  startedWithCliVersion: string;
  lastHeartbeat?: string;
  daemonLogPath?: string;
}

export async function readSettings(): Promise<Settings> {
  if (!existsSync(configuration.settingsFile)) {
    return { ...defaultSettings }
  }

  try {
    // Read raw settings
    const content = await readFile(configuration.settingsFile, 'utf8')
    const raw = JSON.parse(content)

    // Check schema version (default to 1 if missing)
    const schemaVersion = raw.schemaVersion ?? 1;

    // Warn if schema version is newer than supported
    if (schemaVersion > SUPPORTED_SCHEMA_VERSION) {
      logger.warn(
        `⚠️ Settings schema v${schemaVersion} > supported v${SUPPORTED_SCHEMA_VERSION}. ` +
        'Update happy-cli for full functionality.'
      );
    }

    // Migrate if needed
    const migrated = migrateSettings(raw, schemaVersion);

    // Merge with defaults to ensure all required fields exist
    return { ...defaultSettings, ...migrated };
  } catch (error: any) {
    logger.warn(`Failed to read settings: ${error.message}`);
    // Return defaults on any error
    return { ...defaultSettings }
  }
}

export async function writeSettings(settings: Settings): Promise<void> {
  if (!existsSync(configuration.happyHomeDir)) {
    await mkdir(configuration.happyHomeDir, { recursive: true })
  }

  // Ensure schema version is set before writing
  const settingsWithVersion = {
    ...settings,
    schemaVersion: settings.schemaVersion ?? SUPPORTED_SCHEMA_VERSION
  };

  await writeFile(configuration.settingsFile, JSON.stringify(settingsWithVersion, null, 2))
}

// Lock timing, shared by every file this module serialises writes to
const LOCK_RETRY_INTERVAL_MS = 100;  // How long to wait between lock attempts
const MAX_LOCK_ATTEMPTS = 50;        // Maximum number of attempts (5 seconds total)
const STALE_LOCK_TIMEOUT_MS = 10000; // Consider lock stale after 10 seconds

/**
 * Runs `body` while holding an exclusive lock beside `file`, so two processes
 * cannot read-modify-write the same file at once. One lock protocol for every
 * file under HAPPY_HOME_DIR: the daemon, a session and a desktop handoff all
 * contend for the same files, and each one inventing its own would let a writer
 * lose another's change.
 */
export async function withFileLock<T>(file: string, body: () => Promise<T>): Promise<T> {
  const lockFile = file + '.lock';
  let fileHandle: FileHandle | undefined;
  let attempts = 0;

  while (attempts < MAX_LOCK_ATTEMPTS) {
    try {
      // O_CREAT | O_EXCL | O_WRONLY = create exclusively, fail if exists
      fileHandle = await open(lockFile, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
      break;
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_INTERVAL_MS));

        try {
          const stats = await stat(lockFile);
          if (Date.now() - stats.mtimeMs > STALE_LOCK_TIMEOUT_MS) {
            await unlink(lockFile).catch(() => { });
          }
        } catch { }
      } else {
        throw err;
      }
    }
  }

  if (!fileHandle) {
    throw new Error(`Failed to acquire lock on ${file} after ${MAX_LOCK_ATTEMPTS * LOCK_RETRY_INTERVAL_MS / 1000} seconds`);
  }

  try {
    return await body();
  } finally {
    await fileHandle.close();
    await unlink(lockFile).catch(() => { });
  }
}

/**
 * Atomically update settings with multi-process safety via file locking
 * @param updater Function that takes current settings and returns updated settings
 * @returns The updated settings
 */
export async function updateSettings(
  updater: (current: Settings) => Settings | Promise<Settings>
): Promise<Settings> {
  const tmpFile = configuration.settingsFile + '.tmp';

  return withFileLock(configuration.settingsFile, async () => {
    // Read current settings with defaults
    const current = await readSettings() || { ...defaultSettings };

    // Apply update
    const updated = await updater(current);

    // Ensure directory exists
    if (!existsSync(configuration.happyHomeDir)) {
      await mkdir(configuration.happyHomeDir, { recursive: true });
    }

    // Write atomically using rename
    await writeFile(tmpFile, JSON.stringify(updated, null, 2));
    await rename(tmpFile, configuration.settingsFile); // Atomic on POSIX

    return updated;
  });
}

//
// Authentication
//

const credentialsSchema = z.object({
  token: z.string(),
  secret: z.string().base64().nullish(), // Legacy
  encryption: z.object({
    publicKey: z.string().base64(),
    machineKey: z.string().base64()
  }).nullish()
})

export type Credentials = {
  token: string,
  encryption: {
    type: 'legacy', secret: Uint8Array
  } | {
    type: 'dataKey', publicKey: Uint8Array, machineKey: Uint8Array
  }
}

export async function readCredentials(): Promise<Credentials | null> {
  if (!existsSync(configuration.privateKeyFile)) {
    return null
  }
  try {
    const keyBase64 = (await readFile(configuration.privateKeyFile, 'utf8'));
    const credentials = credentialsSchema.parse(JSON.parse(keyBase64));
    if (credentials.secret) {
      return {
        token: credentials.token,
        encryption: {
          type: 'legacy',
          secret: new Uint8Array(Buffer.from(credentials.secret, 'base64'))
        }
      };
    } else if (credentials.encryption) {
      return {
        token: credentials.token,
        encryption: {
          type: 'dataKey',
          publicKey: new Uint8Array(Buffer.from(credentials.encryption.publicKey, 'base64')),
          machineKey: new Uint8Array(Buffer.from(credentials.encryption.machineKey, 'base64'))
        }
      }
    }
  } catch {
    return null
  }
  return null
}

/** The account key is readable by its owner only, whichever login flow wrote it. */
const CREDENTIALS_FILE_MODE = 0o600;

async function writeCredentialsFile(body: Record<string, unknown>): Promise<void> {
  if (!existsSync(configuration.happyHomeDir)) {
    await mkdir(configuration.happyHomeDir, { recursive: true })
  }
  await writeFile(configuration.privateKeyFile, JSON.stringify(body, null, 2), { mode: CREDENTIALS_FILE_MODE });
  await chmod(configuration.privateKeyFile, CREDENTIALS_FILE_MODE);
}

export async function writeCredentialsLegacy(credentials: { secret: Uint8Array, token: string }): Promise<void> {
  await writeCredentialsFile({
    secret: encodeBase64(credentials.secret),
    token: credentials.token
  });
}

export async function writeCredentialsDataKey(credentials: { publicKey: Uint8Array, machineKey: Uint8Array, token: string }): Promise<void> {
  await writeCredentialsFile({
    encryption: { publicKey: encodeBase64(credentials.publicKey), machineKey: encodeBase64(credentials.machineKey) },
    token: credentials.token
  });
}

/** Writes whichever form the approved login yielded, so callers do not branch on it. */
export async function writeCredentials(credentials: Credentials): Promise<void> {
  if (credentials.encryption.type === 'legacy') {
    await writeCredentialsLegacy({ secret: credentials.encryption.secret, token: credentials.token });
    return;
  }
  await writeCredentialsDataKey({
    publicKey: credentials.encryption.publicKey,
    machineKey: credentials.encryption.machineKey,
    token: credentials.token
  });
}

export async function clearCredentials(): Promise<void> {
  if (existsSync(configuration.privateKeyFile)) {
    await unlink(configuration.privateKeyFile);
  }
}

export async function clearMachineId(): Promise<void> {
  await updateSettings(settings => ({
    ...settings,
    machineId: undefined
  }));
}

/**
 * Read daemon state from local file
 */
export async function readDaemonState(): Promise<DaemonLocallyPersistedState | null> {
  try {
    if (!existsSync(configuration.daemonStateFile)) {
      return null;
    }
    const content = await readFile(configuration.daemonStateFile, 'utf-8');
    return JSON.parse(content) as DaemonLocallyPersistedState;
  } catch (error) {
    // State corrupted somehow :(
    console.error(`[PERSISTENCE] Daemon state file corrupted: ${configuration.daemonStateFile}`, error);
    return null;
  }
}

/**
 * Write daemon state to local file (synchronously for atomic operation)
 */
export function writeDaemonState(state: DaemonLocallyPersistedState): void {
  writeFileSync(configuration.daemonStateFile, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Clean up daemon state file and lock file
 */
export async function clearDaemonState(): Promise<void> {
  if (existsSync(configuration.daemonStateFile)) {
    await unlink(configuration.daemonStateFile);
  }
  // Also clean up lock file if it exists (for stale cleanup)
  if (existsSync(configuration.daemonLockFile)) {
    try {
      await unlink(configuration.daemonLockFile);
    } catch {
      // Lock file might be held by running daemon, ignore error
    }
  }
}

/**
 * Acquire an exclusive lock file for the daemon.
 * The lock file proves the daemon is running and prevents multiple instances.
 * Returns the file handle to hold for the daemon's lifetime, or null if locked.
 */
export async function acquireDaemonLock(
  maxAttempts: number = 5,
  delayIncrementMs: number = 200
): Promise<FileHandle | null> {
  // Lock creation is atomic INCLUDING the PID payload: the PID is written to
  // a private temp file first and hard-linked into place (link fails with
  // EEXIST exactly like O_EXCL). A lock file therefore never exists in an
  // empty/partially-written state, so any lock without a live-PID payload is
  // unambiguously stale and can be reclaimed immediately.
  const tempPath = `${configuration.daemonLockFile}.${process.pid}.tmp`;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      writeFileSync(tempPath, String(process.pid));
      linkSync(tempPath, configuration.daemonLockFile);
      unlinkSync(tempPath);
      // Hold an open handle for the daemon's lifetime (released by releaseDaemonLock)
      return await open(configuration.daemonLockFile, constants.O_RDONLY);
    } catch (error: any) {
      try {
        unlinkSync(tempPath);
      } catch { }

      if (error.code === 'EEXIST') {
        // Lock file exists, check if its owner is still running
        let lockIsStale = false;
        try {
          const lockPid = readFileSync(configuration.daemonLockFile, 'utf-8').trim();
          const lockPidNumber = Number(lockPid);
          if (!lockPid || !Number.isSafeInteger(lockPidNumber) || lockPidNumber <= 0) {
            lockIsStale = true;
          } else {
            try {
              process.kill(lockPidNumber, 0); // Check if process exists
            } catch {
              lockIsStale = true;
            }
          }
        } catch {
          // Can't read the lock file — corrupted leftovers, reclaim
          lockIsStale = true;
        }

        if (lockIsStale) {
          try {
            unlinkSync(configuration.daemonLockFile);
            continue; // Retry acquisition
          } catch { }
        }
      }

      if (attempt === maxAttempts) {
        return null;
      }
      const delayMs = attempt * delayIncrementMs;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

/**
 * Release daemon lock by closing handle and deleting lock file
 */
export async function releaseDaemonLock(lockHandle: FileHandle): Promise<void> {
  try {
    await lockHandle.close();
  } catch { }

  try {
    if (existsSync(configuration.daemonLockFile)) {
      unlinkSync(configuration.daemonLockFile);
    }
  } catch { }
}

// ─── Session persistence (survives daemon restarts) ───

export type PersistedSession = {
  encryptionKey: string;
  encryptionVariant: 'legacy' | 'dataKey';
  seq: number;
  metadataVersion: number;
  agentStateVersion: number;
  metadata: Metadata;
  savedAt: number;
};

type SessionsFile = {
  sessions: Record<string, PersistedSession>;
};

const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function readPersistedSessions(): Record<string, PersistedSession> {
  try {
    if (!existsSync(configuration.sessionsFile)) return {};
    const data = JSON.parse(readFileSync(configuration.sessionsFile, 'utf-8')) as SessionsFile;
    if (!data?.sessions || typeof data.sessions !== 'object') return {};

    const now = Date.now();
    const sessions: Record<string, PersistedSession> = {};
    for (const [id, session] of Object.entries(data.sessions)) {
      if (now - session.savedAt < SESSION_MAX_AGE_MS) {
        sessions[id] = session;
      }
    }
    return sessions;
  } catch {
    return {};
  }
}

export function persistSession(sessionId: string, session: PersistedSession): void {
  try {
    const existing = readPersistedSessions();
    existing[sessionId] = session;
    const tmpFile = configuration.sessionsFile + '.tmp';
    writeFileSync(tmpFile, JSON.stringify({ sessions: existing }, null, 2), 'utf-8');
    renameSync(tmpFile, configuration.sessionsFile);
  } catch (error) {
    logger.debug(`[PERSISTENCE] Failed to persist session ${sessionId}:`, error);
  }
}
