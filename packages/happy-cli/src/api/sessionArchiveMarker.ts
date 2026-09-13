import type { Metadata } from './types';

/**
 * RL-07: the archive state of a session belongs to the host and lives in the encrypted session
 * metadata. The relay keeps a plaintext boolean next to the ciphertext so it can answer list
 * queries, but that boolean is only ever derived from a host write — so every host-side writer
 * derives it here rather than carrying an archive flag of its own.
 */
export function isMetadataArchived(metadata: Metadata | null | undefined): boolean {
    return metadata?.lifecycleState === 'archived';
}

/** The metadata a host writes to archive a session, or to put it back in the active list. */
export function applyArchiveState(metadata: Metadata, archived: boolean, archivedBy: string): Metadata {
    const { archivedBy: _previousBy, archiveReason: _previousReason, ...rest } = metadata;
    if (!archived) {
        return { ...rest, lifecycleState: 'running', lifecycleStateSince: Date.now() };
    }
    return {
        ...rest,
        lifecycleState: 'archived',
        lifecycleStateSince: Date.now(),
        archivedBy,
        archiveReason: 'Archived from a control end',
    };
}
