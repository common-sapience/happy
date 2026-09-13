import { describe, expect, it } from 'vitest';
import type { Machine, Session } from '@/sync/storageTypes';
import {
    buildArchivedAgentRows,
    canRestoreArchivedAgent,
} from './archivedAgents';

function session(overrides: Partial<Session> & { id: string }): Session {
    return {
        seq: 1,
        createdAt: 1,
        updatedAt: 1,
        active: false,
        activeAt: 1,
        metadata: { path: '/work' } as Session['metadata'],
        metadataVersion: 1,
        agentState: null,
        agentStateVersion: 1,
        thinking: false,
        thinkingAt: 0,
        presence: 0,
        ...overrides,
    } as Session;
}

function machine(overrides: Partial<Machine> & { id: string }): Machine {
    return {
        seq: 1,
        createdAt: 1,
        updatedAt: 1,
        active: true,
        activeAt: 1,
        metadata: { host: 'laptop' } as Machine['metadata'],
        metadataVersion: 1,
        daemonState: null,
        daemonStateVersion: 1,
        ...overrides,
    } as Machine;
}

describe('DESK-14 archived agent board', () => {
    it('lists only archived agents, most recently touched first', () => {
        const rows = buildArchivedAgentRows([
            session({ id: 'live', archived: false, active: true, updatedAt: 300 }),
            session({ id: 'old-archive', archived: true, updatedAt: 100 }),
            session({ id: 'new-archive', archived: true, updatedAt: 200 }),
        ], [machine({ id: 'machine-1' })]);

        expect(rows.map((row) => row.session.id)).toEqual(['new-archive', 'old-archive']);
    });

    it('allows restoring when the agent computer is on', () => {
        const rows = buildArchivedAgentRows([
            session({ id: 'archived', archived: true, metadata: { path: '/work', machineId: 'machine-1' } as Session['metadata'] }),
        ], [machine({ id: 'machine-1', active: true, metadata: { host: 'laptop', displayName: 'Studio' } as Machine['metadata'] })]);

        expect(rows[0].restoreBlockedReason).toBeNull();
        expect(canRestoreArchivedAgent(rows[0])).toBe(true);
        expect(rows[0].computerName).toBe('Studio');
    });

    it('blocks restoring with a reason while the computer is off, and still offers the transcript', () => {
        const rows = buildArchivedAgentRows([
            session({ id: 'archived', archived: true, metadata: { path: '/work', machineId: 'machine-1' } as Session['metadata'] }),
        ], [machine({ id: 'machine-1', active: false, metadata: { host: 'laptop' } as Machine['metadata'] })]);

        expect(canRestoreArchivedAgent(rows[0])).toBe(false);
        expect(rows[0].restoreBlockedReason).toBe('computer-offline');
        expect(rows[0].computerName).toBe('laptop');
    });

    it('blocks restoring when the computer has left the account', () => {
        const rows = buildArchivedAgentRows([
            session({ id: 'archived', archived: true, metadata: { path: '/work', machineId: 'gone' } as Session['metadata'] }),
        ], []);

        expect(rows[0].restoreBlockedReason).toBe('computer-unknown');
        expect(canRestoreArchivedAgent(rows[0])).toBe(false);
        expect(rows[0].computerName).toBeNull();
    });
});
