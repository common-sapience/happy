import * as React from 'react';
import { SessionListViewItem, useSessionListViewData, useSetting } from '@/sync/storage';
import { matchesAgentSearch, useAgentListSearch } from '@/components/agentListSearch';

/**
 * Applies the archive-visibility preference and the sidebar's search field to the
 * agent list. Both narrow the same list, so they narrow it in one place.
 *
 * The rule is `session.archived`, never `!session.active`: an agent whose socket
 * merely dropped is still work you can pick back up, while one the user retired
 * hides.
 *
 * The setting behind it is still stored as `hideInactiveSessions`: it is a
 * server-synced settings field (see sync/settings.ts) with no per-field rename
 * migration, so the key stays put and only the local naming reflects what it
 * actually does.
 */
export function useVisibleSessionListViewData(): SessionListViewItem[] | null {
    const data = useSessionListViewData();
    const hideArchivedSessions = useSetting('hideInactiveSessions');
    const query = useAgentListSearch((state) => state.query);

    return React.useMemo(
        () => filterAgentListViewData(data, { hideArchivedSessions, query }),
        [data, hideArchivedSessions, query],
    );
}

/**
 * A date heading is held back until a row underneath it survives the filters, so
 * narrowing the list never leaves a heading with nothing under it.
 */
export function filterAgentListViewData(
    data: SessionListViewItem[] | null,
    { hideArchivedSessions, query }: { hideArchivedSessions: boolean; query: string },
): SessionListViewItem[] | null {
    if (!data) {
        return data;
    }
    if (!hideArchivedSessions && query.trim().length === 0) {
        return data;
    }

    const result: SessionListViewItem[] = [];
    let pendingHeader: SessionListViewItem | null = null;
    for (const item of data) {
        if (item.type === 'header') {
            pendingHeader = item;
            continue;
        }
        if (hideArchivedSessions && item.session.archived) continue;
        if (!matchesAgentSearch(item.session, query)) continue;
        if (pendingHeader) {
            result.push(pendingHeader);
            pendingHeader = null;
        }
        result.push(item);
    }
    return result;
}

/**
 * Whether the archive-visibility control can change anything. Keyed off the
 * same `archived` flag the filter above uses so the control never appears
 * without changing what is on screen.
 */
export function useHasArchivedSessions(): boolean {
    const data = useSessionListViewData();
    return React.useMemo(() => {
        if (!data) return false;
        return data.some((item) => item.type === 'session' && item.session.archived);
    }, [data]);
}
