/**
 * Single credential source for the engine process (HOST-09, HOST-11).
 *
 * What the engine needs to reach a model is the gateway address, the platform
 * API key and the model id. All three are read from one keyed store under
 * HAPPY_HOME_DIR and injected at spawn time as engine process environment
 * variables, alongside each connector as an MCP server entry whose env carries
 * its own secret. Nothing is written back out as a plaintext engine config file,
 * and no value is ever logged — only which fields are set and which connectors
 * exist. A packaged install with no key reaches no model at all, which is why
 * this store is also what the desktop writes into (DESK-12).
 */

import { readFile, writeFile, chmod, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import * as z from 'zod';

import { configuration } from '@/configuration';
import { withFileLock } from '@/persistence';
import { logger } from '@/ui/logger';
import type { McpServerConfig } from '@/agent/core';

/**
 * Environment variables the engine's managed config reads the gateway from. They
 * are a contract with the engine config, not tunables: the config defines its
 * platform provider from exactly these three and fails closed without them.
 */
export const PLATFORM_API_KEY_ENV_VAR = 'MODEL_API_KEY';
export const PLATFORM_BASE_URL_ENV_VAR = 'MODEL_API_BASE_URL';
export const MODEL_ID_ENV_VAR = 'MODEL_ID';

const ENGINE_CREDENTIALS_FILE_NAME = 'engine-credentials.json';
const REQUIRED_FILE_MODE = 0o600;

const ConnectorCredentialSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const EngineCredentialsSchema = z.object({
  platformApiKey: z.string().min(1).optional(),
  platformBaseUrl: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
  connectors: z.record(z.string(), ConnectorCredentialSchema).optional(),
});

export type ConnectorCredential = z.infer<typeof ConnectorCredentialSchema>;
export type EngineCredentials = z.infer<typeof EngineCredentialsSchema>;

/**
 * Which gateway fields this host holds — never their values. This is the whole
 * answer any control end gets about the key, so the shape is booleans by
 * construction rather than by a caller remembering to redact.
 */
export interface PlatformCredentialState {
  apiKey: boolean;
  baseUrl: boolean;
  modelId: boolean;
}

export function engineCredentialsFile(): string {
  return join(configuration.happyHomeDir, ENGINE_CREDENTIALS_FILE_NAME);
}

/**
 * Reads the credential store. A missing store is normal — the engine then runs
 * with whatever its own config resolves. A malformed store is refused rather
 * than partially applied, and a store readable by other users is tightened to
 * 0600 before its contents are used.
 */
export async function readEngineCredentials(): Promise<EngineCredentials> {
  const file = engineCredentialsFile();

  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      logger.debug(`[CREDENTIALS] Could not read ${ENGINE_CREDENTIALS_FILE_NAME}: ${code ?? 'unknown error'}`);
    }
    return {};
  }

  await enforceFileMode(file);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn(`⚠️ ${ENGINE_CREDENTIALS_FILE_NAME} is not valid JSON - no engine credentials injected`);
    return {};
  }

  const result = EngineCredentialsSchema.safeParse(parsed);
  if (!result.success) {
    // Only the failing field paths are logged; values never are.
    const paths = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    logger.warn(`⚠️ ${ENGINE_CREDENTIALS_FILE_NAME} is invalid at [${paths}] - no engine credentials injected`);
    return {};
  }

  return result.data;
}

async function enforceFileMode(file: string): Promise<void> {
  try {
    const stats = await stat(file);
    if ((stats.mode & 0o777) !== REQUIRED_FILE_MODE) {
      await chmod(file, REQUIRED_FILE_MODE);
      logger.debug(`[CREDENTIALS] Tightened ${ENGINE_CREDENTIALS_FILE_NAME} to 0600`);
    }
  } catch (error) {
    logger.debug('[CREDENTIALS] Could not enforce credential file mode:', error);
  }
}

/**
 * Environment carrying the model gateway into the engine process (HOST-09).
 * Each field travels only when this host holds it; the engine's own config is
 * what refuses to run on an incomplete set, so a half-configured host fails
 * there rather than silently reaching some other provider.
 */
export function buildEngineCredentialEnv(credentials: EngineCredentials): Record<string, string> {
  const env: Record<string, string> = {};
  if (credentials.platformApiKey) {
    env[PLATFORM_API_KEY_ENV_VAR] = credentials.platformApiKey;
  }
  if (credentials.platformBaseUrl) {
    env[PLATFORM_BASE_URL_ENV_VAR] = credentials.platformBaseUrl;
  }
  if (credentials.modelId) {
    env[MODEL_ID_ENV_VAR] = credentials.modelId;
  }
  return env;
}

/**
 * Writes a changed store back under the same lock every other writer of a file
 * in HAPPY_HOME_DIR uses, at 0600, so a concurrent connector write and a gateway
 * write cannot lose each other (HOST-09, HOST-11).
 */
export async function updateEngineCredentials(
  updater: (current: EngineCredentials) => EngineCredentials,
): Promise<EngineCredentials> {
  const file = engineCredentialsFile();
  return withFileLock(file, async () => {
    const updated = updater(await readEngineCredentials());
    await mkdir(configuration.happyHomeDir, { recursive: true });
    await writeFile(file, JSON.stringify(updated, null, 2), { mode: REQUIRED_FILE_MODE });
    await chmod(file, REQUIRED_FILE_MODE);
    return updated;
  });
}

/** Which gateway fields are set on this host, by name only (HOST-09, DESK-12). */
export function describePlatformCredentials(credentials: EngineCredentials): PlatformCredentialState {
  return {
    apiKey: Boolean(credentials.platformApiKey),
    baseUrl: Boolean(credentials.platformBaseUrl),
    modelId: Boolean(credentials.modelId),
  };
}

/**
 * MCP server entries for the connectors authorized on this host (HOST-11).
 * Each connector's credential travels in that server's own environment.
 */
export function buildConnectorMcpServers(credentials: EngineCredentials): Record<string, McpServerConfig> {
  const servers: Record<string, McpServerConfig> = {};
  for (const [name, connector] of Object.entries(credentials.connectors ?? {})) {
    servers[name] = {
      command: connector.command,
      args: connector.args,
      env: connector.env,
    };
  }
  return servers;
}

/** Names only — used for logging what was injected without revealing values. */
export function describeInjectedCredentials(credentials: EngineCredentials): PlatformCredentialState & {
  connectors: string[];
} {
  return {
    ...describePlatformCredentials(credentials),
    connectors: Object.keys(credentials.connectors ?? {}),
  };
}
