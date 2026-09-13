/**
 * The memory consolidation pass, a.k.a. the dream (ENG-19, T-15).
 *
 * Writing memories happens inside ordinary sessions. Tidying them up — merging
 * duplicates, resolving contradictions, turning relative dates absolute, pruning
 * the index — is a separate engine session the daemon starts in the background,
 * under the `dream` profile, with the memory directory as its cwd.
 *
 * T-15's current assumption for when to start one: enough finished sessions have
 * piled up since the last pass, or enough time has passed with at least one
 * finished session to tidy. Both thresholds are host config; the counters are
 * host state. Nothing runs on an empty window, and never two passes at once — a
 * second pass would race the first one's writes to the same index.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { configuration } from '@/configuration';
import { readSettings } from '@/persistence';
import { logger } from '@/ui/logger';

/** Engine agent profile the consolidation pass runs under. */
export const DREAM_AGENT_PROFILE = 'dream';

/**
 * The prompt the pass is started with. The four phases and everything the pass
 * is allowed to touch live in the engine's dream skill, not here: this is only
 * the instruction to load it and run it to completion.
 */
export const DREAM_PROMPT =
  'Run the memory consolidation pass now. Load the dream skill and follow its four phases to completion, then report what changed.';

/**
 * Environment variable carrying a session's one initial prompt. Session-scoped:
 * it must never survive into a later, unrelated session.
 */
export const INITIAL_PROMPT_ENV_VAR = 'HAPPY_INITIAL_PROMPT';

export const DEFAULT_DREAM_AFTER_SESSIONS = 5;
export const DEFAULT_DREAM_AFTER_HOURS = 12;

const STATE_FILE_NAME = 'memory-consolidation.json';
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

export interface DreamThresholds {
  afterSessions: number;
  afterHours: number;
}

export interface DreamState {
  /**
   * When the current window opened: the end of the last pass, or — before any
   * pass has run — when this host first started counting.
   */
  lastDreamAt: number;
  /** Sessions that have finished since that moment. */
  sessionsSinceDream: number;
}

export function dreamStateFile(): string {
  return join(configuration.happyHomeDir, STATE_FILE_NAME);
}

/**
 * Host thresholds. A value that is not a positive finite number falls back to
 * the default rather than disabling the pass or firing it on every session.
 */
export async function readDreamThresholds(): Promise<DreamThresholds> {
  const settings = await readSettings();
  return {
    afterSessions: positiveNumberOr(settings.dreamAfterSessions, DEFAULT_DREAM_AFTER_SESSIONS),
    afterHours: positiveNumberOr(settings.dreamAfterHours, DEFAULT_DREAM_AFTER_HOURS),
  };
}

function positiveNumberOr(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return value;
}

/**
 * Reads the counters. A missing or unreadable state file opens a fresh window at
 * `now` instead of pretending a pass is overdue.
 */
export async function readDreamState(now: number = Date.now()): Promise<DreamState> {
  try {
    const raw = await readFile(dreamStateFile(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<DreamState>;
    return {
      lastDreamAt: positiveNumberOr(parsed.lastDreamAt, now),
      sessionsSinceDream:
        typeof parsed.sessionsSinceDream === 'number' && Number.isFinite(parsed.sessionsSinceDream) && parsed.sessionsSinceDream > 0
          ? Math.floor(parsed.sessionsSinceDream)
          : 0,
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      logger.debug(`[MEMORY] Could not read ${STATE_FILE_NAME}: ${code ?? 'unknown error'}`);
    }
    return { lastDreamAt: now, sessionsSinceDream: 0 };
  }
}

export async function writeDreamState(state: DreamState): Promise<void> {
  await mkdir(configuration.happyHomeDir, { recursive: true });
  await writeFile(dreamStateFile(), JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Whether a pass is due. An empty window never is, however long it has been:
 * there is nothing new to consolidate.
 */
export function isDreamDue(state: DreamState, thresholds: DreamThresholds, now: number): boolean {
  if (state.sessionsSinceDream < 1) {
    return false;
  }
  if (state.sessionsSinceDream >= thresholds.afterSessions) {
    return true;
  }
  return now - state.lastDreamAt >= thresholds.afterHours * MILLISECONDS_PER_HOUR;
}

export interface MemoryConsolidationRunnerOptions {
  /** Starts the pass as an engine session and resolves with its session id. */
  startDreamSession: () => Promise<string>;
  now?: () => number;
}

/**
 * Owns the counters and the single-pass guard. The daemon tells it when a
 * session finished, the heartbeat asks it whether a pass is due, and the
 * `run-dream` RPC asks it to run one now.
 */
export class MemoryConsolidationRunner {
  private readonly startDreamSession: () => Promise<string>;
  private readonly now: () => number;
  private runningSessionId: string | null = null;
  private starting = false;

  constructor(options: MemoryConsolidationRunnerOptions) {
    this.startDreamSession = options.startDreamSession;
    this.now = options.now ?? Date.now;
  }

  /** True from the moment a pass is asked for until its session has ended. */
  get isRunning(): boolean {
    return this.starting || this.runningSessionId !== null;
  }

  get currentSessionId(): string | null {
    return this.runningSessionId;
  }

  /**
   * A session of this host finished. The pass's own session is not counted —
   * consolidating the consolidation would never settle.
   */
  async recordSessionEnded(sessionId?: string): Promise<void> {
    if (sessionId && sessionId === this.runningSessionId) {
      this.onDreamSessionEnded(sessionId);
      return;
    }
    const state = await readDreamState(this.now());
    await writeDreamState({ ...state, sessionsSinceDream: state.sessionsSinceDream + 1 });
  }

  /** The pass's session exited, so the next one may start. */
  onDreamSessionEnded(sessionId: string): void {
    if (this.runningSessionId !== sessionId) {
      return;
    }
    logger.debug(`[MEMORY] Consolidation session ${sessionId} ended`);
    this.runningSessionId = null;
  }

  /**
   * Starts a pass if one is due. Returns the session id it started, or null when
   * nothing was due or a pass is already in flight.
   */
  async runIfDue(): Promise<string | null> {
    if (this.isRunning) {
      return null;
    }
    const now = this.now();
    const [state, thresholds] = await Promise.all([readDreamState(now), readDreamThresholds()]);
    if (!isDreamDue(state, thresholds, now)) {
      return null;
    }
    logger.debug(
      `[MEMORY] Consolidation due: ${state.sessionsSinceDream} session(s) and ` +
        `${Math.round((now - state.lastDreamAt) / MILLISECONDS_PER_HOUR)}h since the last pass`,
    );
    return this.start(now);
  }

  /**
   * Starts a pass on demand, ignoring the thresholds. Refuses while one is in
   * flight rather than racing it.
   */
  async runNow(): Promise<string> {
    if (this.isRunning) {
      throw new Error('A memory consolidation pass is already running on this machine');
    }
    return this.start(this.now());
  }

  private async start(now: number): Promise<string> {
    this.starting = true;
    try {
      const sessionId = await this.startDreamSession();
      this.runningSessionId = sessionId;
      await writeDreamState({ lastDreamAt: now, sessionsSinceDream: 0 });
      logger.debug(`[MEMORY] Consolidation pass started as session ${sessionId}`);
      return sessionId;
    } finally {
      this.starting = false;
    }
  }
}
