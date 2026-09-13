/**
 * The engine is the only agent the daemon knows (HOST-10). Its name and ACP
 * invocation live here so every caller — CLI dispatch, daemon spawn, machine
 * capability report — reads the same constants.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { isPackagedExecutable, packagedExecutableDir } from '@/utils/packagedExecutable';

export const ENGINE_AGENT_NAME = 'opencode' as const;
export const ENGINE_ACP_COMMAND = 'opencode';
/**
 * File name of the engine sidecar inside the desktop package (T-29).
 *
 * Product-prefixed on purpose: the Linux package installs the daemon into a
 * directory it shares with everything else on the system, so a sibling called
 * `opencode` there is the user's own install rather than the engine this
 * package shipped. Only this name is ever taken from beside the daemon.
 */
export const ENGINE_SIDECAR_NAME = 'happy-engine';
export const ENGINE_ACP_ARGS: readonly string[] = ['acp'];
export const ENGINE_PATH_ENV_VAR = 'HAPPY_ENGINE_PATH';

export type EngineAgentName = typeof ENGINE_AGENT_NAME;

export type AcpAgentConfig = {
  command: string;
  args: string[];
};

export type ResolvedAcpAgentConfig = {
  agentName: string;
  command: string;
  args: string[];
};

export function isEngineAgentName(agent: string | undefined): agent is EngineAgentName {
  return agent === undefined || agent === ENGINE_AGENT_NAME;
}

/**
 * Resolves the engine executable for this installation.
 *
 * Desktop installs ship the engine next to the daemon (DESK-09) under its own
 * product-prefixed name (T-29), so that binary wins over whatever a shell
 * happens to have on PATH.
 * The environment variable stays ahead of both so a developer — or the desktop
 * shell during a test run — can point the daemon at another engine build.
 */
export function resolveEngineCommand(
  deps: {
    env?: NodeJS.ProcessEnv;
    packaged?: boolean;
    executableDir?: string;
    exists?: (path: string) => boolean;
    platform?: NodeJS.Platform;
  } = {},
): string {
  const env = deps.env ?? process.env;
  const exists = deps.exists ?? existsSync;

  const fromEnv = env[ENGINE_PATH_ENV_VAR]?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const packaged = deps.packaged ?? isPackagedExecutable();
  if (packaged) {
    const platform = deps.platform ?? process.platform;
    const executableName = platform === 'win32' ? `${ENGINE_SIDECAR_NAME}.exe` : ENGINE_SIDECAR_NAME;
    const sibling = join(deps.executableDir ?? packagedExecutableDir(), executableName);
    if (exists(sibling)) {
      return sibling;
    }
  }

  return ENGINE_ACP_COMMAND;
}

/**
 * Resolves the ACP invocation for `happy acp <args>`.
 *
 * Only the engine is accepted by name. `--` stays as the explicit escape hatch
 * for pointing the runner at a specific engine build; every other agent name is
 * rejected rather than silently executed as a command (HOST-10).
 */
export function resolveAcpAgentConfig(cliArgs: string[]): ResolvedAcpAgentConfig {
  if (cliArgs.length === 0) {
    return {
      agentName: ENGINE_AGENT_NAME,
      command: resolveEngineCommand(),
      args: [...ENGINE_ACP_ARGS],
    };
  }

  if (cliArgs[0] === '--') {
    const command = cliArgs[1];
    if (!command) {
      throw new Error('Missing command after "--". Usage: happy acp -- <command> [args]');
    }
    return {
      agentName: ENGINE_AGENT_NAME,
      command,
      args: cliArgs.slice(2),
    };
  }

  const agentName = cliArgs[0];
  if (agentName !== ENGINE_AGENT_NAME) {
    throw new Error(
      `Unsupported agent: '${agentName}'. Only '${ENGINE_AGENT_NAME}' is supported; use 'happy acp -- <command>' to run a specific engine build.`,
    );
  }

  return {
    agentName: ENGINE_AGENT_NAME,
    command: resolveEngineCommand(),
    // Backward-compatible with old OpenCode docs/flags.
    args: [...ENGINE_ACP_ARGS, ...cliArgs.slice(1).filter((arg) => arg !== '--acp')],
  };
}
