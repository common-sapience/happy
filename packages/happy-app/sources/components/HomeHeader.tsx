import * as React from 'react';
import { Header } from './navigation/Header';
import { useSocketStatus } from '@/sync/storage';
import { Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { getRelayLabel } from '@/sync/serverConfig';
import { Image } from 'expo-image';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { t } from '@/text';
import { ShortcutHintBadge, useShortcutHints } from './ShortcutHints';
import { shouldShowHomeConnectionStatus, type HomeSocketStatus } from './homeConnectionStatus';

const HEADER_LOGO_SIZE = 19;

const stylesheet = StyleSheet.create((theme) => ({
    headerButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerButtonShortcutActive: {
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.surfaceSelected,
    },
    headerShortcutBadge: {
        position: 'absolute',
        top: -8,
        right: -12,
    },
    logoContainer: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        tintColor: theme.colors.header.tint,
    },
}));

/**
 * The secondary line of the agent list's bar. A healthy socket says nothing: the
 * line is there to report a problem, and the relay address owns it outright.
 */
function useHomeHeaderSubtitle(customSubtitle?: string): string | undefined {
    const socketStatus = useSocketStatus();
    if (customSubtitle) {
        return customSubtitle;
    }
    if (!shouldShowHomeConnectionStatus(socketStatus.status as HomeSocketStatus)) {
        return undefined;
    }
    switch (socketStatus.status) {
        case 'connecting':
            return t('status.connecting');
        case 'disconnected':
            return t('status.disconnected');
        case 'error':
            return t('status.error');
        default:
            return undefined;
    }
}

export const HomeHeader = React.memo(() => {
    const { theme } = useUnistyles();
    const subtitle = useHomeHeaderSubtitle();
    const header = (
        <Header
            title={t('sidebar.agentsTitle')}
            subtitle={subtitle}
            headerRight={() => <HeaderRight />}
            headerLeft={() => <HeaderLeft />}
            headerLeftGlass={Platform.OS !== 'web'}
            headerShadowVisible={false}
            headerTransparent={true}
            mobileTitleSurface="plain"
            mobileTitleAlignment="center"
        />
    );

    return Platform.OS === 'web'
        ? <View style={{ backgroundColor: theme.colors.groupped.background }}>{header}</View>
        : header;
});

export const HomeHeaderNotAuth = React.memo(() => {
    useSegments(); // Re-rendered automatically when screen navigates back
    const { theme } = useUnistyles();
    const subtitle = useHomeHeaderSubtitle(getRelayLabel() ?? undefined);
    return (
        <Header
            title={t('sidebar.agentsTitle')}
            subtitle={subtitle}
            headerRight={() => <HeaderRightNotAuth />}
            headerLeft={() => <HeaderLeft />}
            headerLeftGlass={Platform.OS !== 'web'}
            headerShadowVisible={false}
            headerBackgroundColor={theme.colors.groupped.background}
            mobileTitleSurface="plain"
            mobileTitleAlignment="center"
        />
    );
});

function HeaderRight() {
    const router = useRouter();
    const styles = stylesheet;
    const { theme } = useUnistyles();
    const { visible: shortcutHintsVisible } = useShortcutHints();

    return (
        <Pressable
            onPress={() => router.navigate('/new')}
            hitSlop={15}
            accessibilityLabel={t('sidebar.newAgent')}
            accessibilityRole="button"
            style={[
                styles.headerButton,
                shortcutHintsVisible && styles.headerButtonShortcutActive,
            ]}
        >
            <Ionicons name="add-outline" size={28} color={theme.colors.header.tint} />
            <ShortcutHintBadge shortcutKey="N" style={styles.headerShortcutBadge} />
        </Pressable>
    );
}

function HeaderRightNotAuth() {
    const router = useRouter();
    const { theme } = useUnistyles();
    const styles = stylesheet;

    return (
        <Pressable
            onPress={() => router.push('/server')}
            hitSlop={15}
            style={styles.headerButton}
        >
            <Ionicons name="server-outline" size={24} color={theme.colors.header.tint} />
        </Pressable>
    );
}

function HeaderLeft() {
    const styles = stylesheet;
    const { theme } = useUnistyles();
    return (
        <View style={styles.logoContainer}>
            <Image
                source={require('@/assets/images/logo-black.png')}
                contentFit="contain"
                style={{ width: HEADER_LOGO_SIZE, height: HEADER_LOGO_SIZE }}
                tintColor={theme.colors.header.tint}
            />
        </View>
    );
}
