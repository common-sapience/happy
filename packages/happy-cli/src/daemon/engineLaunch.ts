/**
 * How the daemon starts an engine session (HOST-10, HOST-12).
 *
 * One builder for both spawn paths (tmux and plain process) so the profile and
 * the engine name cannot drift between them, and one guard so no other agent
 * enters the session lifecycle.
 */

import type { SpawnSessionOptions, SpawnSessionResult } from '@/modules/common/registerCommonHandlers';
import { ENGINE_AGENT_NAME, isEngineAgentName } from '@/agent/acp/acpAgentConfig';

export const AGENT_PROFILE_FLAG = '--agent-profile';

/**
 * Refuses a spawn for anything but the engine. Returns the error result to send
 * back, or null when the request may proceed.
 */
export function rejectNonEngineSpawn(options: Pick<SpawnSessionOptions, 'agent'>): SpawnSessionResult | null {
  if (isEngineAgentName(options.agent)) {
    return null;
  }
  return {
    type: 'error',
    errorMessage: `Unsupported agent type: '${options.agent}'. Only '${ENGINE_AGENT_NAME}' is supported.`,
  };
}

export function buildEngineSessionLaunchArgs(options: Pick<SpawnSessionOptions, 'agentProfile'>): string[] {
  const args = ['acp', ENGINE_AGENT_NAME, '--started-by', 'daemon'];
  if (options.agentProfile) {
    args.push(AGENT_PROFILE_FLAG, options.agentProfile);
  }
  return args;
}
