import { describe, expect, it } from 'vitest';
import type { Message, ToolCall } from '@/sync/typesMessage';
import {
    buildThinkingDurations,
    isMutableActivity,
    resolveActivityTarget,
    resolveActivityTone,
    resolveActivityVerb,
    resolveTranscriptActivity,
    resolveTranscriptRawCall,
    resolveTranscriptRowKind,
} from './kitTranscriptRow';

function tool(overrides: Partial<ToolCall> = {}): ToolCall {
    return {
        name: 'other',
        state: 'completed',
        input: {},
        createdAt: 0,
        startedAt: null,
        completedAt: null,
        description: null,
        ...overrides,
    };
}

function userMessage(text: string): Message {
    return { kind: 'user-text', id: 'u1', localId: null, createdAt: 0, text };
}

function agentMessage(text: string, isThinking?: boolean, id = 'a1', createdAt = 0): Message {
    return { kind: 'agent-text', id, localId: null, createdAt, text, isThinking };
}

describe('DESK-20 transcript row kinds', () => {
    it('boxes the user message and leaves the reply flat', () => {
        expect(resolveTranscriptRowKind(userMessage('do the thing'))).toBe('user');
        expect(resolveTranscriptRowKind(agentMessage('done'))).toBe('reply');
    });

    it('separates a thinking block from a reply', () => {
        expect(resolveTranscriptRowKind(agentMessage('weighing it up', true))).toBe('thinking');
    });

    it('drops a message with nothing to show', () => {
        expect(resolveTranscriptRowKind(userMessage('   '))).toBe('hidden');
        expect(resolveTranscriptRowKind(agentMessage('', true))).toBe('hidden');
    });

    it('renders a tool call as an activity line and an engine event as a notice', () => {
        const activity: Message = {
            kind: 'tool-call', id: 't1', localId: null, createdAt: 0, tool: tool(), children: [],
        };
        expect(resolveTranscriptRowKind(activity)).toBe('activity');
        const notice: Message = {
            kind: 'agent-event', id: 'e1', createdAt: 0, event: { type: 'ready' },
        };
        expect(resolveTranscriptRowKind(notice)).toBe('notice');
    });
});

describe('DESK-20 activity verbs', () => {
    it('reads the engine protocol kinds as plain verbs', () => {
        expect(resolveActivityVerb('execute')).toBe('ran');
        expect(resolveActivityVerb('edit')).toBe('edited');
        expect(resolveActivityVerb('read')).toBe('read');
        expect(resolveActivityVerb('search')).toBe('searched');
        expect(resolveActivityVerb('fetch')).toBe('fetched');
        expect(resolveActivityVerb('think')).toBe('delegated');
    });

    it('reads the engine tool names as the same verbs', () => {
        expect(resolveActivityVerb('bash')).toBe('ran');
        expect(resolveActivityVerb('apply_patch')).toBe('edited');
        expect(resolveActivityVerb('websearch')).toBe('fetched');
        expect(resolveActivityVerb('Glob')).toBe('searched');
    });

    // DESK-01: a server and method name is technical detail, so a tool we have no
    // word for is reported as a tool the agent used and nothing more.
    it('never derives a verb from an MCP server or method name', () => {
        expect(resolveActivityVerb('mcp__chrome_devtools__navigate_page')).toBe('used');
        expect(resolveActivityVerb('other')).toBe('used');
        expect(resolveActivityVerb('')).toBe('used');
    });
});

describe('DESK-20 activity targets', () => {
    it('summarises a command on one line', () => {
        const target = resolveActivityTarget(tool({
            name: 'execute',
            input: { command: 'pnpm  test\n--watch' },
        }));
        expect(target).toBe('pnpm test --watch');
    });

    it('unwraps a shell-wrapped command', () => {
        expect(resolveActivityTarget(tool({
            name: 'execute',
            input: { command: ['bash', '-lc', 'git', 'status'] },
        }))).toBe('git status');
    });

    it('names the file rather than the path it sits in', () => {
        expect(resolveActivityTarget(tool({
            name: 'edit',
            input: { filePath: '/home/me/project/sources/theme.ts' },
        }))).toBe('theme.ts');
    });

    it('falls back to the location the engine reported', () => {
        expect(resolveActivityTarget(tool({
            name: 'read',
            input: { locations: [{ path: '/tmp/work/notes.md' }] },
        }))).toBe('notes.md');
    });

    it('takes a pattern, a query or a page when there is no file', () => {
        expect(resolveActivityTarget(tool({ name: 'search', input: { pattern: 'TODO' } }))).toBe('TODO');
        expect(resolveActivityTarget(tool({ name: 'fetch', input: { url: 'https://example.com/docs' } })))
            .toBe('https://example.com/docs');
    });

    it('uses the engine title only when it says more than the protocol word', () => {
        expect(resolveActivityTarget(tool({ name: 'other', title: 'other' }))).toBeNull();
        expect(resolveActivityTarget(tool({ name: 'other', title: 'Opened the release notes' })))
            .toBe('Opened the release notes');
    });

    it('has no target when the engine sent no arguments', () => {
        expect(resolveActivityTarget(tool({ name: 'execute', input: {} }))).toBeNull();
        expect(resolveActivityTarget(tool({ name: 'execute', input: null }))).toBeNull();
    });
});

describe('DESK-20 activity tone and raw call', () => {
    it('marks a refused step apart from a failed one', () => {
        expect(resolveActivityTone(tool({
            state: 'completed',
            permission: { id: 'p1', status: 'denied' },
        }))).toBe('declined');
        expect(resolveActivityTone(tool({ state: 'error' }))).toBe('failed');
        expect(resolveActivityTone(tool({ state: 'running' }))).toBe('normal');
    });

    it('keeps the tool name and arguments for the expansion only', () => {
        const raw = resolveTranscriptRawCall(tool({
            name: 'mcp__chrome_devtools__navigate_page',
            input: { url: 'https://example.com' },
        }));
        expect(raw).toContain('mcp__chrome_devtools__navigate_page');
        expect(raw).toContain('https://example.com');
    });

    it('survives an argument object that cannot be serialised', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(resolveTranscriptRawCall(tool({ name: 'edit', input: circular }))).toContain('edit');
    });

    it('resolves a whole row in one pass', () => {
        expect(resolveTranscriptActivity(tool({
            name: 'execute',
            state: 'running',
            input: { command: 'make check' },
        }))).toMatchObject({ verb: 'ran', target: 'make check', tone: 'normal', running: true });
    });
});

describe('DESK-20 mutating activities', () => {
    it('treats looking around as harmless and everything else as a change', () => {
        expect(isMutableActivity('read')).toBe(false);
        expect(isMutableActivity('search')).toBe(false);
        expect(isMutableActivity('fetch')).toBe(false);
        expect(isMutableActivity('edit')).toBe(true);
        expect(isMutableActivity('execute')).toBe(true);
        expect(isMutableActivity('mcp__unknown__call')).toBe(true);
    });
});

describe('DESK-20 thinking durations', () => {
    it('measures a thinking block against the message that followed it', () => {
        const messages: Message[] = [
            agentMessage('done', false, 'a2', 5_000),
            agentMessage('weighing it up', true, 'a1', 2_000),
        ];
        expect(buildThinkingDurations(messages).get('a1')).toBe(3_000);
    });

    it('leaves the duration unknown while the block is still the newest message', () => {
        const messages: Message[] = [agentMessage('weighing it up', true, 'a1', 2_000)];
        expect(buildThinkingDurations(messages).has('a1')).toBe(false);
    });
});
