import * as React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/constants/Typography';
import { AnimatedCollapsible } from '../AnimatedOverlay';
import { layout } from '../layout';
import type { ActivityTone } from './kitTranscriptRow';

const stylesheet = StyleSheet.create((theme) => ({
    column: {
        width: '100%',
        maxWidth: layout.maxWidth,
        alignSelf: 'center',
        paddingHorizontal: theme.margins.lg,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.margins.sm,
        minHeight: theme.minTouchTarget - theme.margins.md,
        paddingVertical: theme.margins.xs,
    },
    rowPressed: {
        opacity: 0.6,
    },
    tinted: {
        paddingHorizontal: theme.margins.md,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.box.error.background,
    },
    label: {
        ...Typography.default('regular'),
        flexShrink: 1,
        minWidth: 0,
        color: theme.colors.textSecondary,
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
    },
    labelFailed: {
        color: theme.colors.box.error.text,
    },
    target: {
        ...Typography.default('regular'),
        flexShrink: 1,
        minWidth: 0,
        color: theme.colors.text,
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
    },
    declined: {
        textDecorationLine: 'line-through',
    },
    trailing: {
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
        marginBottom: theme.margins.xs,
        borderRadius: theme.borderRadius.md,
        backgroundColor: theme.colors.surfaceHigh,
    },
}));

/**
 * The transcript's single column. Every row in the stream — reply, activity,
 * permission card, status — is laid out against the same left edge and the same
 * maximum measure, which is what makes one column read as one conversation.
 */
export const TranscriptColumn = React.memo(function TranscriptColumn(props: {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}) {
    return <View style={[stylesheet.column, props.style]}>{props.children}</View>;
});

export type ActivityRowProps = {
    /** The verb, in the user's words. Never a tool, server or method name. */
    label: string;
    /** What the verb acted on: a file name, a command, a page. */
    target?: string | null;
    tone?: ActivityTone;
    /** Elapsed time or a duration, to the trailing edge. */
    trailing?: string | null;
    /** The raw call, revealed in place. Absent means the row does not open. */
    detail?: string | null;
    expandLabel: string;
    collapseLabel: string;
    style?: StyleProp<ViewStyle>;
};

/**
 * One line of the agent's work. Everything the stream reports about a step —
 * which tool, which arguments, how it ended — collapses to a verb and its target
 * at the transcript's own text size, and opens in place to the raw call for the
 * one reader who wants it (DESK-01, DESK-20). No icon, no card, no border: a step
 * is a line, and the line the reader is interested in is the reply above it.
 */
export const ActivityRow = React.memo(function ActivityRow({
    label,
    target,
    tone = 'normal',
    trailing,
    detail,
    expandLabel,
    collapseLabel,
    style,
}: ActivityRowProps) {
    const styles = stylesheet;
    const { theme } = useUnistyles();
    const [expanded, setExpanded] = React.useState(false);
    const openable = typeof detail === 'string' && detail.length > 0;

    const toggle = React.useCallback(() => setExpanded((current) => !current), []);

    const content = (
        <>
            <Text numberOfLines={1} style={[styles.label, tone === 'failed' && styles.labelFailed]}>
                {label}
            </Text>
            {target ? (
                <Text
                    numberOfLines={1}
                    style={[
                        styles.target,
                        tone === 'failed' && styles.labelFailed,
                        tone === 'declined' && styles.declined,
                    ]}
                >
                    {target}
                </Text>
            ) : null}
            <View style={{ flex: 1 }} />
            {trailing ? <Text style={styles.trailing}>{trailing}</Text> : null}
            {openable ? (
                <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={theme.iconSize.small}
                    color={theme.colors.textSecondary}
                />
            ) : null}
        </>
    );

    return (
        <View style={[styles.column, style]}>
            {openable ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={expanded ? collapseLabel : expandLabel}
                    onPress={toggle}
                    style={({ pressed }) => [
                        styles.row,
                        tone === 'failed' && styles.tinted,
                        pressed && styles.rowPressed,
                    ]}
                >
                    {content}
                </Pressable>
            ) : (
                <View style={[styles.row, tone === 'failed' && styles.tinted]}>{content}</View>
            )}
            {openable && expanded ? (
                <AnimatedCollapsible>
                    <Text selectable style={styles.raw}>{detail}</Text>
                </AnimatedCollapsible>
            ) : null}
        </View>
    );
});
