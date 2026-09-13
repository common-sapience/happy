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
import { t } from '@/text';

const serviceLabelOf = (row: ConnectorRow) => row.serviceLabel ?? t('connectors.unnamedService');
const computerLabelOf = (row: ConnectorRow) => row.computerLabel ?? t('connectors.unknownComputer');
const statusLabelOf = (row: ConnectorRow) => row.connected
    ? t('connectors.statusConnected')
    : t('connectors.statusNotConnected');

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
        const service = serviceLabelOf(row);
        const computer = computerLabelOf(row);
        const confirmed = await Modal.confirm(
            t('connectors.disconnectTitle', { service }),
            t('connectors.disconnectMessage', { service, computer }),
            { confirmText: t('connectors.disconnect'), destructive: true },
        );
        if (!confirmed) return;

        setDisconnectingKey(row.key);
        try {
            await disconnectService(auth.credentials, row.service, row.machineId);
            await load();
        } catch {
            Modal.alert(
                t('connectors.disconnectFailedTitle'),
                t('connectors.disconnectFailedMessage', { service, computer }),
            );
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
                    <Item title={t('connectors.loading')} loading showChevron={false} />
                </ItemGroup>
            ) : (
                <ItemGroup footer={t('connectors.footer')}>
                    {rows.length === 0 ? (
                        <Item
                            title={t('connectors.emptyTitle')}
                            subtitle={t('connectors.emptyHint')}
                            showChevron={false}
                        />
                    ) : rows.map((row) => (
                        <Item
                            key={row.key}
                            title={serviceLabelOf(row)}
                            subtitle={`${statusLabelOf(row)} · ${computerLabelOf(row)}`}
                            detail={t('connectors.disconnect')}
                            onPress={() => void disconnect(row)}
                            loading={disconnectingKey === row.key}
                            disabled={disconnectingKey !== null}
                            showChevron={false}
                            destructive
                        />
                    ))}
                </ItemGroup>
            )}

            <ItemGroup title={t('connectors.howTitle')}>
                <Item
                    title={t('connectors.howRow')}
                    subtitle={t('connectors.howHint')}
                    subtitleLines={0}
                    showChevron={false}
                />
            </ItemGroup>
        </ItemList>
    );
}
