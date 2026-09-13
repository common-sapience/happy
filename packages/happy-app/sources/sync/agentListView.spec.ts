import { describe, expect, it } from 'vitest';
import { buildAgentListEntries, isInternalSession, partitionAgentSessions } from './agentListView';
import type { Session } from './storageTypes';

const DAY = 24 * 60 * 60 * 1000;

function session(id: string, overrides: {
    at?: number;
    archived?: boolean;
    active?: boolean;
    internal?: boolean;
} = {}): Session {
    return {
        id,
        createdAt: overrides.at ?? 0,
        updatedAt: overrides.at ?? 0,
        active: overrides.active ?? true,
        activeAt: overrides.at ?? 0,
        archived: overrides.archived,
        metadata: {
            path: '/work',
            host: 'laptop',
            lastMeaningfulMessageAt: overrides.at ?? 0,
            ...(overrides.internal ? { internal: true } : {}),
        },
    } as unknown as Session;
}

function entries(sessions: Session[]) {
    return buildAgentListEntries({
        sessions,
        toRow: (item) => ({ id: item.id }),
        dayTitle: (timestamp) => `day-${new Date(timestamp).setHours(0, 0, 0, 0)}`,
    });
}

function listedIds(sessions: Session[]): string[] {
    return entries(sessions)
        .filter((entry): entry is { type: 'session'; session: { id: string } } => entry.type === 'session')
        .map((entry) => entry.session.id);
}

describe('DESK-11 the agent list', () => {
    it('hides the host\'s own internal sessions', () => {
        expect(isInternalSession(session('dream', { internal: true }))).toBe(true);
        expect(isInternalSession(session('mine'))).toBe(false);
        expect(listedIds([
            session('mine', { at: 2 * DAY }),
            session('dream', { at: 3 * DAY, internal: true }),
        ])).toEqual(['mine']);
    });

    it('hides an internal session even after it is archived', () => {
        expect(listedIds([session('dream', { at: DAY, internal: true, archived: true })])).toEqual([]);
    });

    it('shows archived agents, after everything still live', () => {
        const { live, archived } = partitionAgentSessions([
            session('retired', { at: 9 * DAY, archived: true }),
            session('working', { at: 2 * DAY }),
        ]);
        expect(live.map((item) => item.id)).toEqual(['working']);
        expect(archived.map((item) => item.id)).toEqual(['retired']);
        // Retired work trails the list even when it was touched more recently.
        expect(listedIds([
            session('retired', { at: 9 * DAY, archived: true }),
            session('working', { at: 2 * DAY }),
        ])).toEqual(['working', 'retired']);
    });

    it('treats a session whose host process ended as archived', () => {
        const { live, archived } = partitionAgentSessions([session('ended', { active: false, at: DAY })]);
        expect(live).toEqual([]);
        expect(archived.map((item) => item.id)).toEqual(['ended']);
    });

    it('orders by last activity and heads each day once', () => {
        const listed = entries([
            session('old', { at: 3 * DAY }),
            session('newest', { at: 10 * DAY }),
            session('same-day', { at: 10 * DAY + 60_000 }),
        ]);
        expect(listed.map((entry) => (entry.type === 'header' ? entry.title : entry.session.id))).toEqual([
            `day-${new Date(10 * DAY).setHours(0, 0, 0, 0)}`,
            'same-day',
            'newest',
            `day-${new Date(3 * DAY).setHours(0, 0, 0, 0)}`,
            'old',
        ]);
    });

    it('has no second list shape to fall into: every entry is a heading or an agent', () => {
        const kinds = new Set(entries([
            session('a', { at: DAY }),
            session('b', { at: 2 * DAY, archived: true }),
        ]).map((entry) => entry.type));
        expect([...kinds].sort()).toEqual(['header', 'session']);
    });
});
