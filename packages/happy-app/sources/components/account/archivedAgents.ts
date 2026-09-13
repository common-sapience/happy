import type { Machine, Session } from '@/sync/storageTypes';
import { isSessionArchived } from '@/sync/sessionArchived';
import { isMachineOnline } from '@/utils/machineUtils';

/**
 * DESK-14: the archived-agent board of the account page.
 *
 * An archived agent can always be read: the transcript is already on the control end, so the
 * session view renders it with the computer switched off. Restoring is different — the archive
 * state belongs to the host (RL-07), so it can only be asked of a computer that is reachable. A
 * row therefore carries the reason it cannot be restored instead of a disabled control with no
 * explanation.
 */
export type RestoreBlockedReason = 'computer-offline' | 'computer-unknown';

export interface ArchivedAgentRow {
    session: Session;
    machineId: string | null;
    computerName: string | null;
    restoreBlockedReason: RestoreBlockedReason | null;
}

function computerNameOf(machine: Machine): string {
    return machine.metadata?.displayName || machine.metadata?.host || machine.id;
}

/**
 * Archived agents, most recently touched first, each with its computer and whether that computer
 * can be asked to restore it right now.
 */
export function buildArchivedAgentRows(
    sessions: readonly Session[],
    machines: readonly Machine[],
): ArchivedAgentRow[] {
    const machinesById = new Map(machines.map((machine) => [machine.id, machine]));

    return sessions
        .filter((session) => isSessionArchived(session))
        .slice()
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
        .map((session) => {
            const machineId = session.metadata?.machineId ?? null;
            const machine = machineId ? machinesById.get(machineId) ?? null : null;
            if (!machine) {
                return { session, machineId, computerName: null, restoreBlockedReason: 'computer-unknown' as const };
            }
            return {
                session,
                machineId,
                computerName: computerNameOf(machine),
                restoreBlockedReason: isMachineOnline(machine) ? null : ('computer-offline' as const),
            };
        });
}

export function canRestoreArchivedAgent(row: ArchivedAgentRow): boolean {
    return row.restoreBlockedReason === null;
}

