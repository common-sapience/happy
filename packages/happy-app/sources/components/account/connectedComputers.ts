import type { Machine } from '@/sync/storageTypes';
import { isMachineOnline } from '@/utils/machineUtils';

/**
 * DESK-16: the connected-computer board of the account page.
 *
 * One row per computer registered on the account (DEV-01). Reachable computers come first because
 * they are the ones an agent can be started on; the rest keep their place by when they were last
 * seen, so a computer that has been off for a month does not sit above one that was on an hour ago.
 */
export interface ConnectedComputerRow {
    machineId: string;
    name: string;
    online: boolean;
    /** Plain language: the computer's platform when it published one, plus on or off. */
    description: string;
    lastSeenAt: number;
}

function computerNameOf(machine: Machine): string {
    return machine.metadata?.displayName || machine.metadata?.host || machine.id;
}

export function buildConnectedComputerRows(machines: readonly Machine[]): ConnectedComputerRow[] {
    return machines
        .slice()
        .sort((left, right) => (
            Number(isMachineOnline(right)) - Number(isMachineOnline(left))
            || (right.activeAt ?? 0) - (left.activeAt ?? 0)
        ))
        .map((machine) => {
            const online = isMachineOnline(machine);
            const platform = machine.metadata?.platform?.trim();
            return {
                machineId: machine.id,
                name: computerNameOf(machine),
                online,
                description: [platform, online ? 'On' : 'Off'].filter(Boolean).join(' · '),
                lastSeenAt: machine.activeAt ?? 0,
            };
        });
}
