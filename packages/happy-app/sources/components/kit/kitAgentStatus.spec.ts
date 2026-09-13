import { describe, expect, it } from 'vitest';
import {
    resolveKitAgentStatusPresentation,
    type KitAgentStatus,
    type KitAgentStatusTokens,
} from './kitAgentStatus';

const tokens: KitAgentStatusTokens = {
    running: '#34C759',
    waiting: '#FF9F0A',
    idle: '#8E8E93',
    archived: '#48484A',
};

describe('DESK-19 kit agent status', () => {
    it('animates the two live states and nothing else', () => {
        expect(resolveKitAgentStatusPresentation('running', tokens).animated).toBe(true);
        expect(resolveKitAgentStatusPresentation('waiting', tokens).animated).toBe(true);
        expect(resolveKitAgentStatusPresentation('idle', tokens).animated).toBe(false);
        expect(resolveKitAgentStatusPresentation('archived', tokens).animated).toBe(false);
    });

    it('gives waiting for an answer the strongest emphasis', () => {
        expect(resolveKitAgentStatusPresentation('waiting', tokens).emphasis).toBe('strong');
        expect(resolveKitAgentStatusPresentation('waiting', tokens).dotColor).toBe(tokens.waiting);
    });

    it('mutes an archived agent', () => {
        const archived = resolveKitAgentStatusPresentation('archived', tokens);
        expect(archived.emphasis).toBe('muted');
        expect(archived.dotColor).toBe(tokens.archived);
    });

    it('always demands the word alongside the colour', () => {
        for (const status of ['running', 'idle', 'waiting', 'archived'] as KitAgentStatus[]) {
            expect(resolveKitAgentStatusPresentation(status, tokens).labelRequired).toBe(true);
        }
    });

    it('falls back to idle for a state the host has not taught the list yet', () => {
        const unknown = resolveKitAgentStatusPresentation('compacting' as KitAgentStatus, tokens);
        expect(unknown.dotColor).toBe(tokens.idle);
        expect(unknown.animated).toBe(false);
    });
});
