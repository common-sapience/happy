import { describe, expect, it } from 'vitest';
import { matchesAgentSearch, type AgentSearchable } from './agentListSearch';

const agent = (overrides: Partial<AgentSearchable> = {}): AgentSearchable => ({
    name: 'Fix the login redirect',
    projectName: 'storefront',
    workspaceName: 'release-3',
    path: '/home/lee/code/storefront',
    machineName: 'workbench',
    ...overrides,
});

describe('DESK-11 the sidebar search', () => {
    it('shows every agent while the field is empty or blank', () => {
        expect(matchesAgentSearch(agent(), '')).toBe(true);
        expect(matchesAgentSearch(agent(), '   ')).toBe(true);
    });

    it('matches the name regardless of case', () => {
        expect(matchesAgentSearch(agent(), 'LOGIN')).toBe(true);
        expect(matchesAgentSearch(agent(), 'redirect')).toBe(true);
    });

    it('finds the agents working in a place, not only those named after it', () => {
        for (const needle of ['storefront', 'release-3', 'code/storefront', 'workbench']) {
            expect(matchesAgentSearch(agent({ name: 'Untitled' }), needle)).toBe(true);
        }
    });

    it('hides an agent nothing about it matches', () => {
        expect(matchesAgentSearch(agent(), 'checkout')).toBe(false);
    });

    it('survives an agent the host sent without a place', () => {
        const bare = agent({ projectName: null, workspaceName: null, path: null, machineName: null });
        expect(matchesAgentSearch(bare, 'storefront')).toBe(false);
        expect(matchesAgentSearch(bare, 'login')).toBe(true);
    });
});
