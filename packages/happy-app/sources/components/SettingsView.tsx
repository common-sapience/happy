import { NativeScrollEvent, NativeSyntheticEvent, View, Platform } from 'react-native';
import * as React from 'react';
import { Text } from '@/components/StyledText';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { ItemGroup } from '@/components/ItemGroup';
import { SettingsRow } from '@/components/kit';
import { ItemList } from '@/components/ItemList';
import { useAllMachines, useAllSessions } from '@/sync/storage';
import { sync } from '@/sync/sync';
import { useUnistyles } from 'react-native-unistyles';
import { layout } from '@/components/layout';
import { useProfile } from '@/sync/storage';
import { getDisplayName, getAvatarUrl } from '@/sync/profile';
import { Avatar } from '@/components/Avatar';
import { UsageSection } from '@/components/usage/UsageSection';
import { buildArchivedAgentRows } from '@/components/account/archivedAgents';
import { buildConnectedComputerRows } from '@/components/account/connectedComputers';
import { t } from '@/text';

/**
 * The account page (D-16, DESK-12): who you are signed in as, and four boards behind it — usage
 * (DESK-13), archived agents (DESK-14), connectors (DESK-15) and connected computers (DESK-16).
 *
 * Nothing else belongs here. Everything the product does not ship was removed rather than tucked
 * into an advanced section, and appearance and language stay only as plain preferences.
 */
export const SettingsView = React.memo(function SettingsView({
    topContentInset = 0,
    bottomContentInset = 0,
    onScroll,
}: {
    topContentInset?: number;
    bottomContentInset?: number;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
    const { theme } = useUnistyles();
    const router = useRouter();
    const auth = useAuth();
    const profile = useProfile();
    const displayName = getDisplayName(profile);
    const avatarUrl = getAvatarUrl(profile);

    const sessions = useAllSessions();
    const machines = useAllMachines({ includeOffline: true });
    const archivedAgents = React.useMemo(
        () => buildArchivedAgentRows(sessions, machines),
        [sessions, machines],
    );
    const computers = React.useMemo(
        () => buildConnectedComputerRows(machines),
        [machines],
    );

    return (
        <ItemList
            style={{ paddingTop: 0 }}
            containerStyle={{ paddingTop: topContentInset, paddingBottom: bottomContentInset }}
            onScroll={onScroll}
            scrollEventThrottle={16}
        >
            <View style={{ maxWidth: layout.maxWidth, alignSelf: 'center', width: '100%' }}>
                <View
                    style={{
                        alignItems: 'center',
                        paddingVertical: 24,
                        backgroundColor: theme.colors.surface,
                        marginTop: 16,
                        borderRadius: Platform.select({ web: 12, default: 16 }),
                        marginHorizontal: 16,
                        borderWidth: Platform.OS === 'web' ? 0 : 0.5,
                        borderColor: theme.colors.divider,
                    }}
                >
                    <View style={{ marginBottom: 12 }}>
                        <Avatar
                            id={profile.id}
                            size={90}
                            imageUrl={avatarUrl}
                            thumbhash={profile.avatar?.thumbhash}
                        />
                    </View>
                    <Text style={{ fontSize: 20, fontWeight: '600', color: theme.colors.text }}>
                        {displayName || t('accountPage.yourAccount')}
                    </Text>
                </View>
            </View>

            {/* Account information (DESK-12). The platform API key is not held here: it is entered on
                each computer and kept in that computer's credential store (DESK-08, P-02). */}
            <ItemGroup title={t('accountPage.account')}>
                <SettingsRow
                    title={t('accountPage.signedIn')}
                    detail={auth.isAuthenticated ? t('common.yes') : t('common.no')}
                    showChevron={false}
                />
                <SettingsRow
                    title={t('accountPage.accountId')}
                    detail={sync.serverID || t('settingsAccount.notAvailable')}
                    copy={!!sync.serverID}
                    showChevron={false}
                />
                <SettingsRow
                    title={t('accountPage.platformKey')}
                    subtitle={t('accountPage.platformKeyHint')}
                    showChevron={false}
                />
                <SettingsRow
                    title={t('accountPage.details')}
                    subtitle={t('accountPage.detailsHint')}
                    onPress={() => router.push('/settings/account')}
                />
            </ItemGroup>

            <UsageSection />

            <ItemGroup title={t('sidebar.agentsTitle')}>
                <SettingsRow
                    title={t('accountPage.archived')}
                    subtitle={t('accountPage.archivedHint')}
                    detail={archivedAgents.length > 0 ? String(archivedAgents.length) : undefined}
                    onPress={() => router.push('/settings/archived')}
                />
            </ItemGroup>

            <ItemGroup
                title={t('accountPage.connectors')}
                footer={t('accountPage.connectorsFooter')}
            >
                <SettingsRow
                    title={t('accountPage.connectedServices')}
                    subtitle={t('accountPage.connectedServicesHint')}
                    onPress={() => router.push('/settings/connectors')}
                />
            </ItemGroup>

            <ItemGroup
                title={t('accountPage.computers')}
                footer={t('accountPage.computersFooter')}
            >
                {computers.length === 0 ? (
                    <SettingsRow
                        title={t('accountPage.noComputers')}
                        subtitle={t('accountPage.noComputersHint')}
                        showChevron={false}
                    />
                ) : computers.map((computer) => (
                    <SettingsRow
                        key={computer.machineId}
                        title={computer.name}
                        subtitle={[
                            computer.platform,
                            computer.online ? t('accountPage.computerOn') : t('accountPage.computerOff'),
                        ].filter(Boolean).join(' · ')}
                        onPress={() => router.push(`/machine/${computer.machineId}`)}
                    />
                ))}
                <SettingsRow
                    title={t('accountPage.addComputer')}
                    subtitle={t('accountPage.addComputerHint')}
                    onPress={() => router.push('/settings/add-computer')}
                />
            </ItemGroup>

            {/* Appearance carries the language choice, so the account page has one entry for both. */}
            <ItemGroup title={t('accountPage.preferences')}>
                <SettingsRow
                    title={t('settings.appearance')}
                    subtitle={t('settings.appearanceSubtitle')}
                    onPress={() => router.push('/settings/appearance')}
                />
            </ItemGroup>
        </ItemList>
    );
});
