import * as React from 'react';
import { SessionListViewItem, useSessionListViewData, useSetting } from '@/sync/storage';

/**
 * Applies the persistent archive-visibility preference to the agent list.
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

    return React.useMemo(() => {
        if (!data) {
            return data;
        }
        if (!hideArchivedSessions) {
            return data;
        }

        // A date heading is held back until a row underneath it survives the
        // filter, so hiding the archive never leaves a heading with nothing
        // under it.
        const result: SessionListViewItem[] = [];
        let pendingHeader: SessionListViewItem | null = null;
        for (const item of data) {
            if (item.type === 'header') {
                pendingHeader = item;
                continue;
            }
            if (item.session.archived) continue;
            if (pendingHeader) {
                result.push(pendingHeader);
                pendingHeader = null;
            }
            result.push(item);
        }
        return result;
    }, [data, hideArchivedSessions]);
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
