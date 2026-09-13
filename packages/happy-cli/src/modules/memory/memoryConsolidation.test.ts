import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_DREAM_AFTER_HOURS,
  DEFAULT_DREAM_AFTER_SESSIONS,
  DREAM_AGENT_PROFILE,
  DREAM_PROMPT,
  MemoryConsolidationRunner,
  dreamStateFile,
  isDreamDue,
  readDreamState,
  readDreamThresholds,
  writeDreamState,
} from './memoryConsolidation';
import { readSettings } from '@/persistence';

const mockConfiguration = vi.hoisted(() => ({ happyHomeDir: '' }));

vi.mock('@/configuration', () => ({ configuration: mockConfiguration }));
vi.mock('@/persistence', () => ({ readSettings: vi.fn() }));
vi.mock('@/ui/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn() },
}));

const mockedReadSettings = vi.mocked(readSettings);
const baseSettings = { schemaVersion: 2, onboardingCompleted: true };

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

let homeDir: string;

beforeEach(() => {
  homeDir = mkdtempSync(join(tmpdir(), 'happy-dream-'));
  mockConfiguration.happyHomeDir = homeDir;
  mockedReadSettings.mockReset();
  mockedReadSettings.mockResolvedValue({ ...baseSettings });
});

afterEach(() => {
  rmSync(homeDir, { recursive: true, force: true });
});

describe('T-15 consolidation thresholds', () => {
  it('defaults both thresholds when the host set neither', async () => {
    await expect(readDreamThresholds()).resolves.toEqual({
      afterSessions: DEFAULT_DREAM_AFTER_SESSIONS,
      afterHours: DEFAULT_DREAM_AFTER_HOURS,
    });
  });

  it('takes the thresholds the host set', async () => {
    mockedReadSettings.mockResolvedValue({ ...baseSettings, dreamAfterSessions: 2, dreamAfterHours: 1 });

    await expect(readDreamThresholds()).resolves.toEqual({ afterSessions: 2, afterHours: 1 });
  });

  it('falls back rather than letting a zero or negative value fire on every session', async () => {
    mockedReadSettings.mockResolvedValue({ ...baseSettings, dreamAfterSessions: 0, dreamAfterHours: -3 });

    await expect(readDreamThresholds()).resolves.toEqual({
      afterSessions: DEFAULT_DREAM_AFTER_SESSIONS,
      afterHours: DEFAULT_DREAM_AFTER_HOURS,
    });
  });
});

describe('T-15 consolidation state under HAPPY_HOME_DIR', () => {
  it('lives next to the rest of the host state', () => {
    expect(dreamStateFile()).toBe(join(homeDir, 'memory-consolidation.json'));
  });

  it('opens a fresh window when no state has been written yet', async () => {
    await expect(readDreamState(NOW)).resolves.toEqual({ lastDreamAt: NOW, sessionsSinceDream: 0 });
  });

  it('round-trips what the daemon wrote', async () => {
    await writeDreamState({ lastDreamAt: NOW - HOUR, sessionsSinceDream: 3 });

    await expect(readDreamState(NOW)).resolves.toEqual({ lastDreamAt: NOW - HOUR, sessionsSinceDream: 3 });
  });

  it('opens a fresh window instead of treating a corrupt file as overdue', async () => {
    writeFileSync(dreamStateFile(), 'not json', 'utf8');

    await expect(readDreamState(NOW)).resolves.toEqual({ lastDreamAt: NOW, sessionsSinceDream: 0 });
  });
});

describe('T-15 when a consolidation pass is due', () => {
  const thresholds = { afterSessions: 5, afterHours: 12 };

  it('fires on the session-count threshold', () => {
    expect(isDreamDue({ lastDreamAt: NOW, sessionsSinceDream: 5 }, thresholds, NOW)).toBe(true);
  });

  it('does not fire below the session-count threshold inside the time window', () => {
    expect(isDreamDue({ lastDreamAt: NOW, sessionsSinceDream: 4 }, thresholds, NOW)).toBe(false);
  });

  it('fires on the time threshold with a single session to consolidate', () => {
    expect(isDreamDue({ lastDreamAt: NOW - 12 * HOUR, sessionsSinceDream: 1 }, thresholds, NOW)).toBe(true);
  });

  it('does not fire before the time threshold', () => {
    expect(isDreamDue({ lastDreamAt: NOW - 11 * HOUR, sessionsSinceDream: 1 }, thresholds, NOW)).toBe(false);
  });

  it('never fires on an empty window, however long it has been', () => {
    expect(isDreamDue({ lastDreamAt: NOW - 400 * HOUR, sessionsSinceDream: 0 }, thresholds, NOW)).toBe(false);
  });
});

