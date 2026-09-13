import React, { useMemo, useState } from 'react';
import { View, Text, RefreshControl, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SettingsRow } from '@/components/kit';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { Typography } from '@/constants/Typography';
import { useSessions, useMachine } from '@/sync/storage';
import { Octicons } from '@expo/vector-icons';
import type { Session } from '@/sync/storageTypes';
import { machineUpdateMetadata, machineDelete } from '@/sync/ops';
import { Modal } from '@/modal';
import { getSessionName, getSessionSubtitle } from '@/utils/sessionUtils';
import { isMachineOnline } from '@/utils/machineUtils';
import { sync } from '@/sync/sync';
import { useUnistyles } from 'react-native-unistyles';
import { t } from '@/text';
import { useNavigateToSession } from '@/hooks/useNavigateToSession';
import { MOBILE_GLASS_HEADER_HEIGHT } from '@/components/navigation/headerMetrics';
import { ENGINE_AGENT, isHarnessAvailable } from '@/utils/harnessCatalog';
import {
    machineGetPermissionConfirmation,
    machineSetPermissionConfirmation,
    readPublishedPermissionConfirmation,
} from '@/components/account/machinePermissionConfirmation';

/**
 * DESK-16, DESK-17: one computer, in the words a user acts on — whether it is reachable, whether it
 * asks before risky steps, the agents that ran on it, and removing it.
 *
 * Ports, process ids and protocol versions are not decisions a user makes; they only matter while
 * something is wrong, so they sit behind "Details" instead of on the page (§3 标签用人话).
 */
