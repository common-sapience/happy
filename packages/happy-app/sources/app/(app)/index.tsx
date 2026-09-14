import { RoundButton } from "@/components/RoundButton";
import { useAuth } from "@/auth/AuthContext";
import { Text, View, Image, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as React from 'react';
import { encodeBase64 } from "@/encryption/base64";
import { authGetToken } from "@/auth/authGetToken";
import { router, useRouter } from "expo-router";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { getRandomBytesAsync } from "expo-crypto";
import { useIsLandscape } from "@/utils/responsive";
import { Typography } from "@/constants/Typography";
import { HomeHeaderNotAuth } from "@/components/HomeHeader";
import { MainView } from "@/components/MainView";
import { RelayAddressEntry } from "@/components/RelayAddressEntry";
import { isRelayConfigured } from "@/sync/serverConfig";
import { PrimaryButton, SecondaryButton } from "@/components/kit";
import { resolveWelcomeActions, resolveWelcomePlatform, type WelcomeAction } from "@/auth/welcomeActions";
import { t } from '@/text';

export default function Home() {
    const auth = useAuth();
    if (!auth.isAuthenticated) {
        return <NotAuthenticated />;
    }
    return (
        <Authenticated />
    )
}

function Authenticated() {
    return <MainView variant="phone" />;
}

function NotAuthenticated() {
    const { theme } = useUnistyles();
    const auth = useAuth();
    const router = useRouter();
    const isLandscape = useIsLandscape();
    const insets = useSafeAreaInsets();
    const [relayConfigured, setRelayConfigured] = React.useState(isRelayConfigured);
    const [creatingAccount, setCreatingAccount] = React.useState(false);
    const platform = resolveWelcomePlatform(Platform.OS);
    const welcomeActions = resolveWelcomeActions(platform);

    const createAccount = async () => {
        if (creatingAccount) {
            return;
        }
        setCreatingAccount(true);
        try {
            const secret = await getRandomBytesAsync(32);
            const token = await authGetToken(secret);
            if (token && secret) {
                await auth.login(token, encodeBase64(secret, 'base64url'));
            }
        } catch (error) {
            console.error('Error creating account', error);
        } finally {
            setCreatingAccount(false);
        }
    }

    const runAction = (action: WelcomeAction) => {
        if (action.route === null) {
            void createAccount();
            return;
        }
        router.push(action.route);
    };

    // Phones keep the buttons they shipped with (MOB is deferred); the desktop
    // and web welcome is on the kit, where one filled button marks the only
    // primary action of the screen.
    const renderAction = (action: WelcomeAction, style: object) => {
        const isPrimary = action.emphasis === 'primary';
        const title = t(action.labelKey);
        if (platform === 'mobile') {
            return (
                <View key={action.id} style={style}>
                    <RoundButton
                        size={isPrimary ? 'large' : 'normal'}
                        title={title}
                        display={isPrimary ? 'default' : 'inverted'}
                        {...(action.route === null
                            ? { action: createAccount }
                            : { onPress: () => router.push(action.route!) })}
                    />
                </View>
            );
        }
        const Button = isPrimary ? PrimaryButton : SecondaryButton;
        return (
            <View key={action.id} style={style}>
                <Button
                    title={title}
                    onPress={() => runAction(action)}
                    loading={action.route === null && creatingAccount}
                    disabled={creatingAccount}
                />
            </View>
        );
    };

    const renderActions = (primaryStyle: object, secondaryStyle: object) =>
        welcomeActions.map((action) => renderAction(action, action.emphasis === 'primary' ? primaryStyle : secondaryStyle));

    const portraitLayout = (
        <View style={styles.portraitContainer}>
            <Image
                source={theme.dark ? require('@/assets/images/logotype-light.png') : require('@/assets/images/logotype-dark.png')}
                resizeMode="contain"
                style={styles.logo}
            />
            <Text style={styles.title}>
                {t('welcome.title')}
            </Text>
            <Text style={styles.subtitle}>
                {t('welcome.subtitle')}
            </Text>
            {renderActions(styles.buttonContainer, styles.buttonContainerSecondary)}
        </View>
    );

    const landscapeLayout = (
        <View style={[styles.landscapeContainer, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.landscapeInner}>
                <View style={styles.landscapeLogoSection}>
                    <Image
                        source={theme.dark ? require('@/assets/images/logotype-light.png') : require('@/assets/images/logotype-dark.png')}
                        resizeMode="contain"
                        style={styles.logo}
                    />
                </View>
                <View style={styles.landscapeContentSection}>
                    <Text style={styles.landscapeTitle}>
                        {t('welcome.title')}
                    </Text>
                    <Text style={styles.landscapeSubtitle}>
                        {t('welcome.subtitle')}
                    </Text>
                    {renderActions(styles.landscapeButtonContainer, styles.landscapeButtonContainerSecondary)}
                </View>
            </View>
        </View>
    );

    // No relay is built in, so an install that names none has nothing to log into
    // yet: the address comes first, and only then the account (DESK-08).
    const relayLayout = (
        <View style={styles.relayContainer}>
            <RelayAddressEntry
                variant="firstRun"
                onChanged={() => setRelayConfigured(isRelayConfigured())}
            />
        </View>
    );

    return (
        <>
            <HomeHeaderNotAuth />
            {!relayConfigured
                ? relayLayout
                : isLandscape ? landscapeLayout : portraitLayout}
        </>
    )
}

const styles = StyleSheet.create((theme) => ({
    // NotAuthenticated styles
    relayContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    portraitContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        width: 300,
        height: 90,
    },
    title: {
        marginTop: 16,
        textAlign: 'center',
        fontSize: 24,
        ...Typography.default('semiBold'),
        color: theme.colors.text,
    },
    subtitle: {
        ...Typography.default(),
        fontSize: 18,
        color: theme.colors.textSecondary,
        marginTop: 16,
        textAlign: 'center',
        marginHorizontal: 24,
        marginBottom: 64,
    },
    buttonContainer: {
        maxWidth: 280,
        width: '100%',
        marginBottom: 16,
    },
    buttonContainerSecondary: {
    },
    // Landscape styles
    landscapeContainer: {
        flexBasis: 0,
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 48,
    },
    landscapeInner: {
        flexGrow: 1,
        flexBasis: 0,
        maxWidth: 800,
        flexDirection: 'row',
    },
    landscapeLogoSection: {
        flexBasis: 0,
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingRight: 24,
    },
    landscapeContentSection: {
        flexBasis: 0,
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 24,
    },
    landscapeTitle: {
        textAlign: 'center',
        fontSize: 24,
        ...Typography.default('semiBold'),
        color: theme.colors.text,
    },
    landscapeSubtitle: {
        ...Typography.default(),
        fontSize: 18,
        color: theme.colors.textSecondary,
        marginTop: 16,
        textAlign: 'center',
        marginBottom: 32,
        paddingHorizontal: 16,
    },
    landscapeButtonContainer: {
        width: 280,
        marginBottom: 16,
    },
    landscapeButtonContainerSecondary: {
        width: 280,
    },
}));