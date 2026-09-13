import { isRigMetadata } from './rig';
import type { Session } from './storageTypes';

/**
 * A session the user archived, or a Happy CLI session that has ended. Rig sessions that merely
 * lost their connection are still live work.
 *
 * RL-07: the archive state belongs to the host. The relay keeps a plaintext marker derived from
 * the host's metadata write, so that marker settles the question whenever the relay reported one;
 * the metadata copy covers a session it did not.
 *
 * Archived sessions never sit inside a project card: they trail the list as flat, date-grouped
 * rows, so revealing the archive appends to the bottom instead of reshaping the groups above it.
 */
export function isSessionArchived(session: Session): boolean {
    if (typeof session.archived === 'boolean') return session.archived;
    return session.metadata?.lifecycleState === 'archived'
        || (!isRigMetadata(session.metadata) && !session.active);
}
