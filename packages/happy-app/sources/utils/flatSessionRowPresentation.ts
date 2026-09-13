import type { SessionState } from '@/sync/sessionState';

export const SESSION_READY_DOT_COLOR = '#007AFF';
export const SESSION_BLOCKED_DOT_COLOR = '#FF9500';

export type FlatSessionRowTopRight =
    | { type: 'dot'; color: typeof SESSION_READY_DOT_COLOR | typeof SESSION_BLOCKED_DOT_COLOR }
    | { type: 'timestamp' };

/**
 * What the row's trailing slot shows. The agent's state is already a word and a
 * dot next to its name, so this slot stays the time of last activity unless
 * something wants the user's attention.
 */
export function resolveFlatSessionRowPresentation({
    state,
    hasUnread,
    faded,
}: {
    state: SessionState;
    hasUnread: boolean;
    faded: boolean;
}): { topRight: FlatSessionRowTopRight } {
    if (faded) {
        return { topRight: { type: 'timestamp' } };
    }

    if (state === 'permission_required' || state === 'input_required') {
        return { topRight: { type: 'dot', color: SESSION_BLOCKED_DOT_COLOR } };
    }

    if (state === 'thinking') {
        return { topRight: { type: 'timestamp' } };
    }

    if (hasUnread) {
        return { topRight: { type: 'dot', color: SESSION_READY_DOT_COLOR } };
    }

    return { topRight: { type: 'timestamp' } };
}