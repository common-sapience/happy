import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MEMORY_DIR_ENV_VAR, buildMemoryEnv, ensureMemoryDirectory, memoryDirectory } from './memoryDirectory';

const mockConfiguration = vi.hoisted(() => ({ happyHomeDir: '' }));

vi.mock('@/configuration', () => ({ configuration: mockConfiguration }));
vi.mock('@/ui/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn() },
}));

describe('ENG-19 shared memory directory', () => {
  let homeDir: string;

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'happy-memory-'));
    mockConfiguration.happyHomeDir = homeDir;
  });

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true });
  });

  it('lives in one place under HAPPY_HOME_DIR', () => {
    expect(memoryDirectory()).toBe(join(homeDir, 'memory'));
  });

  it('creates the directory when it is missing', async () => {
    const directory = await ensureMemoryDirectory();

    expect(directory).toBe(join(homeDir, 'memory'));
    expect(statSync(directory).isDirectory()).toBe(true);
  });

  it('creates it owner-only, so no other account on the host can read the memory', async () => {
    const directory = await ensureMemoryDirectory();

    expect(statSync(directory).mode & 0o777).toBe(0o700);
  });

  it('tightens a directory an earlier run left readable by others', async () => {
    mkdirSync(join(homeDir, 'memory'), { mode: 0o755 });

    const directory = await ensureMemoryDirectory();

    expect(statSync(directory).mode & 0o777).toBe(0o700);
  });

  it('is idempotent, so every spawn may call it', async () => {
    await ensureMemoryDirectory();

    await expect(ensureMemoryDirectory()).resolves.toBe(join(homeDir, 'memory'));
  });

  it('names the directory for the engine, so all agents on the host share one memory', () => {
    expect(buildMemoryEnv('/home/user/.happy/memory')).toEqual({
      [MEMORY_DIR_ENV_VAR]: '/home/user/.happy/memory',
    });
  });
});
