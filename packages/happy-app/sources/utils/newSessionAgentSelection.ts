import type { NewSessionAgentType } from '@/sync/persistence';
import { ENGINE_AGENT, HARNESS_ORDER, type HarnessAvailability } from '@/utils/harnessCatalog';

export const NEW_SESSION_AGENT_ORDER = HARNESS_ORDER;

type CliAvailability = HarnessAvailability;

/**
 * There is one agent, so a persisted draft can only ever resolve to it. The
 * function stays so callers keep a single place to go through when the lineup
 * grows again.
 */
export function resolveMachineAgent(
    _selectedAgent: NewSessionAgentType,
    _availability: CliAvailability | null | undefined,
): NewSessionAgentType {
    return ENGINE_AGENT;
}
