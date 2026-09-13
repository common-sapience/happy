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
 * run on at all — offering "new agent" with no reachable computer would only
 * fail later (HA-02).
 */
export function EmptySessionsTablet() {
    const router = useRouter();
    const machines = useAllMachines({ includeOffline: true });
    const machineChoices = React.useMemo(() => collectMachineChoices(machines), [machines]);
    const hasOnlineMachines = machineChoices.some((machine) => machine.online);
    const hasOfflineMachines = machineChoices.length > 0 && !hasOnlineMachines;
    const troubleshoot = useOfflineMachineTroubleshooting(machineChoices);

    if (hasOnlineMachines) {
        return (
            <EmptyState
                title={t('harness.noAgentsTitle')}
                description={t('harness.noAgentsDescription')}
                action={<NewAgentButton title={t('sidebar.newAgent')} onPress={() => router.navigate('/new')} />}
            />
        );
    }

    if (hasOfflineMachines) {
        return (
            <EmptyState
                title={t('harness.computerUnreachableTitle')}
                description={t('harness.computerUnreachableDescription')}
                action={<SecondaryButton title={t('harness.troubleshoot')} onPress={troubleshoot} />}
            />
        );
    }

    return (
        <EmptyState
            title={t('harness.noComputersTitle')}
            description={t('harness.noComputersDescription')}
        />
    );
}
