import { AGENT_PROFILE_KEYS, ENGINE_DEFAULT_AGENT_PROFILE } from './harnessCatalog';
import { t } from '@/text';

export type AgentProfileOption = {
    /** The profile name the daemon passes to the engine as an ACP mode. */
    key: string;
    name: string;
    description: string;
};

const PROFILE_WORDS: Record<string, { name: () => string; description: () => string }> = {
    [ENGINE_DEFAULT_AGENT_PROFILE]: {
        name: () => t('harness.profileDefault'),
        description: () => t('harness.profileDefaultHint'),
    },
    plan: {
        name: () => t('harness.profilePlan'),
        description: () => t('harness.profilePlanHint'),
    },
    build: {
        name: () => t('harness.profileBuild'),
        description: () => t('harness.profileBuildHint'),
    },
};

/** The profile's plain name, or null for a session that never recorded one. */
export function getAgentProfileName(key: string | null | undefined): string | null {
    if (!key) return null;
    return PROFILE_WORDS[key]?.name() ?? null;
}

/**
 * The profiles the new-agent composer offers, in plain words (DESK-10). A profile
 * the host config adds is reachable by a session's own profile switch, not from
 * here: the composer has no session to ask yet, so it cannot discover one.
 */
export function listAgentProfiles(): AgentProfileOption[] {
    return AGENT_PROFILE_KEYS.map((key) => ({
        key,
        name: PROFILE_WORDS[key].name(),
        description: PROFILE_WORDS[key].description(),
    }));
}
