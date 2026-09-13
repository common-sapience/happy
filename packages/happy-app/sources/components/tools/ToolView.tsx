import * as React from 'react';
import { View } from 'react-native';
import { t } from '@/text';
import type { ToolCall } from '@/sync/typesMessage';
import { useElapsedTime } from '@/hooks/useElapsedTime';
import {
    ActivityRow,
    formatTranscriptDuration,
    resolveTranscriptActivity,
    TranscriptColumn,
    type ActivityVerb,
} from '@/components/kit';
import { PermissionFooter } from './PermissionFooter';

const VERB_LABELS: Record<ActivityVerb, () => string> = {
    ran: () => t('toolGroup.ran'),
    edited: () => t('toolGroup.edited'),
    read: () => t('toolGroup.read'),
    searched: () => t('toolGroup.searched'),
    fetched: () => t('toolGroup.fetched'),
    delegated: () => t('toolGroup.ranTask'),
    used: () => t('harness.usedTool'),
};

/**
 * One step of the agent's work in the transcript: the activity line, and — while
 * the engine is waiting on an answer — the permission card underneath it, at the
 * point the agent stopped (DESK-03, DESK-20).
 */
export const ToolView = React.memo(function ToolView(props: {
    tool: ToolCall;
    sessionId?: string;
}) {
    const { tool, sessionId } = props;
    const activity = resolveTranscriptActivity(tool);
    const elapsedSeconds = useElapsedTime(activity.running ? tool.createdAt : null);

    return (
        <View>
            <ActivityRow
                label={VERB_LABELS[activity.verb]()}
                target={activity.target}
                tone={activity.tone}
                trailing={activity.running ? formatTranscriptDuration(elapsedSeconds * 1000) : null}
                detail={activity.raw}
                expandLabel={t('transcript.showRawCall')}
                collapseLabel={t('transcript.hideRawCall')}
            />
            {tool.permission && sessionId ? (
                <TranscriptColumn>
                    <PermissionFooter
                        permission={tool.permission}
                        sessionId={sessionId}
                        toolName={tool.name}
                        toolInput={tool.input}
                    />
                </TranscriptColumn>
            ) : null}
        </View>
    );
});
