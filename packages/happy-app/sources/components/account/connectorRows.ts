import type { ServiceConnection } from '@/sync/apiServices';
import type { Machine } from '@/sync/storageTypes';

/**
 * DESK-15: the connector board of the account page.
 *
 * A row is a record, never a credential: the relay stores only "this computer of this account is
 * connected to this service" (DEV-08), and the credential itself never leaves the computer that
 * authorized it (HOST-11, P-09). So a row names the service, the computer holding the credential,
 * and whether the connection is live — and nothing the account page could leak.
 */
export interface ConnectorRow {
    key: string;
    service: string;
    /** Null when the relay recorded no vendor name; the page supplies the words for that. */
    serviceLabel: string | null;
    machineId: string;
    /** Null when the computer holding this connection has left the account. */
    computerLabel: string | null;
    connected: boolean;
    connection: ServiceConnection;
}

function labelService(service: string): string | null {
    const trimmed = service.trim();
    if (trimmed.length === 0) return null;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function labelComputer(machine: Machine | null, machineId: string): string | null {
    if (!machine) return null;
    return machine.metadata?.displayName || machine.metadata?.host || machineId;
}

export function buildConnectorRows(
    connections: readonly ServiceConnection[],
    machines: readonly Machine[],
): ConnectorRow[] {
    const machinesById = new Map(machines.map((machine) => [machine.id, machine]));

    return connections
        .slice()
        .sort((left, right) => (
            left.vendor.localeCompare(right.vendor)
            || (right.updatedAt ?? 0) - (left.updatedAt ?? 0)
        ))
        .map((connection) => {
            const connected = connection.status === 'connected';
            return {
                key: `${connection.vendor}:${connection.machineId}`,
                service: connection.vendor,
                serviceLabel: labelService(connection.vendor),
                machineId: connection.machineId,
                computerLabel: labelComputer(machinesById.get(connection.machineId) ?? null, connection.machineId),
                connected,
                connection,
            };
        });
}
