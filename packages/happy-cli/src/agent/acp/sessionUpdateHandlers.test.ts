import { describe, expect, it, vi } from 'vitest';
import type { AgentMessage } from '../core';
import { defaultTransport } from '../transport';
import { startToolCall, type HandlerContext } from './sessionUpdateHandlers';

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
