import { NativeScrollEvent, NativeSyntheticEvent, View, ScrollView, Pressable, Platform } from 'react-native';
import { openExternalUrl } from '@/utils/openExternalUrl';
import { Image } from 'expo-image';
import * as React from 'react';
import { Text } from '@/components/StyledText';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '@/auth/AuthContext';
import { Typography } from "@/constants/Typography";
import { SettingsRow } from './kit';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { useConnectTerminal } from '@/hooks/useConnectTerminal';
import { useLocalSettingMutable, useSetting } from '@/sync/storage';
import { sync } from '@/sync/sync';
import { isUsingCustomServer } from '@/sync/serverConfig';
import { Modal } from '@/modal';
import { useMultiClick } from '@/hooks/useMultiClick';
import { useUnistyles } from 'react-native-unistyles';
import { layout } from '@/components/layout';
import { useHappyAction } from '@/hooks/useHappyAction';
import { useProfile } from '@/sync/storage';
import { getDisplayName, getAvatarUrl } from '@/sync/profile';
import { Avatar } from '@/components/Avatar';
import { t } from '@/text';

type BuildConfig = {
    buildCommitSha?: unknown;
    buildCommitTimestamp?: unknown;
};

function getBuildConfig(): BuildConfig {
    const appConfig = Constants.expoConfig?.extra?.app;
    return appConfig && typeof appConfig === 'object' ? appConfig as BuildConfig : {};
}

function formatUtcTimestamp(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toISOString()
        .replace(/\.\d{3}Z$/, 'Z')
        .replace(/:\d{2}Z$/, 'Z')
        .replace('T', ' ')
        .replace('Z', ' UTC');
}

