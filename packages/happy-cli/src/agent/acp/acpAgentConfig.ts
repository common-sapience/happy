/**
 * The engine is the only agent the daemon knows (HOST-10). Its name and ACP
 * invocation live here so every caller — CLI dispatch, daemon spawn, machine
 * capability report — reads the same constants.
 */
export const ENGINE_AGENT_NAME = 'opencode' as const;
export const ENGINE_ACP_COMMAND = 'opencode';
export const ENGINE_ACP_ARGS: readonly string[] = ['acp'];

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
      command: ENGINE_ACP_COMMAND,
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
    command: ENGINE_ACP_COMMAND,
    // Backward-compatible with old OpenCode docs/flags.
    args: [...ENGINE_ACP_ARGS, ...cliArgs.slice(1).filter((arg) => arg !== '--acp')],
  };
}
