import { describe, expect, it } from 'vitest';
import type { Machine } from '@/sync/storageTypes';
import { buildConnectedComputerRows } from './connectedComputers';

function machine(overrides: Partial<Machine> & { id: string }): Machine {
    return {
        seq: 1,
        createdAt: 1,
        updatedAt: 1,
        active: true,
        activeAt: 1,
        metadata: { host: 'host' } as Machine['metadata'],
        metadataVersion: 1,
        daemonState: null,
        daemonStateVersion: 1,
        ...overrides,
    } as Machine;
}

describe('DESK-16 connected computer board', () => {
    it('puts reachable computers first and orders the rest by when they were last seen', () => {
        const rows = buildConnectedComputerRows([
            machine({ id: 'off-recent', active: false, activeAt: 500 }),
            machine({ id: 'on-stale', active: true, activeAt: 10 }),
            machine({ id: 'off-old', active: false, activeAt: 20 }),
        ]);

        expect(rows.map((row) => row.machineId)).toEqual(['on-stale', 'off-recent', 'off-old']);
    });

    it('names a computer by its chosen name, falling back to the host name', () => {
        const rows = buildConnectedComputerRows([
            machine({ id: 'a', metadata: { host: 'mini', displayName: 'Studio' } as Machine['metadata'] }),
            machine({ id: 'b', metadata: { host: 'mini-2' } as Machine['metadata'] }),
            machine({ id: 'c', metadata: null }),
        ]);

        expect(rows.map((row) => row.name)).toEqual(['Studio', 'mini-2', 'c']);
    });

    it('says on or off in words rather than by colour alone', () => {
        const rows = buildConnectedComputerRows([
            machine({ id: 'a', active: true, metadata: { host: 'mini', platform: 'darwin' } as Machine['metadata'] }),
            machine({ id: 'b', active: false, metadata: { host: 'box' } as Machine['metadata'] }),
        ]);

        expect(rows[0].description).toBe('darwin · On');
        expect(rows[1].description).toBe('Off');
    });
});
