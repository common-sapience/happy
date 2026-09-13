import { describe, expect, it, vi } from 'vitest';
import type { AgentMessage } from '../core';
import { defaultTransport } from '../transport';
import {
    completeToolCall,
    emitToolCallArguments,
    failToolCall,
    startToolCall,
    type HandlerContext,
} from './sessionUpdateHandlers';

function context(emitted: AgentMessage[]): HandlerContext {
    return {
        transport: defaultTransport,
        activeToolCalls: new Set<string>(),
        toolCallStartTimes: new Map<string, number>(),
        toolCallTimeouts: new Map<string, NodeJS.Timeout>(),
        toolCallIdToNameMap: new Map<string, string>(),
        idleTimeout: null,
        toolCallCountSincePrompt: 0,
        emit: (msg) => { emitted.push(msg); },
        emitIdleStatus: vi.fn(),
        clearIdleTimeout: vi.fn(),
        setIdleTimeout: vi.fn(),
    };
}

function toolResult(emitted: AgentMessage[]): Extract<AgentMessage, { type: 'tool-result' }> {
    const message = emitted.find((candidate) => candidate.type === 'tool-result');
    if (!message || message.type !== 'tool-result') {
        throw new Error('no tool result was emitted');
    }
    return message;
}

function toolCall(emitted: AgentMessage[]): Extract<AgentMessage, { type: 'tool-call' }> {
    const message = emitted.find((candidate) => candidate.type === 'tool-call');
    if (!message || message.type !== 'tool-call') {
        throw new Error('no tool call was emitted');
    }
    return message;
}

// DESK-01/DESK-20: the controller names a step from the call's own arguments, so
// the arguments and the engine's one-line title have to survive the hop.
describe('ACP tool call arguments', () => {
    it('forwards the call arguments and the engine title', () => {
        const emitted: AgentMessage[] = [];
        const ctx = context(emitted);
        startToolCall('call-1', 'execute', {
            title: 'pnpm test',
            rawInput: { command: 'pnpm test', cwd: '/work' },
            locations: [{ path: '/work' }],
        }, ctx, 'tool_call');

        const message = toolCall(emitted);
        expect(message.toolName).toBe('execute');
        expect(message.title).toBe('pnpm test');
        expect(message.args).toEqual({
            command: 'pnpm test',
            cwd: '/work',
            locations: [{ path: '/work' }],
        });
        for (const timeout of ctx.toolCallTimeouts.values()) {
            clearTimeout(timeout);
        }
    });

    it('falls back to the content when the engine sent no arguments', () => {
        const emitted: AgentMessage[] = [];
        const ctx = context(emitted);
        startToolCall('call-2', 'read', { content: { text: 'partial output' } }, ctx, 'tool_call');

        const message = toolCall(emitted);
        expect(message.title).toBeUndefined();
        expect(message.args).toEqual({ text: 'partial output' });
        for (const timeout of ctx.toolCallTimeouts.values()) {
            clearTimeout(timeout);
        }
    });
});

describe('ACP tool call arguments arriving late', () => {
    it('re-emits the call once the engine parses its arguments', () => {
        const emitted: AgentMessage[] = [];
        const ctx = context(emitted);
        startToolCall('call-3', 'execute', { rawInput: {} }, ctx, 'tool_call');
        emitted.length = 0;

        emitToolCallArguments('call-3', 'execute', {
            title: 'ls -la',
            rawInput: { command: 'ls -la' },
        }, ctx);

        expect(toolCall(emitted)).toMatchObject({
            callId: 'call-3',
            toolName: 'execute',
            title: 'ls -la',
            args: { command: 'ls -la' },
        });
        for (const timeout of ctx.toolCallTimeouts.values()) {
            clearTimeout(timeout);
        }
    });

    it('says nothing when the update adds no arguments', () => {
        const emitted: AgentMessage[] = [];
        const ctx = context(emitted);
        emitToolCallArguments('call-4', 'read', { title: 'notes.md' }, ctx);
        expect(emitted).toHaveLength(0);
    });
});

// T-26: a step that failed has to reach the control end as failed, so the
// result the engine gave is flagged rather than read back out of its shape.
describe('ACP tool call outcome', () => {
    it('flags a failed call and keeps the error detail the engine gave', () => {
        const emitted: AgentMessage[] = [];
        const ctx = context(emitted);
        failToolCall('call-5', 'failed', 'execute', { error: { message: 'ENOENT' } }, ctx);

        const message = toolResult(emitted);
        expect(message.callId).toBe('call-5');
        expect(message.isError).toBe(true);
        expect(message.result).toEqual({ error: 'ENOENT', status: 'failed' });
    });

    it('flags a cancelled call as failed too', () => {
        const emitted: AgentMessage[] = [];
        const ctx = context(emitted);
        failToolCall('call-6', 'cancelled', 'execute', undefined, ctx);

        expect(toolResult(emitted).isError).toBe(true);
    });

    it('leaves a completed call unflagged', () => {
        const emitted: AgentMessage[] = [];
        const ctx = context(emitted);
        completeToolCall('call-7', 'read', 'file contents', ctx);

        const message = toolResult(emitted);
        expect(message.callId).toBe('call-7');
        expect(message.isError).toBeUndefined();
        expect(message.result).toBe('file contents');
    });
});
