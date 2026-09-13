import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@/sync/storageTypes';

vi.mock('@/text', () => ({
    t: (key: string, params?: Record<string, string>) => (
        params ? `${key}(${Object.values(params).join('|')})` : key
    ),
}));

const { resolveAgentTitle, summarizeOpeningMessage, directoryName } = await import('./sessionTitle');

function session(overrides: Partial<Session>): Session {
    return {
        id: 'session-1',
        seq: 1,
        createdAt: 1,
        updatedAt: 1,
        active: true,
        activeAt: 1,
        metadata: null,
        metadataVersion: 1,
        agentState: null,
        agentStateVersion: 1,
        thinking: false,
        thinkingAt: 0,
        presence: 'online',
        ...overrides,
    } as Session;
}

const metadata = (fields: Record<string, unknown>) => fields as Session['metadata'];

describe('summarizeOpeningMessage', () => {
    it('collapses whitespace to one line', () => {
        expect(summarizeOpeningMessage('  tidy   up\nthe   docs ')).toBe('tidy up the docs');
    });

    it('returns null for nothing to summarize', () => {
        expect(summarizeOpeningMessage('   ')).toBeNull();
        expect(summarizeOpeningMessage(null)).toBeNull();
        expect(summarizeOpeningMessage(undefined)).toBeNull();
    });

    it('cuts a long message on a word boundary', () => {
        const long = 'Rewrite the machine page so that it only shows what a person can actually act on';
        const summary = summarizeOpeningMessage(long)!;
        expect(summary.endsWith('…')).toBe(true);
        expect(summary.length).toBeLessThanOrEqual(61);
        expect(summary).toBe('Rewrite the machine page so that it only shows what a…');
    });
});

describe('directoryName', () => {
    it('takes the last segment of posix and windows paths', () => {
        expect(directoryName('/home/lee/work/harness/')).toBe('harness');
        expect(directoryName('C:\\work\\current-project')).toBe('current-project');
    });

    it('returns null without a path', () => {
        expect(directoryName('')).toBeNull();
        expect(directoryName(undefined)).toBeNull();
    });
});

describe('resolveAgentTitle', () => {
    it('prefers the title the host wrote', () => {
        const title = resolveAgentTitle(session({
            metadata: metadata({ path: '/work/harness', summary: { text: 'Ship the settings lane', updatedAt: 2 } }),
            openingUserText: 'do the thing',
        }));

        expect(title).toBe('Ship the settings lane');
    });

    it('falls back to the opening message when no title was written', () => {
        const title = resolveAgentTitle(session({
            metadata: metadata({ path: '/work/harness', agentProfile: 'build' }),
            openingUserText: '  Fix the machine page  ',
        }));

        expect(title).toBe('Fix the machine page');
    });

    it('names the profile and folder before any message has arrived', () => {
        const title = resolveAgentTitle(session({
            metadata: metadata({ path: '/work/harness', agentProfile: 'build' }),
        }));

        expect(title).toBe('session.agentInDirectory(harness.profileBuild|harness)');
    });

    it('uses the folder alone when the profile is unknown', () => {
        expect(resolveAgentTitle(session({ metadata: metadata({ path: '/work/harness' }) }))).toBe('harness');
    });

    it('says new agent only when nothing at all is known', () => {
        expect(resolveAgentTitle(session({}))).toBe('session.newAgent');
    });

    it('keeps a bot its own name', () => {
        const title = resolveAgentTitle(session({
            metadata: metadata({ path: '/work', bot: { id: 'b', name: 'Review bot' } }),
            openingUserText: 'ignored',
        }));

        expect(title).toBe('Review bot');
    });
});
