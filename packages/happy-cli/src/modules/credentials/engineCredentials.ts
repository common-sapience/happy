/**
 * Single credential source for the engine process (HOST-09, HOST-11).
 *
 * The platform API key and the connector credentials are read from one keyed
 * store under HAPPY_HOME_DIR and injected at spawn time: the key as an engine
 * process environment variable, each connector as an MCP server entry whose env
 * carries its own secret. Nothing is written back out as a plaintext engine
 * config file, and no value is ever logged — only key and connector names.
 */

import { readFile, chmod, stat } from 'node:fs/promises';
import { join } from 'node:path';
import * as z from 'zod';

import { configuration } from '@/configuration';
import { logger } from '@/ui/logger';
import type { McpServerConfig } from '@/agent/core';

/**
 * Environment variable the engine's managed config reads the platform API key
 * from. It is a contract with the engine config, not a tunable.
 */
export const PLATFORM_API_KEY_ENV_VAR = 'MODEL_API_KEY';

const ENGINE_CREDENTIALS_FILE_NAME = 'engine-credentials.json';
const REQUIRED_FILE_MODE = 0o600;

const ConnectorCredentialSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const EngineCredentialsSchema = z.object({
  platformApiKey: z.string().min(1).optional(),
  connectors: z.record(z.string(), ConnectorCredentialSchema).optional(),
});

export type ConnectorCredential = z.infer<typeof ConnectorCredentialSchema>;
export type EngineCredentials = z.infer<typeof EngineCredentialsSchema>;

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
 * Environment carrying the platform API key into the engine process (HOST-09).
 */
export function buildEngineCredentialEnv(credentials: EngineCredentials): Record<string, string> {
  if (!credentials.platformApiKey) {
    return {};
  }
  return { [PLATFORM_API_KEY_ENV_VAR]: credentials.platformApiKey };
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
export function describeInjectedCredentials(credentials: EngineCredentials): {
  platformApiKey: boolean;
  connectors: string[];
} {
  return {
    platformApiKey: Boolean(credentials.platformApiKey),
    connectors: Object.keys(credentials.connectors ?? {}),
  };
}
