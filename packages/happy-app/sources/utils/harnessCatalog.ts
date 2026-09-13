import type { NewSessionAgentType } from '@/sync/persistence';

/**
 * The single agent the product starts sessions with. The key is the wire id the
 * daemon expects; the label is what the UI calls it.
 */
export const ENGINE_AGENT: NewSessionAgentType = 'opencode';

export const HARNESS_NAMES: Record<NewSessionAgentType, string> = {
    opencode: 'Agent',
};

export const HARNESS_ORDER: readonly NewSessionAgentType[] = [ENGINE_AGENT];

/**
 * What a machine reports about the agents it can run. The daemon's capability
 * report is owned by the wire package, so this stays a loose map and only the
 * engine's key is read out of it.
 */
export type HarnessAvailability = { readonly [key: string]: boolean | number | undefined };

export type HarnessOption = {
    key: NewSessionAgentType;
    name: string;
};

export function getHarnessName(key: NewSessionAgentType | string): string {
    return HARNESS_NAMES[key as NewSessionAgentType] ?? key;
}

/**
 * The engine ships inside the desktop package, so it is always offered. A
 * daemon that reports no capabilities at all is still offered the engine rather
 * than an empty list.
 */
export function isHarnessAvailable({
    availability,
    key,
}: {
    availability?: HarnessAvailability | null;
    key: NewSessionAgentType;
}): boolean {
    return key === ENGINE_AGENT && (!availability || availability[key] !== false);
}

export function listAvailableHarnesses(_options?: {
    availability?: HarnessAvailability | null;
    selected?: NewSessionAgentType | null;
}): HarnessOption[] {
    return [{ key: ENGINE_AGENT, name: HARNESS_NAMES[ENGINE_AGENT] }];
}
