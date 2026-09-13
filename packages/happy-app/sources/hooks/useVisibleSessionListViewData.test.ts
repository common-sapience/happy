import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionListViewItem, SessionRowData } from '@/sync/storage';

const mocks = vi.hoisted(() => ({
    data: null as SessionListViewItem[] | null,
    hideArchivedSessions: false,
    query: '',
}));

// The hook only ever reads `React.useMemo`, and storage.ts pulls in React
// Native, so both are stubbed down to the surface the hook actually touches.
vi.mock('react', () => ({
    useMemo: <T,>(factory: () => T) => factory(),
}));

vi.mock('@/sync/storage', () => ({
    useSessionListViewData: () => mocks.data,
    useSetting: (key: string) => {
        if (key !== 'hideInactiveSessions') {
            throw new Error(`Unexpected setting read: ${key}`);
        }
        return mocks.hideArchivedSessions;
    },
}));

vi.mock('@/components/agentListSearch', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/components/agentListSearch')>();
    return {
        matchesAgentSearch: actual.matchesAgentSearch,
        useAgentListSearch: (select: (state: { query: string }) => unknown) => select({ query: mocks.query }),
    };
});

import { useHasArchivedSessions, useVisibleSessionListViewData } from './useVisibleSessionListViewData';

function row(id: string, options: { archived?: boolean } = {}): SessionRowData {
    return {
        id,
        name: id,
        active: true,
        archived: options.archived ?? false,
        projectName: null,
        workspaceName: null,
        path: null,
        machineName: null,
    } as SessionRowData;
}

function agent(id: string, options: { archived?: boolean } = {}): SessionListViewItem {
    return { type: 'session', session: row(id, options) };
}

function heading(title: string): SessionListViewItem {
    return { type: 'header', title };
}

function ids(items: SessionListViewItem[] | null): string[] {
    return (items ?? [])
        .filter((item): item is Extract<SessionListViewItem, { type: 'session' }> => item.type === 'session')
        .map((item) => item.session.id);
}

function titles(items: SessionListViewItem[] | null): string[] {
    return (items ?? [])
        .filter((item): item is Extract<SessionListViewItem, { type: 'header' }> => item.type === 'header')
        .map((item) => item.title);
}

describe('DESK-11 archive visibility', () => {
    beforeEach(() => {
        mocks.data = null;
        mocks.hideArchivedSessions = false;
        mocks.query = '';
    });

    function mixedList(): SessionListViewItem[] {
        return [
            heading('Today'),
            agent('live'),
            heading('Yesterday'),
            agent('retired', { archived: true }),
        ];
    }

    it('passes the list through untouched while the archive is shown', () => {
        mocks.data = mixedList();
        expect(ids(useVisibleSessionListViewData())).toEqual(['live', 'retired']);
        expect(titles(useVisibleSessionListViewData())).toEqual(['Today', 'Yesterday']);
    });

    it('hides archived agents, and the heading that would be left empty with them', () => {
        mocks.data = mixedList();
        mocks.hideArchivedSessions = true;

        expect(ids(useVisibleSessionListViewData())).toEqual(['live']);
        expect(titles(useVisibleSessionListViewData())).toEqual(['Today']);
    });

    it('keeps a heading whose day still has a live agent under it', () => {
        mocks.data = [
            heading('Today'),
            agent('retired', { archived: true }),
            agent('live'),
        ];
        mocks.hideArchivedSessions = true;

        expect(ids(useVisibleSessionListViewData())).toEqual(['live']);
        expect(titles(useVisibleSessionListViewData())).toEqual(['Today']);
    });

    it('reports nothing loaded as nothing to show', () => {
        expect(useVisibleSessionListViewData()).toBeNull();
        expect(useHasArchivedSessions()).toBe(false);
    });

    it('narrows the list to what the search field matches, headings included', () => {
        mocks.data = mixedList();
        mocks.query = 'live';

        expect(ids(useVisibleSessionListViewData())).toEqual(['live']);
        expect(titles(useVisibleSessionListViewData())).toEqual(['Today']);
    });

    it('offers the archive control only when something is archived', () => {
        mocks.data = [heading('Today'), agent('live')];
        expect(useHasArchivedSessions()).toBe(false);

        mocks.data = mixedList();
        expect(useHasArchivedSessions()).toBe(true);
    });
});
