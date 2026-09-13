import { describe, expect, it, vi } from 'vitest';

vi.mock('@/text', () => ({ t: (key: string) => key }));

import { agentListStateColor, agentListStateLabel, resolveAgentListState } from './agentListState';
import type { Theme } from '@/theme';

const theme = {
    colors: {
        status: { connected: '#connected' },
        permission: { bypass: '#attention' },
        textSecondary: '#neutral',
    },
} as unknown as Theme;

describe('DESK-11 the four agent states', () => {
    it('reports a working agent as running', () => {
        expect(resolveAgentListState({ state: 'thinking', archived: false })).toBe('running');
    });

    it('reports an agent with nothing to do as idle', () => {
        expect(resolveAgentListState({ state: 'waiting', archived: false })).toBe('idle');
    });

    it('gives a permission request and the agent\'s own question the same word', () => {
        expect(resolveAgentListState({ state: 'permission_required', archived: false })).toBe('waiting');
        expect(resolveAgentListState({ state: 'input_required', archived: false })).toBe('waiting');
        expect(agentListStateLabel('waiting')).toBe('harness.stateWaiting');
    });

    it('reports retired work and an unreachable host as archived', () => {
        expect(resolveAgentListState({ state: 'waiting', archived: true })).toBe('archived');
        expect(resolveAgentListState({ state: 'disconnected', archived: false })).toBe('archived');
    });

    it('has exactly four words, one per state', () => {
        const labels = (['running', 'idle', 'waiting', 'archived'] as const).map(agentListStateLabel);
        expect(new Set(labels).size).toBe(4);
    });

    it('tints only the states that want attention, and never relies on colour alone', () => {
        expect(agentListStateColor('running', theme)).toBe('#connected');
        expect(agentListStateColor('waiting', theme)).toBe('#attention');
        expect(agentListStateColor('idle', theme)).toBe('#neutral');
        expect(agentListStateColor('archived', theme)).toBe('#neutral');
        for (const state of ['running', 'idle', 'waiting', 'archived'] as const) {
            expect(agentListStateLabel(state).length).toBeGreaterThan(0);
        }
    });
});
