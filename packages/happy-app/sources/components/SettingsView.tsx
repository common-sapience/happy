import { NativeScrollEvent, NativeSyntheticEvent, View, Platform } from 'react-native';
import * as React from 'react';
import { Text } from '@/components/StyledText';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
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
                        {displayName || 'Your account'}
                    </Text>
                </View>
            </View>

            {/* Account information (DESK-12). The platform API key is not held here: it is entered on
                each computer and kept in that computer's credential store (DESK-08, P-02). */}
            <ItemGroup title="Account">
                <Item
                    title="Signed in"
                    detail={auth.isAuthenticated ? 'Yes' : 'No'}
                    showChevron={false}
                />
                <Item
                    title="Account id"
                    detail={sync.serverID || 'Not available'}
                    copy={!!sync.serverID}
                    showChevron={false}
                />
                <Item
                    title="Platform API key"
                    subtitle="Entered on each computer and kept in that computer's credential store. This app never holds it."
                    showChevron={false}
                />
                <Item
                    title="Account details"
                    subtitle="Backup key and sign out"
                    onPress={() => router.push('/settings/account')}
                />
            </ItemGroup>

            <UsageSection />

            <ItemGroup title="Agents">
                <Item
                    title="Archived agents"
                    subtitle="Read their history, or bring one back"
                    detail={archivedAgents.length > 0 ? String(archivedAgents.length) : undefined}
                    onPress={() => router.push('/settings/archived')}
                />
            </ItemGroup>

            <ItemGroup
                title="Connectors"
                footer="A connector is set up on the computer that will use it, so its sign-in never passes through this app."
            >
                <Item
                    title="Connected services"
                    subtitle="Mail and other services your agents may use"
                    onPress={() => router.push('/settings/connectors')}
                />
            </ItemGroup>

            <ItemGroup
                title="Computers"
                footer="Open a computer to rename it, ask for confirmation before risky steps, or remove it."
            >
                {computers.length === 0 ? (
                    <Item
                        title="No computers yet"
                        subtitle="Add the computer you want your agents to work on"
                        showChevron={false}
                    />
                ) : computers.map((computer) => (
                    <Item
                        key={computer.machineId}
                        title={computer.name}
                        subtitle={computer.description}
                        onPress={() => router.push(`/machine/${computer.machineId}`)}
                    />
                ))}
                <Item
                    title="Add a computer"
                    subtitle="Approve a computer that asked to join this account"
                    onPress={() => router.push('/settings/add-computer')}
                />
            </ItemGroup>

            {/* Appearance carries the language choice, so the account page has one entry for both. */}
            <ItemGroup title="Preferences">
                <Item
                    title={t('settings.appearance')}
                    subtitle={t('settings.appearanceSubtitle')}
                    onPress={() => router.push('/settings/appearance')}
                />
            </ItemGroup>
        </ItemList>
    );
});
