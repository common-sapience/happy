import * as React from 'react';
import { useRouter } from 'expo-router';
import { useAllMachines } from '@/sync/storage';
import { collectMachineChoices } from '@/sync/machineChoices';
import { useOfflineMachineTroubleshooting } from '@/hooks/useOfflineMachineTroubleshooting';
import { EmptyState, NewAgentButton, SecondaryButton } from './kit';
import { t } from '@/text';

/**
 * The agent list with nothing in it (DESK-11): one line saying why, and the one
 * action that changes it. Which action depends on whether there is a computer to
 * run on at all — offering "new agent" with no reachable computer would only fail
 * later (HA-02). The same component serves every surface that can show an empty
 * list, so the list has one empty state rather than one per layout, and it drops
 * its own button where the chrome around it already shows one — the product has
 * exactly one creation entry on screen at a time.
 */
export function EmptyAgentList({ hasArchivedAgents, onShowArchived, showCreateAction = true }: {
    hasArchivedAgents?: boolean;
    onShowArchived?: () => void;
    /** False where the surrounding chrome already carries the creation control. */
    showCreateAction?: boolean;
}) {
    const router = useRouter();
    const machines = useAllMachines({ includeOffline: true });
    const machineChoices = React.useMemo(() => collectMachineChoices(machines), [machines]);
    const hasOnlineMachines = machineChoices.some((machine) => machine.online);
    const troubleshoot = useOfflineMachineTroubleshooting(machineChoices);

    const archiveAction = hasArchivedAgents && onShowArchived
        ? <SecondaryButton title={t('sidebar.showArchived')} onPress={onShowArchived} size="compact" />
        : null;

    if (hasOnlineMachines) {
        return (
            <EmptyState
                title={t('harness.noAgentsTitle')}
                description={t('harness.noAgentsDescription')}
                action={(
                    <>
                        {showCreateAction && (
                            <NewAgentButton title={t('sidebar.newAgent')} onPress={() => router.navigate('/new')} />
                        )}
                        {archiveAction}
                    </>
                )}
            />
        );
    }

    if (machineChoices.length > 0) {
        return (
            <EmptyState
                title={t('harness.computerUnreachableTitle')}
                description={t('harness.computerUnreachableDescription')}
                action={(
                    <>
                        <SecondaryButton title={t('harness.troubleshoot')} onPress={troubleshoot} />
                        {archiveAction}
                    </>
                )}
            />
        );
    }

    return (
        <EmptyState
            title={t('harness.noComputersTitle')}
            description={t('harness.noComputersDescription')}
            action={archiveAction}
        />
    );
}
