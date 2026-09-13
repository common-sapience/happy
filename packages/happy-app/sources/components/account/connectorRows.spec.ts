import { describe, expect, it } from 'vitest';
import type { ServiceConnection } from '@/sync/apiServices';
import type { Machine } from '@/sync/storageTypes';
import { buildConnectorRows } from './connectorRows';

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

function connection(overrides: Partial<ServiceConnection>): ServiceConnection {
    return {
        vendor: 'gmail',
        machineId: 'machine-1',
        status: 'connected',
        createdAt: 1,
        updatedAt: 1,
        ...overrides,
    };
}

describe('DESK-15 connector board', () => {
    it('shows a service, the computer holding it and whether it is connected', () => {
        const rows = buildConnectorRows(
            [connection({ vendor: 'gmail', machineId: 'machine-1' })],
            [machine({ id: 'machine-1', metadata: { host: 'mini', displayName: 'Studio' } as Machine['metadata'] })],
        );

        expect(rows).toHaveLength(1);
        expect(rows[0].serviceLabel).toBe('Gmail');
        expect(rows[0].computerLabel).toBe('Studio');
        expect(rows[0].statusLabel).toBe('Connected');
        expect(rows[0].key).toBe('gmail:machine-1');
    });

    it('carries no credential field of any kind', () => {
        const rows = buildConnectorRows([connection({})], [machine({ id: 'machine-1' })]);

        expect(Object.keys(rows[0].connection).sort()).toEqual([
            'createdAt', 'machineId', 'status', 'updatedAt', 'vendor',
        ]);
    });

    it('keeps a record whose computer has left the account readable', () => {
        const rows = buildConnectorRows([connection({ machineId: 'gone' })], []);

        expect(rows[0].computerLabel).toBe('A computer no longer on this account');
    });

    it('says not connected in words for a disconnected record', () => {
        const rows = buildConnectorRows([connection({ status: 'disconnected' })], [machine({ id: 'machine-1' })]);

        expect(rows[0].connected).toBe(false);
        expect(rows[0].statusLabel).toBe('Not connected');
    });

    it('groups one service across computers together', () => {
        const rows = buildConnectorRows([
            connection({ vendor: 'slack', machineId: 'machine-2' }),
            connection({ vendor: 'gmail', machineId: 'machine-2' }),
            connection({ vendor: 'gmail', machineId: 'machine-1' }),
        ], [machine({ id: 'machine-1' }), machine({ id: 'machine-2' })]);

        expect(rows.map((row) => row.service)).toEqual(['gmail', 'gmail', 'slack']);
    });
});
