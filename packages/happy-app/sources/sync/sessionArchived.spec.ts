import { describe, expect, it } from 'vitest';
import { isSessionArchived } from './sessionArchived';
import type { Session } from './storageTypes';

function session(fields: Partial<Session>): Session {
    return { id: 's', active: true, metadata: { path: '/work' }, ...fields } as unknown as Session;
}

describe('RL-07 the archived list reads the relay marker the host wrote', () => {
    it('archives a session the relay marks archived', () => {
        expect(isSessionArchived(session({ archived: true }))).toBe(true);
    });

    it('keeps a session the relay marks unarchived out of the archive, even with its host gone', () => {
        expect(isSessionArchived(session({ archived: false, active: false }))).toBe(false);
    });

    it('lets the marker outrank a stale metadata copy in either direction', () => {
        expect(isSessionArchived(session({ archived: false, metadata: { path: '/work', lifecycleState: 'archived' } as any }))).toBe(false);
        expect(isSessionArchived(session({ archived: true, metadata: { path: '/work', lifecycleState: 'running' } as any }))).toBe(true);
    });

    it('falls back to the metadata copy for a session the relay reported no marker for', () => {
        expect(isSessionArchived(session({ metadata: { path: '/work', lifecycleState: 'archived' } as any }))).toBe(true);
        expect(isSessionArchived(session({ active: false }))).toBe(true);
        expect(isSessionArchived(session({ active: true }))).toBe(false);
    });
});
