import React, { useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, RefreshControl, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { Typography } from '@/constants/Typography';
import { useSessions, useAllMachines, useMachine } from '@/sync/storage';
import { Ionicons, Octicons } from '@expo/vector-icons';
import type { Session } from '@/sync/storageTypes';
import { machineStopDaemon, machineUpdateMetadata, machineDelete } from '@/sync/ops';
import { Modal } from '@/modal';
import { getSessionName, getSessionSubtitle } from '@/utils/sessionUtils';
import { isMachineOnline } from '@/utils/machineUtils';
import { sync } from '@/sync/sync';
import { useUnistyles } from 'react-native-unistyles';
import { t } from '@/text';
import { useNavigateToSession } from '@/hooks/useNavigateToSession';
import { MOBILE_GLASS_HEADER_HEIGHT } from '@/components/navigation/headerMetrics';
import { ENGINE_AGENT, getHarnessName, isHarnessAvailable } from '@/utils/harnessCatalog';
import { Switch } from '@/components/Switch';
import {
    machineGetPermissionConfirmation,
    machineSetPermissionConfirmation,
    readPublishedPermissionConfirmation,
} from '@/components/account/machinePermissionConfirmation';

export default function MachineDetailScreen() {
    const { theme } = useUnistyles();
    const { id: machineId } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const sessions = useSessions();
    const machine = useMachine(machineId!);
    const navigateToSession = useNavigateToSession();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isStoppingDaemon, setIsStoppingDaemon] = useState(false);
    const [isRenamingMachine, setIsRenamingMachine] = useState(false);
    const [isDeletingMachine, setIsDeletingMachine] = useState(false);

    const machineSessions = useMemo(() => {
        if (!sessions || !machineId) return [];

        return sessions.filter(item => {
            if (typeof item === 'string') return false;
            const session = item as Session;
            return session.metadata?.machineId === machineId;
        }) as Session[];
    }, [sessions, machineId]);

    const previousSessions = useMemo(() => {
        return [...machineSessions]
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, 5);
    }, [machineSessions]);

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
                setConfirmationError(error instanceof Error ? error.message : 'This computer did not answer.');
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
            setConfirmationError(error instanceof Error ? error.message : 'This computer did not answer.');
        } finally {
            setIsChangingConfirmation(false);
        }
    };

    const handleStopDaemon = async () => {
        // Show confirmation modal using alert with buttons
        Modal.alert(
            'Stop Daemon?',
            'You will not be able to spawn new sessions on this machine until you restart the daemon on your computer again. Your current sessions will stay alive.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Stop Daemon',
                    style: 'destructive',
                    onPress: async () => {
                        setIsStoppingDaemon(true);
                        try {
                            const result = await machineStopDaemon(machineId!);
                            Modal.alert('Daemon Stopped', result.message);
                            // Refresh to get updated metadata
                            await sync.refreshMachines();
                        } catch (error) {
                            Modal.alert(t('common.error'), 'Failed to stop daemon. It may not be running.');
                        } finally {
                            setIsStoppingDaemon(false);
                        }
                    }
                }
            ]
        );
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
            { cancelText: t('common.cancel'), confirmText: t('common.delete'), destructive: true }
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
            'Rename Machine',
            'Give this machine a custom name. Leave empty to use the default hostname.',
            {
                defaultValue: machine.metadata?.displayName || '',
                placeholder: machine.metadata?.host || 'Enter machine name',
                cancelText: t('common.cancel'),
                confirmText: t('common.rename')
            }
        );

        if (newDisplayName !== null) {
            setIsRenamingMachine(true);
            try {
                const updatedMetadata = {
                    ...machine.metadata!,
                    displayName: newDisplayName.trim() || undefined
                };
                
                await machineUpdateMetadata(
                    machineId,
                    updatedMetadata,
                    machine.metadataVersion
                );
                
                Modal.alert(t('common.success'), 'Machine renamed successfully');
            } catch (error) {
                Modal.alert(
                    'Error',
                    error instanceof Error ? error.message : 'Failed to rename machine'
                );
                // Refresh to get latest state
                await sync.refreshMachines();
            } finally {
                setIsRenamingMachine(false);
            }
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
                    <Text style={[Typography.default(), { fontSize: 16, color: '#666' }]}>
                        Machine not found
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
    const machineName = metadata?.displayName || metadata?.host || 'unknown machine';
    const machineOnline = machineIsOnline;

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
                            style={{
                                opacity: isRenamingMachine ? 0.5 : 1
                            }}
                            disabled={isRenamingMachine}
                        >
                            <Octicons
                                name="pencil"
                                size={24}
                                color={theme.colors.text}
                            />
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
                {/* Daemon */}
                <ItemGroup>
                        <Item
                            title={t('machine.status')}
                            detail={machineOnline ? t('status.online') : t('status.offline')}
                            detailStyle={{
                                color: machineOnline ? '#34C759' : theme.colors.textSecondary
                            }}
                            showChevron={false}
                        />
                        <Item
                            title={t('machine.stopDaemon')}
                            titleStyle={{
                                color: machineOnline ? '#FF9500' : theme.colors.textSecondary
                            }}
                            onPress={machineOnline ? handleStopDaemon : undefined}
                            disabled={isStoppingDaemon || !machineOnline}
                            rightElement={
                                isStoppingDaemon ? (
                                    <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                                ) : (
                                    <Ionicons 
                                        name="stop-circle" 
                                        size={20} 
                                        color={machineOnline ? '#FF9500' : theme.colors.textSecondary}
                                    />
                                )
                            }
                        />
                        {machine.daemonState && (
                            <>
                                {machine.daemonState.pid && (
                                    <Item
                                        title={t('machine.lastKnownPid')}
                                        subtitle={String(machine.daemonState.pid)}
                                        subtitleStyle={{ fontFamily: 'Menlo', fontSize: 13 }}
                                    />
                                )}
                                {machine.daemonState.httpPort && (
                                    <Item
                                        title={t('machine.lastKnownHttpPort')}
                                        subtitle={String(machine.daemonState.httpPort)}
                                        subtitleStyle={{ fontFamily: 'Menlo', fontSize: 13 }}
                                    />
                                )}
                                {machine.daemonState.startTime && (
                                    <Item
                                        title={t('machine.startedAt')}
                                        subtitle={new Date(machine.daemonState.startTime).toLocaleString()}
                                    />
                                )}
                                {machine.daemonState.startedWithCliVersion && (
                                    <Item
                                        title={t('machine.cliVersion')}
                                        subtitle={machine.daemonState.startedWithCliVersion}
                                        subtitleStyle={{ fontFamily: 'Menlo', fontSize: 13 }}
                                    />
                                )}
                            </>
                        )}
                        <Item
                            title={t('machine.daemonStateVersion')}
                            subtitle={String(machine.daemonStateVersion)}
                        />
                </ItemGroup>

                {/* Permission confirmation (DESK-17, PERM-08). Off means the agent works without
                    stopping to ask; on means risky steps wait for an answer on this page. */}
                <ItemGroup
                    title="Confirmation"
                    footer={confirmationError
                        ? `This computer did not report the setting: ${confirmationError}`
                        : machineOnline
                            ? 'While this is on, the agent stops and asks before deleting or overwriting your files, reaching outside the folders you allowed, sending anything out, paying, or installing software. While it is off, it works without asking. Reading sensitive files is refused either way.'
                            : 'Turn this computer on to change the setting.'}
                >
                    <Item
                        title="Ask before risky steps"
                        subtitle={confirmationEnabled === null
                            ? 'Not reported by this computer'
                            : confirmationEnabled
                                ? machineOnline ? 'On for this computer' : 'On when this computer was last seen'
                                : machineOnline ? 'Off for this computer' : 'Off when this computer was last seen'}
                        showChevron={false}
                        rightElement={isChangingConfirmation ? (
                            <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                        ) : (
                            <Switch
                                value={confirmationEnabled === true}
                                onValueChange={(next) => { void handleConfirmationChange(next); }}
                                disabled={!machineOnline || isChangingConfirmation}
                            />
                        )}
                    />
                </ItemGroup>

                {/* CLI Availability */}
                {metadata?.cliAvailability && (
                    <ItemGroup title={t('machine.cliAvailability')}>
                        <Item
                            title={getHarnessName(ENGINE_AGENT)}
                            showChevron={false}
                            rightElement={
                                <Text style={{ color: engineAvailable ? '#34C759' : theme.colors.textSecondary, fontSize: 14 }}>
                                    {engineAvailable ? t('machine.cliInstalled') : t('machine.cliNotFound')}
                                </Text>
                            }
                        />
                        <Item
                            title={t('machine.lastDetected')}
                            subtitle={new Date(metadata.cliAvailability.detectedAt).toLocaleString()}
                            showChevron={false}
                        />
                    </ItemGroup>
                )}

                {/* Recent sessions */}
                {previousSessions.length > 0 && (
                    <ItemGroup title={t('tabs.sessions')}>
                        {previousSessions.map(session => (
                            <Item
                                key={session.id}
                                title={getSessionName(session)}
                                subtitle={getSessionSubtitle(session)}
                                onPress={() => navigateToSession(session.id)}
                                rightElement={<Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
                            />
                        ))}
                    </ItemGroup>
                )}

                {/* Machine */}
                <ItemGroup title={t('machine.machineGroup')}>
                        <Item
                            title={t('machine.host')}
                            subtitle={metadata?.host || machineId}
                        />
                        <Item
                            title={t('machine.machineId')}
                            subtitle={machineId}
                            subtitleStyle={{ fontFamily: 'Menlo', fontSize: 12 }}
                        />
                        {metadata?.username && (
                            <Item
                                title={t('machine.username')}
                                subtitle={metadata.username}
                            />
                        )}
                        {metadata?.homeDir && (
                            <Item
                                title={t('machine.homeDirectory')}
                                subtitle={metadata.homeDir}
                                subtitleStyle={{ fontFamily: 'Menlo', fontSize: 13 }}
                            />
                        )}
                        {metadata?.platform && (
                            <Item
                                title={t('machine.platform')}
                                subtitle={metadata.platform}
                            />
                        )}
                        {metadata?.arch && (
                            <Item
                                title={t('machine.architecture')}
                                subtitle={metadata.arch}
                            />
                        )}
                        <Item
                            title={t('machine.lastSeen')}
                            subtitle={machine.activeAt ? new Date(machine.activeAt).toLocaleString() : t('machine.never')}
                        />
                        <Item
                            title={t('machine.metadataVersion')}
                            subtitle={String(machine.metadataVersion)}
                        />
                </ItemGroup>

                {/* Danger zone */}
                <ItemGroup title={t('machine.dangerZone')} footer={t('machine.deleteFooter')}>
                    <Item
                        title={t('machine.delete')}
                        titleStyle={{ color: '#FF3B30' }}
                        onPress={handleDeleteMachine}
                        disabled={isDeletingMachine}
                        showChevron={false}
                        rightElement={
                            isDeletingMachine ? (
                                <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                            ) : (
                                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                            )
                        }
                    />
                </ItemGroup>
            </ItemList>
        </>
    );
}