export default function MachineDetailScreen() {
    const { theme } = useUnistyles();
    const { id: machineId } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const sessions = useSessions();
    const machine = useMachine(machineId!);
    const navigateToSession = useNavigateToSession();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRenamingMachine, setIsRenamingMachine] = useState(false);
    const [isDeletingMachine, setIsDeletingMachine] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const previousSessions = useMemo(() => {
        if (!sessions || !machineId) return [];
        const machineSessions = sessions.filter(item => {
            if (typeof item === 'string') return false;
            return (item as Session).metadata?.machineId === machineId;
        }) as Session[];
        return [...machineSessions]
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, 5);
    }, [sessions, machineId]);

    /**
     * DESK-17, PERM-08: the permission confirmation switch belongs to this computer, not to the
     * control end. The displayed value is the one the computer published in its metadata; writing
     * goes over the machine RPC and renders the value the computer settled on, which holds until
     * the published copy catches up with it. Null means "not known yet or the computer did not
     * answer" — it is never shown as "off", because claiming no confirmations are coming when the
     * computer may be asking for them is the unsafe reading.
     */
    const publishedConfirmation = readPublishedPermissionConfirmation(machine?.metadata);
    const [settledConfirmation, setSettledConfirmation] = useState<boolean | null>(null);
    const [confirmationError, setConfirmationError] = useState<string | null>(null);
    const [isChangingConfirmation, setIsChangingConfirmation] = useState(false);
    const machineIsOnline = machine ? isMachineOnline(machine) : false;
    const confirmationEnabled = settledConfirmation ?? publishedConfirmation;

    React.useEffect(() => {
        if (settledConfirmation !== null && publishedConfirmation === settledConfirmation) {
            setSettledConfirmation(null);
        }
    }, [publishedConfirmation, settledConfirmation]);

    // Only asked over RPC when the computer has published nothing to read: an older daemon, or one
    // whose first metadata write has not landed yet.
    React.useEffect(() => {
        if (!machineId || !machineIsOnline) return;
        if (publishedConfirmation !== null || settledConfirmation !== null) return;
        let cancelled = false;
        machineGetPermissionConfirmation(machineId)
            .then((enabled) => {
                if (!cancelled) setSettledConfirmation(enabled);
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                setConfirmationError(error instanceof Error ? error.message : t('machine.confirmationNoAnswer'));
            });
        return () => { cancelled = true; };
    }, [machineId, machineIsOnline, publishedConfirmation, settledConfirmation]);

    const handleConfirmationChange = async (next: boolean) => {
        if (!machineId) return;
        setIsChangingConfirmation(true);
        setConfirmationError(null);
        try {
            setSettledConfirmation(await machineSetPermissionConfirmation(machineId, next));
        } catch (error) {
            setSettledConfirmation(null);
            setConfirmationError(error instanceof Error ? error.message : t('machine.confirmationNoAnswer'));
        } finally {
            setIsChangingConfirmation(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await sync.refreshMachines();
        setIsRefreshing(false);
    };

    const handleDeleteMachine = async () => {
        if (!machineId) return;
        const confirmed = await Modal.confirm(
            t('machine.deleteConfirmTitle'),
            t('machine.deleteConfirmMessage'),
            { cancelText: t('common.cancel'), confirmText: t('machine.delete'), destructive: true }
        );
        if (!confirmed) return;

        setIsDeletingMachine(true);
        try {
            const result = await machineDelete(machineId);
            if (result.success) {
                router.back();
            } else {
                Modal.alert(t('common.error'), result.message || t('machine.deleteFailed'));
            }
        } catch (error) {
            Modal.alert(
                t('common.error'),
                error instanceof Error ? error.message : t('machine.deleteFailed')
            );
        } finally {
            setIsDeletingMachine(false);
        }
    };

    const handleRenameMachine = async () => {
        if (!machine || !machineId) return;

        const newDisplayName = await Modal.prompt(
            t('machine.renameTitle'),
            t('machine.renameMessage'),
            {
                defaultValue: machine.metadata?.displayName || '',
                placeholder: machine.metadata?.host || t('machine.renamePlaceholder'),
                cancelText: t('common.cancel'),
                confirmText: t('common.rename')
            }
        );

        if (newDisplayName === null) return;

        setIsRenamingMachine(true);
        try {
            await machineUpdateMetadata(
                machineId,
                { ...machine.metadata!, displayName: newDisplayName.trim() || undefined },
                machine.metadataVersion
            );
        } catch (error) {
            Modal.alert(
                t('common.error'),
                error instanceof Error ? error.message : t('machine.renameFailed')
            );
            await sync.refreshMachines();
        } finally {
            setIsRenamingMachine(false);
        }
    };

    if (!machine) {
        return (
            <>
                <Stack.Screen
                    options={{
                        headerShown: true,
                        headerTitle: '',
                        headerBackTitle: t('machine.back')
                    }}
                />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.groupped.background }}>
                    <Text style={[Typography.default(), { fontSize: 16, color: theme.colors.textSecondary }]}>
                        {t('machine.notFound')}
                    </Text>
                </View>
            </>
        );
    }

    const metadata = machine.metadata;
    const engineAvailable = isHarnessAvailable({
        availability: metadata?.cliAvailability,
        key: ENGINE_AGENT,
    });
    const machineName = metadata?.displayName || metadata?.host || t('machine.unnamed');

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: machineName,
                    headerRight: () => (
                        <Pressable
                            onPress={handleRenameMachine}
                            hitSlop={10}
                            style={{ opacity: isRenamingMachine ? 0.5 : 1 }}
                            disabled={isRenamingMachine}
                            accessibilityLabel={t('machine.renameTitle')}
                        >
                            <Octicons name="pencil" size={24} color={theme.colors.text} />
                        </Pressable>
                    ),
                    headerBackTitle: t('machine.back')
                }}
            />
            <ItemList
                containerStyle={{
                    paddingTop: Platform.OS === 'ios' ? MOBILE_GLASS_HEADER_HEIGHT : 0,
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                    />
                }
                keyboardShouldPersistTaps="handled"
            >
                <ItemGroup footer={machineIsOnline ? undefined : t('machine.offlineHint')}>
                    <SettingsRow
                        title={machineIsOnline ? t('machine.connected') : t('machine.offline')}
                        subtitle={machineIsOnline || !machine.activeAt
                            ? undefined
                            : t('status.lastSeen', { time: new Date(machine.activeAt).toLocaleString() })}
                        icon={machineIsOnline ? 'checkmark-circle-outline' : 'cloud-offline-outline'}
                        tone={machineIsOnline ? 'success' : 'neutral'}
                        showChevron={false}
                    />
                </ItemGroup>

                {/* Permission confirmation (DESK-17, PERM-08). Off means the agent works without
                    stopping to ask; on means risky steps wait for an answer on this page. */}
                <ItemGroup
                    title={t('machine.confirmationTitle')}
                    footer={confirmationError
                        ? t('machine.confirmationUnreported', { reason: confirmationError })
                        : machineIsOnline
                            ? t('machine.confirmationFooter')
                            : t('machine.confirmationFooterOffline')}
                >
                    <SettingsRow
                        title={t('machine.confirmationRow')}
                        subtitle={confirmationEnabled === null
                            ? t('machine.confirmationUnknown')
                            : confirmationEnabled
                                ? machineIsOnline ? t('machine.confirmationOn') : t('machine.confirmationOnLastSeen')
                                : machineIsOnline ? t('machine.confirmationOff') : t('machine.confirmationOffLastSeen')}
                        icon="shield-checkmark-outline"
                        value={confirmationEnabled === true}
                        onValueChange={(next) => { void handleConfirmationChange(next); }}
                        disabled={!machineIsOnline || isChangingConfirmation}
                        loading={isChangingConfirmation}
                    />
                </ItemGroup>

                <ItemGroup title={t('machine.recentAgents')}>
                    {previousSessions.map(session => (
                        <SettingsRow
                            key={session.id}
                            title={getSessionName(session)}
                            subtitle={getSessionSubtitle(session)}
                            onPress={() => navigateToSession(session.id)}
                        />
                    ))}
                    <SettingsRow
                        title={t('machine.newAgentHere')}
                        subtitle={machineIsOnline ? t('machine.newAgentHereSubtitle') : t('machine.newAgentOffline')}
                        icon="add-circle-outline"
                        tone={machineIsOnline ? 'accent' : 'neutral'}
                        onPress={machineIsOnline ? () => router.navigate('/new') : undefined}
                        disabled={!machineIsOnline}
                    />
                </ItemGroup>

                <ItemGroup>
                    <SettingsRow
                        title={t('machine.details')}
                        subtitle={detailsOpen ? undefined : t('machine.detailsHint')}
                        icon={detailsOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                        onPress={() => setDetailsOpen((open) => !open)}
                        showChevron={false}
                        showDivider={detailsOpen}
                    />
                    {detailsOpen && (
                        <>
                            <SettingsRow
                                title={t('machine.host')}
                                detail={metadata?.host || machineId}
                                showChevron={false}
                            />
                            {metadata?.platform && (
                                <SettingsRow
                                    title={t('machine.platform')}
                                    detail={metadata.platform}
                                    showChevron={false}
                                />
                            )}
                            {metadata?.cliAvailability && (
                                <>
                                    <SettingsRow
                                        title={t('machine.cliAvailability')}
                                        detail={engineAvailable ? t('machine.cliInstalled') : t('machine.cliNotFound')}
                                        showChevron={false}
                                    />
                                    <SettingsRow
                                        title={t('machine.lastDetected')}
                                        detail={new Date(metadata.cliAvailability.detectedAt).toLocaleString()}
                                        showChevron={false}
                                    />
                                </>
                            )}
                            {machine.daemonState?.pid != null && (
                                <SettingsRow
                                    title={t('machine.lastKnownPid')}
                                    detail={String(machine.daemonState.pid)}
                                    showChevron={false}
                                />
                            )}
                            {machine.daemonState?.httpPort != null && (
                                <SettingsRow
                                    title={t('machine.lastKnownHttpPort')}
                                    detail={String(machine.daemonState.httpPort)}
                                    showChevron={false}
                                />
                            )}
                            <SettingsRow
                                title={t('machine.daemonStateVersion')}
                                detail={String(machine.daemonStateVersion)}
                                showChevron={false}
                            />
                        </>
                    )}
                </ItemGroup>

                <ItemGroup footer={t('machine.deleteFooter')}>
                    <SettingsRow
                        title={t('machine.delete')}
                        icon="trash-outline"
                        tone="destructive"
                        onPress={handleDeleteMachine}
                        disabled={isDeletingMachine}
                        loading={isDeletingMachine}
                        showChevron={false}
                    />
                </ItemGroup>
            </ItemList>
        </>
    );
}
