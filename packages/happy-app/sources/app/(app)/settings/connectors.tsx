import * as React from 'react';
import { Platform } from 'react-native';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { MOBILE_GLASS_HEADER_HEIGHT } from '@/components/navigation/headerMetrics';
import { useAuth } from '@/auth/AuthContext';
import { useAllMachines } from '@/sync/storage';
import { disconnectService, fetchServiceConnections, type ServiceConnection } from '@/sync/apiServices';
import { Modal } from '@/modal';
import { buildConnectorRows, type ConnectorRow } from '@/components/account/connectorRows';

/**
 * DESK-15: connectors.
 *
 * The list is the relay's records and nothing more (DEV-08): a service, the computer that holds its
 * sign-in, and whether it is connected. Connecting happens on the computer itself, where the
 * credential stays (HOST-11, P-09) — the app has no sign-in flow to offer and does not pretend to.
 */
export default function ConnectorsScreen() {
    const auth = useAuth();
    const machines = useAllMachines({ includeOffline: true });
    const [connections, setConnections] = React.useState<ServiceConnection[] | null>(null);
    const [disconnectingKey, setDisconnectingKey] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        if (!auth.credentials) {
            setConnections([]);
            return;
        }
        try {
            setConnections(await fetchServiceConnections(auth.credentials));
        } catch {
            setConnections([]);
        }
    }, [auth.credentials]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const rows = React.useMemo(
        () => buildConnectorRows(connections ?? [], machines),
        [connections, machines],
    );

    const disconnect = React.useCallback(async (row: ConnectorRow) => {
        if (!auth.credentials) return;
        const confirmed = await Modal.confirm(
            `Disconnect ${row.serviceLabel}?`,
            `New agents on ${row.computerLabel} will no longer be able to use ${row.serviceLabel}.`,
            { confirmText: 'Disconnect', destructive: true },
        );
        if (!confirmed) return;

        setDisconnectingKey(row.key);
        try {
            await disconnectService(auth.credentials, row.service, row.machineId);
            await load();
        } catch {
            Modal.alert('Could not disconnect', `${row.serviceLabel} is still connected on ${row.computerLabel}.`);
        } finally {
            setDisconnectingKey(null);
        }
    }, [auth.credentials, load]);

    return (
        <ItemList
            containerStyle={{ paddingTop: Platform.OS === 'ios' ? MOBILE_GLASS_HEADER_HEIGHT : 0 }}
        >
            {connections === null ? (
                <ItemGroup>
                    <Item title="Reading your connections" loading showChevron={false} />
                </ItemGroup>
            ) : (
                <ItemGroup footer="Only the service name, the computer and the connection state are stored here. The sign-in itself never leaves the computer.">
                    {rows.length === 0 ? (
                        <Item
                            title="Nothing connected"
                            subtitle="Connect a service on the computer that should use it"
                            showChevron={false}
                        />
                    ) : rows.map((row) => (
                        <Item
                            key={row.key}
                            title={row.serviceLabel}
                            subtitle={`${row.statusLabel} · ${row.computerLabel}`}
                            detail="Disconnect"
                            onPress={() => void disconnect(row)}
                            loading={disconnectingKey === row.key}
                            disabled={disconnectingKey !== null}
                            showChevron={false}
                            destructive
                        />
                    ))}
                </ItemGroup>
            )}

            <ItemGroup title="Connecting a service">
                <Item
                    title="Set it up on the computer"
                    subtitle="Open the service's sign-in on the computer that will use it. The sign-in is stored there, in that computer's credential store, and only the record of it appears on this page."
                    subtitleLines={0}
                    showChevron={false}
                />
            </ItemGroup>
        </ItemList>
    );
}
