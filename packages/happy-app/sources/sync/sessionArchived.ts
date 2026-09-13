import type { Session } from './storageTypes';

/**
 * A session the user archived, or one whose host process has ended.
 *
 * RL-07: the archive state belongs to the host. The relay keeps a plaintext marker derived from
 * the host's metadata write, so that marker settles the question whenever the relay reported one;
 * the metadata copy covers a session it did not.
 */
export function isSessionArchived(session: Session): boolean {
    if (typeof session.archived === 'boolean') return session.archived;
    return session.metadata?.lifecycleState === 'archived' || !session.active;
}