function formatBuildSubtitle(buildConfig: BuildConfig): string | undefined {
    const commitTimestamp = typeof buildConfig.buildCommitTimestamp === 'string'
        ? formatUtcTimestamp(buildConfig.buildCommitTimestamp)
        : undefined;
    const commitSha = typeof buildConfig.buildCommitSha === 'string'
        ? buildConfig.buildCommitSha.slice(0, 7)
        : undefined;

    if (!commitTimestamp && !commitSha) {
        return undefined;
    }

    return [
        commitTimestamp ? `Commit ${commitTimestamp}` : 'Commit',
        commitSha,
    ].filter(Boolean).join(' / ');
}

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
    const appVersion = Constants.expoConfig?.version || '1.0.0';
    const runtimeVersion = typeof Constants.expoConfig?.runtimeVersion === 'string'
        ? Constants.expoConfig.runtimeVersion
        : undefined;
    const versionDetail = [
        appVersion,
        runtimeVersion ? `runtime ${runtimeVersion}` : undefined,
    ].filter(Boolean).join(' / ');
    const versionSubtitle = formatBuildSubtitle(getBuildConfig());
    const auth = useAuth();
    const [devModeEnabled, setDevModeEnabled] = useLocalSettingMutable('devModeEnabled');
    const experiments = useSetting('experiments');
    const isCustomServer = isUsingCustomServer();
    const profile = useProfile();
    const displayName = getDisplayName(profile);
    const avatarUrl = getAvatarUrl(profile);

    const { connectTerminal, connectWithUrl, isLoading } = useConnectTerminal();

    const handleGitHub = async () => {
        await openExternalUrl('https://github.com/slopus/happy');
    };

    const handleReportIssue = async () => {
        await openExternalUrl('https://github.com/slopus/happy/issues');
    };

    // Use the multi-click hook for version clicks
    const handleVersionClick = useMultiClick(() => {
        // Toggle dev mode
        const newDevMode = !devModeEnabled;
        setDevModeEnabled(newDevMode);
        Modal.alert(
            t('modals.developerMode'),
            newDevMode ? t('modals.developerModeEnabled') : t('modals.developerModeDisabled')
        );
    }, {
        requiredClicks: 10,
        resetTimeout: 2000
    });


    return (

        <ItemList
            style={{ paddingTop: 0 }}
            containerStyle={{ paddingTop: topContentInset, paddingBottom: bottomContentInset }}
            onScroll={onScroll}
            scrollEventThrottle={16}
        >
            {/* App Info Header */}
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
                }}>
                    {profile.firstName ? (
                        // Profile view: Avatar + name + version
                        <>
                            <View style={{ marginBottom: 12 }}>
                                <Avatar
                                    id={profile.id}
                                    size={90}
                                    imageUrl={avatarUrl}
                                    thumbhash={profile.avatar?.thumbhash}
                                />
                            </View>
                            <Text style={{ fontSize: 20, fontWeight: '600', color: theme.colors.text, marginBottom: 8 }}>
                                {displayName}
                            </Text>
                        </>
                    ) : (
                        // Logo view: Original logo + version
                        <>
                            <Image
                                source={theme.dark ? require('@/assets/images/logotype-light.png') : require('@/assets/images/logotype-dark.png')}
                                contentFit="contain"
                                style={{ width: 300, height: 90, marginBottom: 12 }}
                            />
                        </>
                    )}
                </View>
            </View>

            {/* Connect Terminal - Only show on native platforms */}
            {Platform.OS !== 'web' && (
                <ItemGroup>
                    <SettingsRow
                        title={t('settings.scanQrCodeToAuthenticate')}
                        icon="qr-code-outline"
                        tone="accent"
                        onPress={connectTerminal}
                        loading={isLoading}
                        showChevron={false}
                    />
                    <SettingsRow
                        title={t('connect.enterUrlManually')}
                        icon="link-outline"
                        tone="accent"
                        onPress={async () => {
                            const url = await Modal.prompt(
                                t('modals.authenticateTerminal'),
                                t('modals.pasteUrlFromTerminal'),
                                {
                                    placeholder: 'happy://terminal?...',
                                    confirmText: t('common.authenticate')
                                }
                            );
                            if (url?.trim()) {
                                connectWithUrl(url.trim());
                            }
                        }}
                        showChevron={false}
                    />
                </ItemGroup>
            )}

            {/* Features */}
            <ItemGroup title={t('settings.features')}>
                <SettingsRow
                    title={t('settings.account')}
                    subtitle={t('settings.accountSubtitle')}
                    icon="person-circle-outline"
                    tone="accent"
                    onPress={() => router.push('/settings/account')}
                />
                <SettingsRow
                    title={t('settings.appearance')}
                    subtitle={t('settings.appearanceSubtitle')}
                    icon="color-palette-outline"
                    tone="accent"
                    onPress={() => router.push('/settings/appearance')}
                />
            </ItemGroup>

            {/* Developer */}
            {/* About */}
            <ItemGroup title={t('settings.about')} footer={t('settings.aboutFooter')}>
                <SettingsRow
                    title={t('settings.whatsNew')}
                    subtitle={t('settings.whatsNewSubtitle')}
                    icon="sparkles-outline"
                    tone="warning"
                    onPress={() => {
                        router.push('/changelog');
                    }}
                />
                <SettingsRow
                    title={t('settings.github')}
                    detail="slopus/happy"
                    icon="logo-github"
                    onPress={handleGitHub}
                />
                <SettingsRow
                    title={t('settings.reportIssue')}
                    icon="bug-outline"
                    onPress={handleReportIssue}
                />
                <SettingsRow
                    title={t('settings.privacyPolicy')}
                    icon="shield-checkmark-outline"
                    tone="accent"
                    onPress={() => openExternalUrl('https://happy.engineering/privacy/')}
                />
                <SettingsRow
                    title={t('settings.termsOfService')}
                    icon="document-text-outline"
                    tone="accent"
                    onPress={() => openExternalUrl('https://github.com/slopus/happy/blob/main/TERMS.md')}
                />
                {Platform.OS === 'ios' && (
                    <SettingsRow
                        title={t('settings.eula')}
                        icon="document-text-outline"
                        tone="accent"
                        onPress={() => openExternalUrl('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
                    />
                )}
                <SettingsRow
                    title={t('common.version')}
                    subtitle={versionSubtitle}
                    subtitleLines={2}
                    detail={versionDetail}
                    icon="information-circle-outline"
                    onPress={handleVersionClick}
                    showChevron={false}
                />
            </ItemGroup>

        </ItemList>
    );
});
