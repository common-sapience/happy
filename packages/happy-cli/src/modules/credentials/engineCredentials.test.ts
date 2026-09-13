import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MODEL_ID_ENV_VAR,
  PLATFORM_API_KEY_ENV_VAR,
  PLATFORM_BASE_URL_ENV_VAR,
  buildConnectorMcpServers,
  buildEngineCredentialEnv,
  describeInjectedCredentials,
  describePlatformCredentials,
  engineCredentialsFile,
  readEngineCredentials,
  updateEngineCredentials,
} from './engineCredentials';

const mockConfiguration = vi.hoisted(() => ({ happyHomeDir: '' }));

vi.mock('@/configuration', () => ({ configuration: mockConfiguration }));
vi.mock('@/ui/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn() },
}));

function writeStore(contents: unknown, mode = 0o600): void {
  const file = engineCredentialsFile();
  writeFileSync(file, typeof contents === 'string' ? contents : JSON.stringify(contents), 'utf-8');
  chmodSync(file, mode);
}

describe('HOST-09 / HOST-11 engine credential store', () => {
  let homeDir: string;

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'happy-engine-credentials-'));
    mockConfiguration.happyHomeDir = homeDir;
  });

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true });
  });

  it('lives under HAPPY_HOME_DIR', () => {
    expect(engineCredentialsFile()).toBe(join(homeDir, 'engine-credentials.json'));
  });

  it('reads nothing when no store exists', async () => {
    await expect(readEngineCredentials()).resolves.toEqual({});
  });

  it('HOST-09: injects the whole model gateway into the engine environment', async () => {
    writeStore({
      platformApiKey: 'platform-secret',
      platformBaseUrl: 'https://gateway.example/api/v1',
      modelId: 'vendor/model-1',
    });

    const credentials = await readEngineCredentials();

    expect(buildEngineCredentialEnv(credentials)).toEqual({
      [PLATFORM_API_KEY_ENV_VAR]: 'platform-secret',
      [PLATFORM_BASE_URL_ENV_VAR]: 'https://gateway.example/api/v1',
      [MODEL_ID_ENV_VAR]: 'vendor/model-1',
    });
  });

  it('HOST-09: injects only the gateway fields this host holds', async () => {
    writeStore({ platformApiKey: 'platform-secret' });

    expect(buildEngineCredentialEnv(await readEngineCredentials())).toEqual({
      [PLATFORM_API_KEY_ENV_VAR]: 'platform-secret',
    });
  });

  it('HOST-09: injects nothing when nothing is stored', async () => {
    writeStore({});

    expect(buildEngineCredentialEnv(await readEngineCredentials())).toEqual({});
  });

  it('HOST-11: turns connector credentials into engine MCP servers', async () => {
    writeStore({
      connectors: {
        gmail: { command: 'gmail-mcp', args: ['--stdio'], env: { GMAIL_TOKEN: 'connector-secret' } },
      },
    });

    expect(buildConnectorMcpServers(await readEngineCredentials())).toEqual({
      gmail: { command: 'gmail-mcp', args: ['--stdio'], env: { GMAIL_TOKEN: 'connector-secret' } },
    });
  });

  it('HOST-11: reports no connectors when none are authorized on this host', async () => {
    writeStore({ platformApiKey: 'platform-secret' });

    expect(buildConnectorMcpServers(await readEngineCredentials())).toEqual({});
  });

  it('tightens a world-readable store to 0600 before using it', async () => {
    writeStore({ platformApiKey: 'platform-secret' }, 0o644);

    await readEngineCredentials();

    expect(statSync(engineCredentialsFile()).mode & 0o777).toBe(0o600);
  });

  it('injects nothing from a malformed store rather than applying it partially', async () => {
    writeStore('{ not json');

    await expect(readEngineCredentials()).resolves.toEqual({});
  });

  it('injects nothing from a store whose connector has no command', async () => {
    writeStore({ platformApiKey: 'platform-secret', connectors: { gmail: { env: { A: 'b' } } } });

    await expect(readEngineCredentials()).resolves.toEqual({});
  });

  it('describes what was injected by name only, never by value', async () => {
    writeStore({
      platformApiKey: 'platform-secret',
      connectors: { gmail: { command: 'gmail-mcp', env: { GMAIL_TOKEN: 'connector-secret' } } },
    });

    const described = describeInjectedCredentials(await readEngineCredentials());

    expect(described).toEqual({ apiKey: true, baseUrl: false, modelId: false, connectors: ['gmail'] });
    expect(JSON.stringify(described)).not.toContain('secret');
  });

  it('DESK-12: writes a changed store back at 0600', async () => {
    await updateEngineCredentials((current) => ({ ...current, platformApiKey: 'written-secret' }));

    expect(statSync(engineCredentialsFile()).mode & 0o777).toBe(0o600);
    expect(await readEngineCredentials()).toEqual({ platformApiKey: 'written-secret' });
  });

  it('DESK-12: a gateway write keeps the connectors this host authorized', async () => {
    writeStore({ connectors: { gmail: { command: 'gmail-mcp' } } });

    await updateEngineCredentials((current) => ({ ...current, modelId: 'vendor/model-1' }));

    expect(await readEngineCredentials()).toEqual({
      modelId: 'vendor/model-1',
      connectors: { gmail: { command: 'gmail-mcp' } },
    });
  });

  it('DESK-12: reports the configured fields as booleans, never as values', async () => {
    writeStore({ platformApiKey: 'platform-secret', modelId: 'vendor/model-1' });

    const state = describePlatformCredentials(await readEngineCredentials());

    expect(state).toEqual({ apiKey: true, baseUrl: false, modelId: true });
    expect(JSON.stringify(state)).not.toContain('secret');
    expect(JSON.stringify(state)).not.toContain('vendor');
  });
});
