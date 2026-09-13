import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PLATFORM_API_KEY_ENV_VAR,
  buildConnectorMcpServers,
  buildEngineCredentialEnv,
  describeInjectedCredentials,
  engineCredentialsFile,
  readEngineCredentials,
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

  it('HOST-09: injects the platform API key into the engine environment', async () => {
    writeStore({ platformApiKey: 'platform-secret' });

    const credentials = await readEngineCredentials();

    expect(buildEngineCredentialEnv(credentials)).toEqual({
      [PLATFORM_API_KEY_ENV_VAR]: 'platform-secret',
    });
  });

  it('HOST-09: injects nothing when no key is stored', async () => {
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

    expect(described).toEqual({ platformApiKey: true, connectors: ['gmail'] });
    expect(JSON.stringify(described)).not.toContain('secret');
  });
});
