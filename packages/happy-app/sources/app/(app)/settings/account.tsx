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
import { t } from '@/text';

/**
 * DESK-12: account information.
 *
 * Who you are signed in as, the key that is the account, and signing out.
 *
 * The model gateway and the four management boards are on the account page itself (D-16); this
 * screen is only the account's own details.
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
            Modal.alert(t('accountPage.copyFailedTitle'), t('accountPage.copyFailedMessage'));
        }
    };

    const handleLogout = async () => {
        const confirmed = await Modal.confirm(
            t('accountPage.signOut'),
            t('accountPage.signOutConfirm'),
            { confirmText: t('accountPage.signOut'), destructive: true }
        );
        if (confirmed) {
            auth.logout();
        }
    };

    return (
        <ItemList>
            <ItemGroup title={t('accountPage.account')}>
                <SettingsRow
                    title={t('accountPage.signedIn')}
                    detail={auth.isAuthenticated ? t('common.yes') : t('common.no')}
                    showChevron={false}
                />
                {displayName && (
                    <SettingsRow
                        title={t('settingsAccount.name')}
                        detail={displayName}
                        showChevron={false}
                    />
                )}
                <SettingsRow
                    title={t('accountPage.accountId')}
                    detail={sync.serverID || t('settingsAccount.notAvailable')}
                    copy={!!sync.serverID}
                    showChevron={false}
                />
            </ItemGroup>

            <ItemGroup
                title={t('accountPage.recoveryKey')}
                footer={t('accountPage.recoveryKeyFooter')}
            >
                <SettingsRow
                    title={showSecret ? t('accountPage.hideKey') : t('accountPage.showKey')}
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
                                {copiedRecently ? t('common.copied') : t('accountPage.tapToCopy')}
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

            <ItemGroup title={t('accountPage.signingOut')}>
                <SettingsRow
                    title={t('accountPage.signOut')}
                    subtitle={t('accountPage.signOutHint')}
                    tone="destructive"
                    onPress={handleLogout}
                    showChevron={false}
                />
            </ItemGroup>
        </ItemList>
    );
});
