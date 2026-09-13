import * as React from 'react';
import { Platform, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from '@/components/StyledText';
import { RoundButton } from '@/components/RoundButton';
import { layout } from '@/components/layout';
import { Typography } from '@/constants/Typography';
import { Modal } from '@/modal';
import { t } from '@/text';
import { checkRelayAddress, type RelayAddressProblem } from '@/sync/relayEndpoint';
import { getRelayEndpoint, setServerUrl } from '@/sync/serverConfig';

/**
 * The one place a relay address is entered. There is no built-in relay, so this
 * is also the first screen of a fresh install (DESK-08): nothing reaches a
 * network until the operator names the server they run.
 */
export type RelayAddressEntryProps = {
    variant: 'firstRun' | 'settings';
    onChanged?: () => void;
};

const PROBLEM_TEXT: Record<RelayAddressProblem, () => string> = {
    empty: () => t('relay.addressEmpty'),
    protocol: () => t('relay.addressProtocol'),
    format: () => t('relay.addressFormat'),
};

const stylesheet = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        width: '100%',
        maxWidth: layout.maxWidth,
        alignSelf: 'center',
    },
    heading: {
        ...Typography.default('semiBold'),
        fontSize: 24,
        color: theme.colors.text,
        marginBottom: 8,
    },
    body: {
        ...Typography.default(),
        fontSize: 15,
        color: theme.colors.textSecondary,
        marginBottom: 24,
    },
    label: {
        ...Typography.default('semiBold'),
        fontSize: 12,
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    input: {
        backgroundColor: Platform.select({ web: theme.colors.input.background, default: theme.colors.glass.backgroundSubtle }),
        padding: 12,
        borderRadius: theme.borderRadius.md,
        marginBottom: 8,
        ...Typography.mono(),
        fontSize: 14,
        color: theme.colors.input.text,
    },
    inputBusy: {
        opacity: 0.6,
    },
    error: {
        ...Typography.default(),
        fontSize: 12,
        color: theme.colors.textDestructive,
        marginBottom: 12,
    },
    checking: {
        ...Typography.default(),
        fontSize: 12,
        color: theme.colors.status.connecting,
        marginBottom: 12,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    action: {
        flex: 1,
    },
    current: {
        ...Typography.default(),
        fontSize: 12,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
}));

export const RelayAddressEntry = React.memo(({ variant, onChanged }: RelayAddressEntryProps) => {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const endpoint = getRelayEndpoint();
    const [address, setAddress] = React.useState(endpoint.configured ? endpoint.url : '');
    const [configuredUrl, setConfiguredUrl] = React.useState(endpoint.configured ? endpoint.url : null);
    const [error, setError] = React.useState<string | null>(null);
    const [isChecking, setIsChecking] = React.useState(false);

    const reachesRelay = async (url: string): Promise<boolean> => {
        try {
            setIsChecking(true);
            setError(null);
            const response = await fetch(url, { method: 'GET', headers: { Accept: 'text/plain' } });
            if (!response.ok) {
                setError(t('relay.returnedError'));
                return false;
            }
            const text = await response.text();
            if (!text.includes('Welcome to Happy Server!')) {
                setError(t('relay.notARelay'));
                return false;
            }
            return true;
        } catch {
            setError(t('relay.unreachable'));
            return false;
        } finally {
            setIsChecking(false);
        }
    };

    const save = async () => {
        const checked = checkRelayAddress(address);
        if (!checked.valid) {
            setError(PROBLEM_TEXT[checked.problem]());
            return;
        }
        if (!await reachesRelay(checked.url)) {
            return;
        }
        if (configuredUrl && configuredUrl !== checked.url) {
            const confirmed = await Modal.confirm(
                t('relay.changeTitle'),
                t('relay.changeBody'),
                { confirmText: t('common.continue'), destructive: true },
            );
            if (!confirmed) {
                return;
            }
        }
        setServerUrl(checked.url);
        setAddress(checked.url);
        setConfiguredUrl(checked.url);
        onChanged?.();
    };

    const forget = async () => {
        const confirmed = await Modal.confirm(
            t('relay.forgetTitle'),
            t('relay.forgetBody'),
            { confirmText: t('relay.forget'), destructive: true },
        );
        if (!confirmed) {
            return;
        }
        setServerUrl(null);
        setAddress('');
        setConfiguredUrl(null);
        setError(null);
        onChanged?.();
    };

    return (
        <View style={styles.container}>
            {variant === 'firstRun' && (
                <>
                    <Text style={styles.heading}>{t('relay.firstRunTitle')}</Text>
                    <Text style={styles.body}>{t('relay.firstRunBody')}</Text>
                </>
            )}
            <Text style={styles.label}>{t('relay.addressLabel').toUpperCase()}</Text>
            <TextInput
                style={[styles.input, isChecking && styles.inputBusy]}
                value={address}
                onChangeText={(text) => {
                    setAddress(text);
                    setError(null);
                }}
                placeholder={t('relay.addressPlaceholder')}
                placeholderTextColor={theme.colors.input.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!isChecking}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            {isChecking && <Text style={styles.checking}>{t('relay.checking')}</Text>}
            <View style={styles.actions}>
                {configuredUrl && (
                    <View style={styles.action}>
                        <RoundButton
                            title={t('relay.forget')}
                            size="normal"
                            display="inverted"
                            onPress={forget}
                        />
                    </View>
                )}
                <View style={styles.action}>
                    <RoundButton
                        title={isChecking ? t('relay.checkingShort') : t('common.save')}
                        size="normal"
                        action={save}
                        disabled={isChecking}
                    />
                </View>
            </View>
            {configuredUrl && (
                <Text style={styles.current}>{t('relay.current')}</Text>
            )}
        </View>
    );
});
