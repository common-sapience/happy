import type { Session } from './storageTypes';
import { isSessionArchived } from './sessionArchived';
import { getSessionActivityAt } from '@/utils/sessionActivity';

/**
 * Which agents the list shows and in what order (DESK-11).
 *
 * Kept apart from storage.ts, which reaches for React Native: this is the rule
 * itself — one column, newest activity first, split by the day it happened, with
 * the archive as the tail — and it is the only place that rule lives.
 */
export type AgentListEntry<Row> =
    | { type: 'header'; title: string }
    | { type: 'session'; session: Row };

/**
 * The host's own sessions: the background memory consolidation it starts by
 * itself under the internal profile. They are never listed and never counted as
 * the user's agents.
 */
export function isInternalSession(session: Pick<Session, 'metadata'>): boolean {
    return session.metadata?.internal === true;
}

/**
 * Splits the sessions into what is on screen and what is retired, each newest
 * first. Activity keys off the last meaningful message rather than `updatedAt`,
 * which bumps on every background agent update and would make the list jump
 * while several agents stream at once.
 */
export function partitionAgentSessions(sessions: readonly Session[]): {
    live: Session[];
    archived: Session[];
} {
    const live: Session[] = [];
    const archived: Session[] = [];
    for (const session of sessions) {
        if (isInternalSession(session)) continue;
        if (isSessionArchived(session)) archived.push(session);
        else live.push(session);
    }
    const byActivity = (a: Session, b: Session) => getSessionActivityAt(b) - getSessionActivityAt(a);
    live.sort(byActivity);
    archived.sort(byActivity);
    return { live, archived };
}

/**
 * The list itself. `dayTitle` is supplied by the caller so this module stays
 * free of the translation table.
 */
export function buildAgentListEntries<Row>({
    sessions,
    toRow,
    dayTitle,
}: {
    sessions: readonly Session[];
    toRow: (session: Session) => Row;
    dayTitle: (timestamp: number) => string;
}): AgentListEntry<Row>[] {
    const { live, archived } = partitionAgentSessions(sessions);
    const entries: AgentListEntry<Row>[] = [];

    const append = (group: Session[]) => {
        let currentDay: number | null = null;
        for (const session of group) {
            const timestamp = getSessionActivityAt(session);
            const day = new Date(timestamp).setHours(0, 0, 0, 0);
            if (day !== currentDay) {
                currentDay = day;
                entries.push({ type: 'header', title: dayTitle(timestamp) });
            }
            entries.push({ type: 'session', session: toRow(session) });
        }
    };

    append(live);
    append(archived);

    return entries;
}
