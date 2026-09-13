import * as React from 'react';
import { Platform, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { ItemGroup } from '@/components/ItemGroup';
import { PrimaryButton, SecondaryButton, SettingsRow, Sheet } from '@/components/kit';
import { Text } from '@/components/StyledText';
import { Typography } from '@/constants/Typography';
import { Modal } from '@/modal';
import { useAllMachines } from '@/sync/storage';
import {
    platformGatewayShellPresent,
    readPlatformGateway,
    savePlatformGatewayField,
} from '@/sync/platformCredentialsShell';
import { t } from '@/text';
import {
    PLATFORM_GATEWAY_FIELDS,
    checkPlatformGatewayEntry,
    readPublishedPlatformGateway,
    resolvePlatformGatewayRows,
    type PlatformGatewayField,
    type PlatformGatewayFieldState,
    type PlatformGatewayState,
} from './platformGateway';

/**
 * DESK-12: the model gateway board of the account page.
 *
 * An agent reaches a model only when its computer holds the gateway address, the platform API key
 * and the model id, so this is where all three are entered — one row each, one field at a time.
 *
 * The values go to the computer and stay there. This app hands each one to the desktop shell, which
 * gives it to the daemon on standard input; nothing is kept here, and the only thing read back is
 * whether a field is set. That is also why the rows are read-only in a browser: a web control end
 * has no shell, and the computer's daemon is the only holder.
 */

const FIELD_TITLE: Record<PlatformGatewayField, () => string> = {
    apiKey: () => t('modelGateway.apiKey'),
    baseUrl: () => t('modelGateway.baseUrl'),
    modelId: () => t('modelGateway.modelId'),
};

const FIELD_HINT: Record<PlatformGatewayField, () => string> = {
    apiKey: () => t('modelGateway.apiKeyHint'),
    baseUrl: () => t('modelGateway.baseUrlHint'),
    modelId: () => t('modelGateway.modelIdHint'),
};

const FIELD_PLACEHOLDER: Record<PlatformGatewayField, () => string> = {
    apiKey: () => t('modelGateway.apiKeyPlaceholder'),
    baseUrl: () => t('modelGateway.baseUrlPlaceholder'),
    modelId: () => t('modelGateway.modelIdPlaceholder'),
};

const STATE_DETAIL: Record<PlatformGatewayFieldState, () => string> = {
    set: () => t('modelGateway.set'),
    unset: () => t('modelGateway.notSet'),
    unknown: () => t('modelGateway.unknown'),
};

export const PlatformGatewaySection = React.memo(function PlatformGatewaySection() {
    const machines = useAllMachines({ includeOffline: true });
    const editable = React.useMemo(() => platformGatewayShellPresent(), []);
    const [reported, setReported] = React.useState<PlatformGatewayState | null>(null);
    const [machineId, setMachineId] = React.useState<string | null>(null);

    const remember = React.useCallback((report: { set: PlatformGatewayState; machineId: string | null }) => {
        setReported(report.set);
        setMachineId(report.machineId);
    }, []);

    React.useEffect(() => {
        if (!editable) {
            return;
        }
        let cancelled = false;
        readPlatformGateway()
            .then((report) => {
                if (report && !cancelled) {
                    remember(report);
                }
            })
            .catch(() => {
                // A computer that will not answer leaves the rows reading "unknown", which is the
                // honest answer: claiming nothing is configured would invite overwriting a live key.
            });
        return () => { cancelled = true; };
    }, [editable, remember]);

    const published = React.useMemo(() => {
        const machine = machineId ? machines.find((candidate) => candidate.id === machineId) : undefined;
        return readPublishedPlatformGateway(machine?.metadata);
    }, [machines, machineId]);

    const rows = resolvePlatformGatewayRows({ reported, published });

    const edit = React.useCallback((field: PlatformGatewayField) => {
        Modal.show({
            component: PlatformGatewaySheet,
            props: { field, onSaved: remember },
        });
    }, [remember]);

    return (
        <ItemGroup
            title={t('modelGateway.title')}
            footer={editable ? t('modelGateway.footer') : t('modelGateway.footerReadOnly')}
        >
            {PLATFORM_GATEWAY_FIELDS.map((field) => (
                <SettingsRow
                    key={field}
                    title={FIELD_TITLE[field]()}
                    subtitle={FIELD_HINT[field]()}
                    detail={STATE_DETAIL[rows[field]]()}
                    onPress={editable ? () => edit(field) : undefined}
                    showChevron={editable}
                />
            ))}
        </ItemGroup>
    );
});

const stylesheet = StyleSheet.create((theme) => ({
    input: {
        backgroundColor: Platform.select({
            web: theme.colors.input.background,
            default: theme.colors.glass.backgroundSubtle,
        }),
        padding: theme.margins.md,
        borderRadius: theme.borderRadius.md,
        ...Typography.mono(),
        fontSize: 14,
        color: theme.colors.input.text,
    },
    error: {
        ...Typography.default(),
        fontSize: 12,
        color: theme.colors.textDestructive,
        marginTop: theme.margins.sm,
    },
}));

const PlatformGatewaySheet = React.memo(function PlatformGatewaySheet({
    field,
    onSaved,
    onClose,
}: {
    field: PlatformGatewayField;
    onSaved: (report: { set: PlatformGatewayState; machineId: string | null }) => void;
    onClose: () => void;
}) {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const [value, setValue] = React.useState('');
    const [problem, setProblem] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);

    const save = React.useCallback(async () => {
        const checked = checkPlatformGatewayEntry(field, value);
        if (!checked.ok) {
            setProblem(checked.reason === 'empty' ? t('modelGateway.empty') : t('modelGateway.notOneLine'));
            return;
        }
        setSaving(true);
        setProblem(null);
        try {
            onSaved(await savePlatformGatewayField(field, checked.value));
            onClose();
        } catch {
            // The computer's own refusal is the authoritative one, and it does not travel as text a
            // user should read; what matters here is that nothing was stored.
            setProblem(t('modelGateway.saveFailed'));
        } finally {
            setSaving(false);
        }
    }, [field, value, onSaved, onClose]);

    return (
        <Sheet
            title={FIELD_TITLE[field]()}
            message={FIELD_HINT[field]()}
            actions={(
                <>
                    <PrimaryButton title={t('modelGateway.save')} onPress={save} loading={saving} />
                    <SecondaryButton title={t('common.cancel')} onPress={onClose} disabled={saving} />
                </>
            )}
        >
            <View>
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={(next) => { setValue(next); setProblem(null); }}
                    placeholder={FIELD_PLACEHOLDER[field]()}
                    placeholderTextColor={theme.colors.input.placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={field === 'apiKey'}
                    editable={!saving}
                    onSubmitEditing={save}
                    accessibilityLabel={FIELD_TITLE[field]()}
                />
                {problem ? <Text style={styles.error}>{problem}</Text> : null}
            </View>
        </Sheet>
    );
});
