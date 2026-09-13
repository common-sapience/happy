import { describe, expect, it } from 'vitest';
import { normalizeRawMessage, RawRecordSchema } from './typesRaw';
import { createReducer, reducer } from './reducer/reducer';
import { AgentStateSchema } from './storageTypes';
import { resolveTranscriptActivity, resolveTranscriptRowKind } from '@/components/kit/kitTranscriptRow';

function agentState(state: unknown) {
    return AgentStateSchema.parse(state);
}

function toolRows(messages: ReturnType<typeof reducer>['messages']) {
    return messages.filter(message => message.kind === 'tool-call');
}

function message(id: string, ev: Record<string, unknown>) {
    const normalized = normalizeRawMessage(id, null, 1, RawRecordSchema.parse({
        role: 'session',
        content: { id, time: 1, role: 'agent', turn: 'turn-1', ev },
    }));
    expect(normalized).not.toBeNull();
    return normalized!;
}

describe('Happy Agent tool wire → rendered message contract', () => {
    it('preserves a wire title when a legacy tool update omits it', () => {
        const state = createReducer();
        reducer(state, [message('start', {
            t: 'tool-call-start', call: 'call-1', name: 'CodexBash', title: 'Terminal',
            description: 'Running CodexBash', args: { command: 'echo hello' },
        })]);
        const legacy = normalizeRawMessage('legacy-update', null, 2, RawRecordSchema.parse({
            role: 'agent',
            content: {
                type: 'output',
                data: {
                    type: 'assistant', uuid: 'legacy-uuid',
                    message: {
                        role: 'assistant', model: 'claude',
                        content: [{ type: 'tool_use', id: 'call-1', name: 'CodexBash', input: { command: 'echo hello' } }],
                    },
                },
            },
        }));
        expect(legacy).not.toBeNull();
        const result = reducer(state, [legacy!]);
        const tool = result.messages.find(m => m.kind === 'tool-call');
        expect(tool?.kind === 'tool-call' && tool.tool.title).toBe('Terminal');
    });

    it.each([
        [{ result: 'hello\nworld' }, 'completed', 'hello\nworld'],
        [{ result: 'permission denied', isError: true }, 'error', 'permission denied'],
        [{ isError: true }, 'error', null],
        [{}, 'completed', null],
        [{ result: '', isError: false }, 'completed', ''],
    ] as const)('preserves title, result, and state: %j', (end, expectedState, expectedResult) => {
        const state = createReducer();
        const start = message('start', {
            t: 'tool-call-start', call: 'call-1', name: 'CodexBash', title: 'Terminal',
            description: 'Running CodexBash', args: { command: 'echo hello' },
        });
        const result = reducer(state, [start, message('end', { t: 'tool-call-end', call: 'call-1', ...end })]);
        const tool = result.messages.find(m => m.kind === 'tool-call');
        expect(tool?.kind === 'tool-call' && tool.tool).toMatchObject({
            callId: 'call-1', name: 'CodexBash', title: 'Terminal',
            input: { command: 'echo hello' }, state: expectedState, result: expectedResult,
        });
    });
});
// T-25: the permission request and the tool events name the step with the same
// id, so asking, allowing and finishing is one row rather than three.
describe('one tool call is one transcript row', () => {
    const call = 'acp-call-1';
    const started = {
        t: 'tool-call-start', call, name: 'execute', title: 'ls -la',
        description: '', args: { command: 'ls -la' },
    };

    it('stays one row across ask, allow and end', () => {
        const state = createReducer();

        const asked = reducer(state, [], agentState({
            requests: { [call]: { tool: 'bash', arguments: { command: 'ls -la' }, createdAt: 1 } },
        }));
        expect(toolRows(asked.messages)).toHaveLength(1);

        const allowed = reducer(state, [message('start', started)], agentState({
            completedRequests: {
                [call]: {
                    tool: 'bash', arguments: { command: 'ls -la' }, createdAt: 1,
                    completedAt: 2, status: 'approved', decision: 'approved',
                },
            },
        }));
        expect(toolRows(allowed.messages)).toHaveLength(1);

        const ended = reducer(state, [message('end', { t: 'tool-call-end', call, result: 'total 12' })]);
        const rows = toolRows(ended.messages);
        expect(rows).toHaveLength(1);

        const row = rows[0];
        expect(row.kind === 'tool-call' && row.tool).toMatchObject({
            callId: call, state: 'completed', result: 'total 12',
        });
        expect(resolveTranscriptRowKind(row)).toBe('activity');
        // The line reads from the engine's category, not from the tool's own
        // name the permission request carried (DESK-01).
        expect(row.kind === 'tool-call' && resolveTranscriptActivity(row.tool)).toMatchObject({
            verb: 'ran', target: 'ls -la', tone: 'normal', running: false,
        });
    });

    it('shows an allowed step that then failed as failed', () => {
        const state = createReducer();
        reducer(state, [], agentState({
            requests: { [call]: { tool: 'bash', arguments: { command: 'ls -la' }, createdAt: 1 } },
        }));
        reducer(state, [message('start', started)], agentState({
            completedRequests: {
                [call]: {
                    tool: 'bash', arguments: { command: 'ls -la' }, createdAt: 1,
                    completedAt: 2, status: 'approved', decision: 'approved',
                },
            },
        }));
        const ended = reducer(state, [message('end', {
            t: 'tool-call-end', call, result: 'ls: no such file', isError: true,
        })]);

        const rows = toolRows(ended.messages);
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row.kind === 'tool-call' && row.tool.state).toBe('error');
        expect(row.kind === 'tool-call' && resolveTranscriptActivity(row.tool).tone).toBe('failed');
    });

    it('shows a refused step as refused, with no end event to wait for', () => {
        const state = createReducer();
        reducer(state, [message('start', started)], agentState({
            requests: { [call]: { tool: 'bash', arguments: { command: 'ls -la' }, createdAt: 1 } },
        }));
        const refused = reducer(state, [], agentState({
            completedRequests: {
                [call]: {
                    tool: 'bash', arguments: { command: 'ls -la' }, createdAt: 1,
                    completedAt: 2, status: 'denied', decision: 'denied', reason: 'Denied by user',
                },
            },
        }));

        const rows = toolRows(refused.messages);
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row.kind === 'tool-call' && resolveTranscriptActivity(row.tool).tone).toBe('declined');
    });

    // Sessions recorded before the ids were shared still have to render: the two
    // halves simply stay two rows, as they did then.
    it('still renders a session whose permission and tool events disagree', () => {
        const state = createReducer();
        const result = reducer(state, [
            message('start', { ...started, call: 'minted-call-1' }),
            message('end', { t: 'tool-call-end', call: 'minted-call-1' }),
        ], agentState({
            completedRequests: {
                [call]: {
                    tool: 'bash', arguments: { command: 'ls -la' }, createdAt: 1,
                    completedAt: 2, status: 'approved', decision: 'approved',
                },
            },
        }));

        const rows = toolRows(result.messages);
        expect(rows).toHaveLength(2);
        for (const row of rows) {
            expect(resolveTranscriptRowKind(row)).toBe('activity');
        }
    });
});
