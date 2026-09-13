import * as React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Typography } from '@/constants/Typography';
import { agentListStateColor, agentListStateLabel } from '../agentListState';
import { StatusDot } from '../StatusDot';
import { layout } from '../layout';
import { resolveTranscriptStatus } from './kitTranscriptStatus';
import type { SessionState } from '@/sync/sessionState';

const stylesheet = StyleSheet.create((theme) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.margins.xs,
        width: '100%',
        maxWidth: layout.maxWidth,
        alignSelf: 'center',
        paddingHorizontal: theme.margins.lg,
        paddingVertical: theme.margins.sm,
    },
    word: {
        ...Typography.default('regular'),
        fontSize: theme.typography.caption.fontSize,
        lineHeight: theme.typography.caption.lineHeight,
    },
}));

export type TranscriptStatusProps = {
    state: SessionState;
    archived: boolean;
};

/**
 * The one running indicator: a dot and a word under the last message, gone the
 * moment there is nothing to report. Both come from `agentListState`, so this line
 * and the agent list always say the same thing about the same agent (design.md §5).
 */
export const TranscriptStatus = React.memo(function TranscriptStatus({ state, archived }: TranscriptStatusProps) {
    const styles = stylesheet;
    const { theme } = useUnistyles();
    const presentation = resolveTranscriptStatus({ state, archived });

    if (!presentation.visible) {
        return null;
    }

    const color = agentListStateColor(presentation.state, theme);
    return (
        <View accessibilityRole="text" style={styles.row}>
            <StatusDot color={color} isPulsing={presentation.pulsing} />
            <Text style={[styles.word, { color }]}>{agentListStateLabel(presentation.state)}</Text>
        </View>
    );
});
