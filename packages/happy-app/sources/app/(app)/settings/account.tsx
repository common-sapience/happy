import React, { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import * as Clipboard from 'expo-clipboard';
import { Typography } from '@/constants/Typography';
import { formatSecretKeyForBackup } from '@/auth/secretKeyBackup';
import { SettingsRow } from '@/components/kit';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { Modal } from '@/modal';
import { layout } from '@/components/layout';
import { useProfile } from '@/sync/storage';
import { sync } from '@/sync/sync';
import { useUnistyles } from 'react-native-unistyles';
import { getDisplayName } from '@/sync/profile';

/**
 * DESK-12: account information.
 *
 * Who you are signed in as, the key that is the account, and signing out. The platform API key is
 * not here and cannot be: it is entered on each computer and kept in that computer's credential
 * store (DESK-08, P-02), so this app has nothing of it to show.
 *
 * The four management boards of the account page are on the account page itself (D-16); this screen
 * is only the account's own details.
 */
export default React.memo(() => {
    const { theme } = useUnistyles();
    const auth = useAuth();
    const profile = useProfile();
    const [showSecret, setShowSecret] = useState(false);
    const [copiedRecently, setCopiedRecently] = useState(false);

    const currentSecret = auth.credentials?.secret || '';
    const formattedSecret = currentSecret ? formatSecretKeyForBackup(currentSecret) : '';
    const displayName = getDisplayName(profile);

    const handleCopySecret = async () => {
        try {
            await Clipboard.setStringAsync(formattedSecret);
            setCopiedRecently(true);
            setTimeout(() => setCopiedRecently(false), 2000);
        } catch {
            Modal.alert('Could not copy', 'Copying the recovery key to the clipboard failed.');
        }
    };

    const handleLogout = async () => {
        const confirmed = await Modal.confirm(
            'Sign out',
            'You will need your recovery key, or another computer already signed in, to get back into this account.',
            { confirmText: 'Sign out', destructive: true }
        );
        if (confirmed) {
            auth.logout();
        }
    };

    return (
        <ItemList>
            <ItemGroup title="Account">
                <SettingsRow
                    title="Signed in"
                    detail={auth.isAuthenticated ? 'Yes' : 'No'}
                    showChevron={false}
                />
                {displayName && (
                    <SettingsRow
                        title="Name"
                        detail={displayName}
                        showChevron={false}
                    />
                )}
                <SettingsRow
                    title="Account id"
                    detail={sync.serverID || 'Not available'}
                    copy={!!sync.serverID}
                    showChevron={false}
                />
                <SettingsRow
                    title="Platform API key"
                    subtitle="Entered on each computer and kept in that computer's credential store. This app never holds it."
                    subtitleLines={0}
                    showChevron={false}
                />
            </ItemGroup>

            <ItemGroup
                title="Recovery key"
                footer="This key is the account. Keep a copy somewhere safe: anyone who has it can read your agents, and without it a lost account cannot be recovered."
            >
                <SettingsRow
                    title={showSecret ? 'Hide the key' : 'Show the key'}
                    onPress={() => setShowSecret(!showSecret)}
                    showChevron={false}
                />
            </ItemGroup>

            {showSecret && (
                <ItemGroup>
                    <Pressable onPress={handleCopySecret}>
                        <View style={{
                            backgroundColor: Platform.select({ web: theme.colors.surface, default: 'transparent' }),
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            width: '100%',
                            maxWidth: layout.maxWidth,
                            alignSelf: 'center'
                        }}>
                            <Text style={{
                                fontSize: 11,
                                color: theme.colors.textSecondary,
                                letterSpacing: 0.5,
                                textTransform: 'uppercase',
                                marginBottom: 10,
                                ...Typography.default('semiBold')
                            }}>
                                {copiedRecently ? 'Copied' : 'Tap to copy'}
                            </Text>
                            <Text style={{
                                fontSize: 13,
                                letterSpacing: 0.5,
                                lineHeight: 20,
                                color: theme.colors.text,
                                ...Typography.mono()
                            }}>
                                {formattedSecret}
                            </Text>
                        </View>
                    </Pressable>
                </ItemGroup>
            )}

            <ItemGroup title="Signing out">
                <SettingsRow
                    title="Sign out"
                    subtitle="Removes this account from this app on this device"
                    tone="destructive"
                    onPress={handleLogout}
                    showChevron={false}
                />
            </ItemGroup>
        </ItemList>
    );
});
