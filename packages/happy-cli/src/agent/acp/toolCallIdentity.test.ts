/**
 * T-25: a permission request and the tool events of the same step must name that
 * step with one identifier — the one the engine gave the tool call. This is the
 * seam the control end joins on, so it is asserted on the host side too.
 */

import { describe, expect, it } from 'vitest';
import type { ApiSessionClient } from '@/api/apiSession';
import type { AgentState } from '@/api/types';
import { AcpSessionManager } from './AcpSessionManager';
import { GenericAcpPermissionHandler } from './acpPermissionHandler';

type PermissionAnswerHandler = (answer: { id: string; approved: boolean; decision?: string }) => Promise<void>;

function fakeSession() {
    let agentState: AgentState = {};
    let answer: PermissionAnswerHandler | null = null;
    const session = {
        rpcHandlerManager: {
            registerHandler(name: string, handler: PermissionAnswerHandler) {
                if (name === 'permission') {
                    answer = handler;
                }
            },
        },
        updateAgentState(update: (state: AgentState) => AgentState) {
            agentState = update(agentState);
        },
    };
    return {
        client: session as unknown as ApiSessionClient,
        state: () => agentState,
        answer: async (value: { id: string; approved: boolean; decision?: string }) => {
            if (!answer) {
                throw new Error('no permission handler was registered');
            }
            await answer(value);
        },
    };
}

describe('permission request and tool events of one step', () => {
    it('names the step with the engine call id on both sides', async () => {
        const session = fakeSession();
        const permissions = new GenericAcpPermissionHandler(session.client, 'engine');
        const mapper = new AcpSessionManager();
        mapper.startTurn();

        const decision = permissions.handleToolCall('acp-call-1', 'execute', { command: 'ls -la' });
        expect(Object.keys(session.state().requests ?? {})).toEqual(['acp-call-1']);

        await session.answer({ id: 'acp-call-1', approved: true, decision: 'approved' });
        await decision;
        expect(Object.keys(session.state().completedRequests ?? {})).toEqual(['acp-call-1']);

        const start = mapper.mapMessage({
            type: 'tool-call',
            callId: 'acp-call-1',
            toolName: 'execute',
            args: { command: 'ls -la' },
        })[0];
        const end = mapper.mapMessage({
            type: 'tool-result',
            callId: 'acp-call-1',
            toolName: 'execute',
            result: 'total 12',
        })[0];

        expect(start.ev.t === 'tool-call-start' && start.ev.call).toBe('acp-call-1');
        expect(end.ev.t === 'tool-call-end' && end.ev.call).toBe('acp-call-1');
    });

    it('reports a denied step under that same id', async () => {
        const session = fakeSession();
        const permissions = new GenericAcpPermissionHandler(session.client, 'engine');

        const decision = permissions.handleToolCall('acp-call-2', 'execute', { command: 'rm -rf /' });
        await session.answer({ id: 'acp-call-2', approved: false, decision: 'denied' });

        expect(await decision).toEqual({ decision: 'denied' });
        expect(session.state().completedRequests?.['acp-call-2']).toMatchObject({
            status: 'denied',
            decision: 'denied',
            tool: 'execute',
        });
    });
});
