import * as React from 'react';
import { View, ActivityIndicator, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SessionsList } from './SessionsList';
import { EmptyAgentList } from './EmptyAgentList';
import { RelayStalledNotice } from './RelayStalledNotice';
import { useHasArchivedSessions, useVisibleSessionListViewData } from '@/hooks/useVisibleSessionListViewData';
import { useAllMachines, useRelayStalledOn, useSettingMutable } from '@/sync/storage';
import { resolveAgentListBoot } from '@/sync/relayReachability';
import { collectMachineChoices } from '@/sync/machineChoices';

const stylesheet = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
    },
    loadingContainerWrapper: {
        flex: 1,
        flexBasis: 0,
        flexGrow: 1,
        backgroundColor: theme.colors.groupped.background,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 32,
    },
    emptyStateContainer: {
        flex: 1,
        flexBasis: 0,
        flexGrow: 1,
        flexDirection: 'column',
        backgroundColor: theme.colors.groupped.background,
    },
    emptyStateContentContainer: {
        flex: 1,
        flexBasis: 0,
        flexGrow: 1,
    },
}));

export const SessionsListWrapper = React.memo(({
    topContentInset = 0,
    scrollIndicatorTopInset = 0,
    bottomContentInset = 128,
    onScroll,
}: {
    topContentInset?: number;
    scrollIndicatorTopInset?: number;
    bottomContentInset?: number;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) => {
    const { theme } = useUnistyles();
    const sessionListViewData = useVisibleSessionListViewData();
    const relayStalledOn = useRelayStalledOn();
    const boot = resolveAgentListBoot({ dataReady: sessionListViewData !== null, stalledOn: relayStalledOn });
    const hasArchivedSessions = useHasArchivedSessions();
    const machines = useAllMachines({ includeOffline: true });
    const machineChoices = React.useMemo(() => collectMachineChoices(machines), [machines]);
    const hasOnlineMachines = machineChoices.some((machine) => machine.online);
    const [, setHideArchivedSessions] = useSettingMutable('hideInactiveSessions');
    const styles = stylesheet;

    // The first load is bounded: past it the list says which relay trouble it ran
    // into instead of spinning on with nothing to act on (DESK-08, DESK-21).
    if (sessionListViewData === null) {
        return (
            <View style={styles.container}>
                {boot.state === 'stalled' ? (
                    <View style={styles.emptyStateContainer}>
                        <View style={[styles.emptyStateContentContainer, { paddingTop: topContentInset }]}>
                            <RelayStalledNotice failure={boot.failure} />
                        </View>
                    </View>
                ) : (
                    <View style={[styles.loadingContainerWrapper, { paddingTop: topContentInset }]}>
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                        </View>
                    </View>
                )}
            </View>
        );
    }

    // With an online machine, an archive-only account renders SessionsList's inline archive
    // control. With no reachable machine, the connection problem is the useful primary state and
    // the archive remains available as its secondary action.
    if (sessionListViewData.length === 0 && (!hasArchivedSessions || !hasOnlineMachines)) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyStateContainer}>
                    <View style={[styles.emptyStateContentContainer, { paddingTop: topContentInset }]}>
                        <EmptyAgentList
                            hasArchivedAgents={hasArchivedSessions}
                            onShowArchived={() => setHideArchivedSessions(false)}
                        />
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SessionsList
                topContentInset={topContentInset}
                scrollIndicatorTopInset={scrollIndicatorTopInset}
                bottomContentInset={bottomContentInset}
                onScroll={onScroll}
            />
        </View>
    );
});
