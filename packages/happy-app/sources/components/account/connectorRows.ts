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
    serviceLabel: string;
    machineId: string;
    computerLabel: string;
    connected: boolean;
    statusLabel: string;
    connection: ServiceConnection;
}

function labelService(service: string): string {
    const trimmed = service.trim();
    if (trimmed.length === 0) return 'Unnamed service';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function labelComputer(machine: Machine | null, machineId: string): string {
    if (!machine) return 'A computer no longer on this account';
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
                statusLabel: connected ? 'Connected' : 'Not connected',
                connection,
            };
        });
}
