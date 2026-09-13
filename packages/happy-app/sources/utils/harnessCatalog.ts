import type { NewSessionAgentType } from '@/sync/persistence';

/**
 * The single agent the product starts sessions with. The key is the wire id the
 * daemon expects; the label is what the UI calls it.
 */
export const ENGINE_AGENT: NewSessionAgentType = 'opencode';

/**
 * The engine's built-in agent profile: every tool and every skill switched on (RULE-09). A session
 * that was not given a narrower profile runs here.
 */
export const ENGINE_DEFAULT_AGENT_PROFILE = 'default';

/**
 * The engine's own consolidation profile. The daemon starts those sessions by
 * itself (`run-dream`) and marks them `metadata.internal`, so the product never
 * offers it as a choice and never lists the sessions it produces.
 */
export const ENGINE_INTERNAL_AGENT_PROFILE = 'dream';

/**
 * The agent profiles the product offers, in the order it offers them (ENG-17).
 * The engine publishes its profiles as ACP modes; this is the subset the product
 * names. The internal profile is deliberately absent. Their words live in
 * `agentProfiles.ts`, which is the only place allowed to name them.
 */
export const AGENT_PROFILE_KEYS = [ENGINE_DEFAULT_AGENT_PROFILE, 'plan', 'build'] as const;

/** Falls back to the everything-on profile rather than sending a name the engine may not define. */
export function resolveAgentProfile(key: string | null | undefined): string {
    return AGENT_PROFILE_KEYS.some((profile) => profile === key)
        ? key!
        : ENGINE_DEFAULT_AGENT_PROFILE;
}

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
