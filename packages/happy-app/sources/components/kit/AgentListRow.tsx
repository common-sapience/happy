import * as React from 'react';
import { Pressable, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { StatusDot } from '../StatusDot';
import { resolveKitAgentStatusPresentation, type KitAgentStatus } from './kitAgentStatus';

const stylesheet = StyleSheet.create((theme) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.margins.md,
        paddingHorizontal: theme.margins.lg,
        paddingVertical: theme.margins.sm,
        minHeight: theme.minTouchTarget + theme.margins.md,
    },
    rowPressed: {
        backgroundColor: theme.colors.surfacePressed,
    },
    rowSelected: {
        backgroundColor: theme.colors.surfaceSelected,
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
        flexShrink: 0,
    },
    subtitle: {
        ...Typography.default('regular'),
        color: theme.colors.textSecondary,
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
        flexShrink: 1,
    },
    muted: {
        opacity: 0.6,
    },
    divider: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.divider,
    },
}));

export type AgentListRowProps = Omit<PressableProps, 'style' | 'children'> & {
    title: string;
    /** The path or machine the agent runs on; technical detail stays on one line. */
    subtitle?: string;
    status: KitAgentStatus;
    /** Word and colour both come from `agentListState`, never from the row. */
    statusLabel: string;
    statusColor: string;
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
    selected?: boolean;
    showDivider?: boolean;
    /** Where the divider starts, so it can clear a leading avatar. */
    dividerInset?: number;
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
    statusColor,
    leading,
    trailing,
    selected,
    showDivider,
    dividerInset = 0,
    style,
    ...pressableProps
}: AgentListRowProps) {
    const styles = stylesheet;
    const presentation = resolveKitAgentStatusPresentation(status);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${statusLabel}`}
            {...pressableProps}
            style={({ pressed }) => [
                styles.row,
                selected && styles.rowSelected,
                pressed && styles.rowPressed,
                presentation.emphasis === 'muted' && styles.muted,
                style,
            ]}
        >
            {leading}
            <View style={styles.center}>
                <Text
                    numberOfLines={1}
                    style={[styles.title, presentation.emphasis === 'strong' && styles.titleStrong]}
                >
                    {title}
                </Text>
                <View style={styles.meta}>
                    <StatusDot color={statusColor} isPulsing={presentation.animated} />
                    <Text numberOfLines={1} style={[styles.statusLabel, { color: statusColor }]}>
                        {statusLabel}
                    </Text>
                    {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
            </View>
            {trailing}
            {showDivider ? <View style={[styles.divider, { left: dividerInset }]} /> : null}
        </Pressable>
    );
});
