import { describe, expect, it } from 'vitest';
import { resolveKitAgentStatusPresentation, type KitAgentStatus } from './kitAgentStatus';

describe('DESK-19 kit agent status', () => {
    it('animates the two live states and nothing else', () => {
        expect(resolveKitAgentStatusPresentation('running').animated).toBe(true);
        expect(resolveKitAgentStatusPresentation('waiting').animated).toBe(true);
        expect(resolveKitAgentStatusPresentation('idle').animated).toBe(false);
        expect(resolveKitAgentStatusPresentation('archived').animated).toBe(false);
    });

    it('gives waiting for an answer the strongest emphasis', () => {
        expect(resolveKitAgentStatusPresentation('waiting').emphasis).toBe('strong');
    });

    it('mutes an archived agent', () => {
        expect(resolveKitAgentStatusPresentation('archived').emphasis).toBe('muted');
    });

    it('always demands the word alongside the colour', () => {
        for (const status of ['running', 'idle', 'waiting', 'archived'] as KitAgentStatus[]) {
            expect(resolveKitAgentStatusPresentation(status).labelRequired).toBe(true);
        }
    });

    it('falls back to idle for a state the host has not taught the list yet', () => {
        const unknown = resolveKitAgentStatusPresentation('compacting' as KitAgentStatus);
        expect(unknown.emphasis).toBe('normal');
        expect(unknown.animated).toBe(false);
    });
});
