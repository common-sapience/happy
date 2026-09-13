import type { SessionListViewItem } from '@/sync/storage';

/**
 * The agents in the order the list draws them, for the number shortcuts. The
 * list is one column (DESK-11), so there is nothing to flatten: its own order is
 * the display order.
 */
export function getSessionShortcutIdsInDisplayOrder(
    data: readonly SessionListViewItem[] | null,
): string[] {
    if (!data) {
        return [];
    }
    return data
        .filter((item): item is Extract<SessionListViewItem, { type: 'session' }> => item.type === 'session')
        .map((item) => item.session.id);
}
