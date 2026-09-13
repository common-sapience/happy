import * as React from 'react';
import { ActivityIndicator, Platform, Pressable } from 'react-native';
import { Text } from '@/components/StyledText';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { MOBILE_GLASS_HEADER_HEIGHT } from '@/components/navigation/headerMetrics';
import { useAllMachines, useAllSessions } from '@/sync/storage';
import { sessionArchive } from '@/sync/ops';
import { Modal } from '@/modal';
import { getSessionName } from '@/utils/sessionUtils';
import { useNavigateToSession } from '@/hooks/useNavigateToSession';
import { useUnistyles } from 'react-native-unistyles';
import { t } from '@/text';
import {
    buildArchivedAgentRows,
    canRestoreArchivedAgent,
    type ArchivedAgentRow,
} from '@/components/account/archivedAgents';

/**
 * DESK-14: archived agents.
 *
 * Reading one is always possible — the transcript is already here, so the row opens the agent's
 * history whether or not its computer is on. Bringing one back is a write the host owns (RL-07), so
 * it is offered only while that computer is reachable, and the row says why when it is not.
 */
function rowSubtitle(row: ArchivedAgentRow): string {
    const computer = row.computerName ?? t('archivedAgents.thatComputer');
    switch (row.restoreBlockedReason) {
        case null:
            return t('archivedAgents.onComputer', { computer });
        case 'computer-offline':
            return t('archivedAgents.computerOffline', { computer });
        case 'computer-unknown':
            return t('archivedAgents.computerUnknown');
    }
}

export default function ArchivedAgentsScreen() {
    const { theme } = useUnistyles();
    const sessions = useAllSessions();
    const machines = useAllMachines({ includeOffline: true });
    const navigateToSession = useNavigateToSession();
    const [restoringSessionId, setRestoringSessionId] = React.useState<string | null>(null);

    const rows = React.useMemo(
        () => buildArchivedAgentRows(sessions, machines),
        [sessions, machines],
    );

    const restore = React.useCallback(async (row: ArchivedAgentRow) => {
        setRestoringSessionId(row.session.id);
        try {
            const result = await sessionArchive(row.session.id, false);
            if (!result.success) {
                Modal.alert(t('archivedAgents.restoreFailedTitle'), result.message ?? t('archivedAgents.restoreFailedMessage'));
            }
        } finally {
            setRestoringSessionId(null);
        }
    }, []);

    return (
        <ItemList
            containerStyle={{ paddingTop: Platform.OS === 'ios' ? MOBILE_GLASS_HEADER_HEIGHT : 0 }}
        >
            {rows.length === 0 ? (
                <ItemGroup footer={t('archivedAgents.emptyFooter')}>
                    <Item
                        title={t('archivedAgents.emptyTitle')}
                        subtitle={t('archivedAgents.emptyHint')}
                        showChevron={false}
                    />
                </ItemGroup>
            ) : (
                <ItemGroup footer={t('archivedAgents.footer')}>
                    {rows.map((row) => {
                        const restorable = canRestoreArchivedAgent(row);
                        const isRestoring = restoringSessionId === row.session.id;
                        return (
                            <Item
                                key={row.session.id}
                                title={getSessionName(row.session)}
                                subtitle={rowSubtitle(row)}
                                onPress={() => navigateToSession(row.session.id)}
                                showChevron={!restorable}
                                rightElement={restorable ? (
                                    isRestoring ? (
                                        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                                    ) : (
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel={t('archivedAgents.bringBackAgent', { name: getSessionName(row.session) })}
                                            hitSlop={10}
                                            onPress={() => void restore(row)}
                                            disabled={restoringSessionId !== null}
                                        >
                                            <Text style={{ fontSize: 15, color: theme.colors.header.tint }}>
                                                {t('archivedAgents.bringBack')}
                                            </Text>
                                        </Pressable>
                                    )
                                ) : undefined}
                            />
                        );
                    })}
                </ItemGroup>
            )}
        </ItemList>
    );
}
