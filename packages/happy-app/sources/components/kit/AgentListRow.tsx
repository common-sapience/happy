import * as React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import {
    resolveKitAgentStatusPresentation,
    type KitAgentStatus,
    type KitAgentStatusTokens,
} from './kitAgentStatus';

const STATUS_DOT_SIZE = 8;

const stylesheet = StyleSheet.create((theme) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.margins.md,
        paddingHorizontal: theme.margins.lg,
        minHeight: theme.minTouchTarget + theme.margins.md,
    },
    rowPressed: {
        backgroundColor: theme.colors.surfacePressed,
    },
    center: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    title: {
        ...Typography.default('regular'),
        color: theme.colors.text,
        fontSize: theme.typography.subtitle.fontSize,
        lineHeight: theme.typography.subtitle.lineHeight,
    },
    titleStrong: {
        ...Typography.default('semiBold'),
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.margins.xs,
    },
    statusLabel: {
        ...Typography.default('regular'),
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
    },
    subtitle: {
        ...Typography.default('regular'),
        color: theme.colors.textSecondary,
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
        flexShrink: 1,
    },
    dot: {
        width: STATUS_DOT_SIZE,
        height: STATUS_DOT_SIZE,
        borderRadius: STATUS_DOT_SIZE / 2,
    },
    muted: {
        opacity: 0.6,
    },
}));

export type AgentListRowProps = {
    title: string;
    /** The path or machine the agent runs on; technical detail stays on one line. */
    subtitle?: string;
    status: KitAgentStatus;
    statusLabel: string;
    onPress?: () => void;
    trailing?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
};

/**
 * One flat row per agent: name, a dot and the state in words, the path underneath
 * in the secondary colour. The row is opaque — the list is content, not chrome.
 */
export const AgentListRow = React.memo(function AgentListRow({
    title,
    subtitle,
    status,
    statusLabel,
    onPress,
    trailing,
    style,
}: AgentListRowProps) {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const statusTokens: KitAgentStatusTokens = {
        running: theme.colors.status.connected,
        waiting: theme.colors.box.warning.border,
        idle: theme.colors.status.default,
        archived: theme.colors.status.disconnected,
    };
    const presentation = resolveKitAgentStatusPresentation(status, statusTokens);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${statusLabel}`}
            onPress={onPress}
            style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
                presentation.emphasis === 'muted' && styles.muted,
                style,
            ]}
        >
            <View style={[styles.dot, { backgroundColor: presentation.dotColor }]} />
            <View style={styles.center}>
                <Text
                    numberOfLines={1}
                    style={[styles.title, presentation.emphasis === 'strong' && styles.titleStrong]}
                >
                    {title}
                </Text>
                <View style={styles.meta}>
                    <Text numberOfLines={1} style={[styles.statusLabel, { color: presentation.dotColor }]}>
                        {statusLabel}
                    </Text>
                    {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
            </View>
            {trailing}
        </Pressable>
    );
});
