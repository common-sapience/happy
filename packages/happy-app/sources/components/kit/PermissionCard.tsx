import * as React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { resolveConcentricRadius } from '../glassWebMaterial';
import { KitSurface } from './KitSurface';
import { DestructiveButton, PrimaryButton, SecondaryButton } from './Buttons';

const stylesheet = StyleSheet.create((theme) => ({
    card: {
        overflow: 'hidden',
        padding: theme.margins.lg,
        gap: theme.margins.md,
    },
    category: {
        ...Typography.default('semiBold'),
        color: theme.colors.text,
        fontSize: theme.typography.subtitle.fontSize,
        lineHeight: theme.typography.subtitle.lineHeight,
    },
    target: {
        ...Typography.mono(),
        color: theme.colors.textSecondary,
        fontSize: theme.typography.mono.fontSize,
        lineHeight: theme.typography.mono.lineHeight,
    },
    scope: {
        ...Typography.default('regular'),
        color: theme.colors.textSecondary,
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
    },
    raw: {
        ...Typography.mono(),
        color: theme.colors.textSecondary,
        fontSize: theme.typography.mono.fontSize,
        lineHeight: theme.typography.mono.lineHeight,
        padding: theme.margins.md,
        backgroundColor: theme.colors.surfaceHigh,
    },
    answers: {
        gap: theme.margins.sm,
    },
}));

export type PermissionCardProps = {
    /** What the agent wants to do, in the user's words — never a tool name. */
    category: string;
    target: string;
    scope: string;
    /** The raw tool and arguments, for an action no template covers. */
    raw?: string;
    allowOnceLabel: string;
    allowAlwaysLabel: string;
    denyLabel: string;
    onAllowOnce: () => void;
    onAllowAlways: () => void;
    onDeny: () => void;
    style?: StyleProp<ViewStyle>;
};

/**
 * A control-bearing card, so it takes glass, and it sits in the transcript at the
 * point the agent stopped rather than over it. Allowing once is the one filled
 * action; always-allow and deny stay text so neither is the easy accident.
 */
export const PermissionCard = React.memo(function PermissionCard({
    category,
    target,
    scope,
    raw,
    allowOnceLabel,
    allowAlwaysLabel,
    denyLabel,
    onAllowOnce,
    onAllowAlways,
    onDeny,
    style,
}: PermissionCardProps) {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const radius = theme.borderRadius.xxl;

    return (
        <KitSurface
            surface="floating"
            accessibilityLabel={`${category} ${target} ${scope}`}
            style={[styles.card, { borderRadius: radius }, style]}
        >
            <View>
                <Text style={styles.category}>{category}</Text>
                <Text style={styles.target}>{target}</Text>
            </View>
            <Text style={styles.scope}>{scope}</Text>
            {raw ? (
                <Text style={[styles.raw, { borderRadius: resolveConcentricRadius(radius, theme.margins.lg) }]}>
                    {raw}
                </Text>
            ) : null}
            <View style={styles.answers}>
                <PrimaryButton title={allowOnceLabel} onPress={onAllowOnce} size="compact" />
                <SecondaryButton title={allowAlwaysLabel} onPress={onAllowAlways} size="compact" />
                <DestructiveButton title={denyLabel} onPress={onDeny} size="compact" />
            </View>
        </KitSurface>
    );
});
