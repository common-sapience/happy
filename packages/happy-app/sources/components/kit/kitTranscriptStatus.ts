import { resolveAgentListState, type AgentListState } from '../agentListState';
import type { SessionState } from '@/sync/sessionState';

export type TranscriptStatusPresentation = {
    /**
     * Only work that is happening or waiting earns a line. An idle agent is
     * described by the transcript itself, and a line saying so would be standing
     * furniture rather than a status.
     */
    visible: boolean;
    state: AgentListState;
    pulsing: boolean;
};

/**
 * The running indicator under the last message. Word and colour are not decided
 * here: `agentListState` owns both, so the list, the transcript and notifications
 * never disagree (design.md §5).
 */
export function resolveTranscriptStatus({ state, archived }: {
    state: SessionState;
    archived: boolean;
}): TranscriptStatusPresentation {
    const listState = resolveAgentListState({ state, archived });
    const visible = listState === 'running' || listState === 'waiting';
    return {
        visible,
        state: listState,
        pulsing: visible,
    };
}

/**
 * A duration in the shortest form that still reads as one: seconds under a
 * minute, minutes and seconds under an hour, hours and minutes beyond it.
 */
export function formatTranscriptDuration(durationMs: number): string {
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}h${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m${seconds}s`;
    }
    return `${seconds}s`;
}
