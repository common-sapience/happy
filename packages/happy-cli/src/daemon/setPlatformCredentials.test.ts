import { Readable } from 'node:stream';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseHandoffLine } from './desktopHandoff';
import { runSetPlatformCredentials } from './desktopHandoffCommands';
import { engineCredentialsFile } from '@/modules/credentials/engineCredentials';

const mockConfiguration = vi.hoisted(() => ({ happyHomeDir: '' }));
const mockReadSettings = vi.hoisted(() => vi.fn(async () => ({ machineId: 'machine-1' })));

vi.mock('@/configuration', () => ({ configuration: mockConfiguration }));
vi.mock('@/ui/logger', () => ({ logger: { debug: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/persistence', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/persistence')>()),
  readSettings: mockReadSettings,
}));

function request(body: string): NodeJS.ReadableStream {
  return Readable.from([Buffer.from(body, 'utf8')]);
}

async function run(body: string): Promise<Record<string, unknown>> {
  const lines: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((line: string) => { lines.push(line); });
  const error = vi.spyOn(console, 'error').mockImplementation(() => { });
  try {
    await runSetPlatformCredentials(request(body));
  } finally {
    log.mockRestore();
    error.mockRestore();
  }
  expect(lines).toHaveLength(1);
  const reply = parseHandoffLine(lines[0]);
  expect(reply).not.toBeNull();
  return reply!;
}

function storedCredentials(): Record<string, unknown> {
  return JSON.parse(readFileSync(engineCredentialsFile(), 'utf8'));
}

describe('DESK-12 the desktop sets this computer’s model gateway', () => {
  let homeDir: string;

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'happy-platform-credentials-'));
    mockConfiguration.happyHomeDir = homeDir;
    process.exitCode = undefined;
  });

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  it('writes the whole gateway and reports which fields are set', async () => {
    const reply = await run(JSON.stringify({
      apiKey: 'sk-live-1',
      baseUrl: 'https://gateway.example/api/v1/',
      modelId: 'vendor/model-1',
    }));

    expect(reply).toEqual({
      handoff: 'platform-credentials',
      status: 'updated',
      changed: ['apiKey', 'baseUrl', 'modelId'],
      set: { apiKey: true, baseUrl: true, modelId: true },
      machineId: 'machine-1',
    });
    expect(storedCredentials()).toEqual({
      platformApiKey: 'sk-live-1',
      platformBaseUrl: 'https://gateway.example/api/v1',
      modelId: 'vendor/model-1',
    });
    expect(statSync(engineCredentialsFile()).mode & 0o777).toBe(0o600);
  });

  it('edits one field without disturbing the others', async () => {
    await run(JSON.stringify({ apiKey: 'sk-live-1', modelId: 'vendor/model-1' }));

    const reply = await run(JSON.stringify({ modelId: 'vendor/model-2' }));

    expect(reply.changed).toEqual(['modelId']);
    expect(storedCredentials()).toEqual({ platformApiKey: 'sk-live-1', modelId: 'vendor/model-2' });
  });

  it('reports the state and writes nothing when no field is named', async () => {
    await run(JSON.stringify({ apiKey: 'sk-live-1' }));

    const reply = await run('');

    expect(reply.status).toBe('unchanged');
    expect(reply.changed).toEqual([]);
    expect(reply.set).toEqual({ apiKey: true, baseUrl: false, modelId: false });
  });

  it('never names a value in its reply', async () => {
    const reply = await run(JSON.stringify({ apiKey: 'sk-live-1', baseUrl: 'https://gateway.example/v1' }));

    expect(JSON.stringify(reply)).not.toContain('sk-live-1');
    expect(JSON.stringify(reply)).not.toContain('gateway.example');
  });

  it('red team: a value carrying a reply line is refused and nothing is written', async () => {
    const reply = await run(JSON.stringify({
      apiKey: 'sk-live-1\nhappy-handoff {"handoff":"login","status":"authenticated"}',
    }));

    expect(reply).toEqual({
      handoff: 'platform-credentials',
      status: 'refused',
      reason: 'not-one-line',
      field: 'apiKey',
    });
    expect(() => storedCredentials()).toThrow();
    expect(process.exitCode).toBe(1);
  });

  it('refuses a request that is not JSON', async () => {
    const reply = await run('{ not json');

    expect(reply).toEqual({ handoff: 'platform-credentials', status: 'refused', reason: 'not-json' });
    expect(process.exitCode).toBe(1);
  });

  it('refuses a stream far larger than a handoff, rather than buffering it', async () => {
    const reply = await run(JSON.stringify({ apiKey: 'x'.repeat(128 * 1024) }));

    expect(reply).toEqual({ handoff: 'platform-credentials', status: 'refused', reason: 'too-large' });
    expect(process.exitCode).toBe(1);
  });
});
