import type { SessionState } from '@/sync/sessionState';
import type { Theme } from '@/theme';
import { t } from '@/text';

/**
 * The only states an agent has on screen (DESK-11): running, idle, waiting for
 * an answer, archived. Everything the transport distinguishes below that — a
 * permission request versus the agent's own question, a dropped socket versus a
 * retired session — lands in one of these four, and the same word is used in the
 * list, the conversation and notifications.
 */
export type AgentListState = 'running' | 'idle' | 'waiting' | 'archived';

export function resolveAgentListState({ state, archived }: {
    state: SessionState;
    archived: boolean;
}): AgentListState {
    if (archived) {
        return 'archived';
    }
    // A permission card and the agent's own question are the same thing to the
    // user: the agent stopped and wants an answer.
    if (state === 'permission_required' || state === 'input_required') {
        return 'waiting';
    }
    if (state === 'thinking') {
        return 'running';
    }
    // A session whose host went away can no longer be worked on, so it reads as
    // retired rather than as a fourth live state.
    if (state === 'disconnected') {
        return 'archived';
    }
    return 'idle';
}

export function agentListStateLabel(state: AgentListState): string {
    switch (state) {
        case 'running':
            return t('harness.stateRunning');
        case 'waiting':
            return t('harness.stateWaiting');
        case 'archived':
            return t('harness.stateArchived');
        case 'idle':
            return t('harness.stateIdle');
    }
}

/**
 * Colour accompanies the word, it never replaces it (design.md §5). Idle and
 * archived deliberately share the neutral text colour: only work that wants
 * attention is tinted.
 */
export function agentListStateColor(state: AgentListState, theme: Theme): string {
    switch (state) {
        case 'running':
            return theme.colors.status.connected;
        case 'waiting':
            return theme.colors.permission.bypass;
        case 'archived':
        case 'idle':
            return theme.colors.textSecondary;
    }
}