describe('T-15 consolidation runner', () => {
  const makeRunner = (startDreamSession = vi.fn(async () => 'dream-1'), now = () => NOW) => ({
    runner: new MemoryConsolidationRunner({ startDreamSession, now }),
    startDreamSession,
  });

  it('counts a finished session toward the next pass', async () => {
    const { runner } = makeRunner();

    await runner.recordSessionEnded('session-1');
    await runner.recordSessionEnded('session-2');

    await expect(readDreamState(NOW)).resolves.toMatchObject({ sessionsSinceDream: 2 });
  });

  it('starts a pass once the session count is reached', async () => {
    mockedReadSettings.mockResolvedValue({ ...baseSettings, dreamAfterSessions: 2 });
    const { runner, startDreamSession } = makeRunner();

    await runner.recordSessionEnded('session-1');
    expect(await runner.runIfDue()).toBeNull();

    await runner.recordSessionEnded('session-2');
    expect(await runner.runIfDue()).toBe('dream-1');
    expect(startDreamSession).toHaveBeenCalledTimes(1);
  });

  it('starts a pass once the time threshold elapsed with one session', async () => {
    mockedReadSettings.mockResolvedValue({ ...baseSettings, dreamAfterSessions: 99, dreamAfterHours: 6 });
    const { runner, startDreamSession } = makeRunner();
    await writeDreamState({ lastDreamAt: NOW - 6 * HOUR, sessionsSinceDream: 1 });

    expect(await runner.runIfDue()).toBe('dream-1');
    expect(startDreamSession).toHaveBeenCalledTimes(1);
  });

  it('starts nothing when neither threshold is reached', async () => {
    const { runner, startDreamSession } = makeRunner();
    await writeDreamState({ lastDreamAt: NOW - HOUR, sessionsSinceDream: 1 });

    expect(await runner.runIfDue()).toBeNull();
    expect(startDreamSession).not.toHaveBeenCalled();
  });

  it('closes the window after a pass, so the next one starts from zero', async () => {
    mockedReadSettings.mockResolvedValue({ ...baseSettings, dreamAfterSessions: 1 });
    const { runner } = makeRunner();
    await writeDreamState({ lastDreamAt: NOW - 50 * HOUR, sessionsSinceDream: 4 });

    await runner.runIfDue();

    expect(JSON.parse(readFileSync(dreamStateFile(), 'utf8'))).toEqual({
      lastDreamAt: NOW,
      sessionsSinceDream: 0,
    });
  });

  it('never runs two passes at once, because both would write the same index', async () => {
    mockedReadSettings.mockResolvedValue({ ...baseSettings, dreamAfterSessions: 1 });
    const { runner, startDreamSession } = makeRunner();
    await writeDreamState({ lastDreamAt: NOW, sessionsSinceDream: 9 });

    expect(await runner.runIfDue()).toBe('dream-1');
    await writeDreamState({ lastDreamAt: NOW, sessionsSinceDream: 9 });

    expect(await runner.runIfDue()).toBeNull();
    await expect(runner.runNow()).rejects.toThrow('already running');
    expect(startDreamSession).toHaveBeenCalledTimes(1);
  });

  it('lets the next pass start once the running one ended', async () => {
    const { runner, startDreamSession } = makeRunner();

    expect(await runner.runNow()).toBe('dream-1');
    runner.onDreamSessionEnded('dream-1');

    expect(await runner.runNow()).toBe('dream-1');
    expect(startDreamSession).toHaveBeenCalledTimes(2);
  });

  it('does not count its own pass as a session to consolidate', async () => {
    const { runner } = makeRunner();

    await runner.runNow();
    await runner.recordSessionEnded('dream-1');

    expect(runner.isRunning).toBe(false);
    await expect(readDreamState(NOW)).resolves.toMatchObject({ sessionsSinceDream: 0 });
  });

  it('runs on demand even when no threshold is reached', async () => {
    const { runner, startDreamSession } = makeRunner();
    await writeDreamState({ lastDreamAt: NOW, sessionsSinceDream: 0 });

    expect(await runner.runNow()).toBe('dream-1');
    expect(startDreamSession).toHaveBeenCalledTimes(1);
  });

  it('stays startable after a failed pass rather than blocking every later one', async () => {
    const startDreamSession = vi.fn(async () => {
      throw new Error('engine did not come up');
    });
    const runner = new MemoryConsolidationRunner({ startDreamSession, now: () => NOW });

    await expect(runner.runNow()).rejects.toThrow('engine did not come up');
    expect(runner.isRunning).toBe(false);
  });
});

describe('ENG-19 the consolidation pass is one fixed instruction', () => {
  it('runs under the dream profile', () => {
    expect(DREAM_AGENT_PROFILE).toBe('dream');
  });

  it('asks the engine to load the dream skill and run its four phases', () => {
    expect(DREAM_PROMPT).toBe(
      'Run the memory consolidation pass now. Load the dream skill and follow its four phases to completion, then report what changed.',
    );
  });
});
