import { describe, expect, it } from 'vitest';
import {
    resolveKitMessageRowMaxWidth,
    resolveKitMessageRowPresentation,
    type KitMessageAuthor,
} from './kitMessageRow';

describe('DESK-19 kit message row', () => {
    it('boxes the user message and pins it to the trailing edge', () => {
        const user = resolveKitMessageRowPresentation('user');
        expect(user.bubble).toBe(true);
        expect(user.align).toBe('flex-end');
        expect(user.maxWidthRatio).toBeLessThan(1);
    });

    it('lays the reply flat across the column with no box', () => {
        const agent = resolveKitMessageRowPresentation('agent');
        expect(agent.bubble).toBe(false);
        expect(agent.align).toBe('flex-start');
        expect(agent.maxWidthRatio).toBe(1);
    });

    it('centres an activity line and mutes it', () => {
        const event = resolveKitMessageRowPresentation('event');
        expect(event.align).toBe('center');
        expect(event.emphasis).toBe('muted');
    });

    it('never puts glass under a message', () => {
        for (const author of ['user', 'agent', 'event'] as KitMessageAuthor[]) {
            expect(resolveKitMessageRowPresentation(author).surfaceRole).toBe('content');
        }
    });

    it('falls back to the flat reply layout for an unknown author', () => {
        const unknown = resolveKitMessageRowPresentation('system' as KitMessageAuthor);
        expect(unknown.bubble).toBe(false);
        expect(unknown.maxWidthRatio).toBe(1);
    });
});

describe('DESK-19 kit message row width', () => {
    it('takes its share of the column', () => {
        expect(resolveKitMessageRowMaxWidth(500, 0.82)).toBe(410);
    });

    it('clamps a ratio outside the unit range', () => {
        expect(resolveKitMessageRowMaxWidth(500, 2)).toBe(500);
        expect(resolveKitMessageRowMaxWidth(500, -1)).toBe(0);
    });

    it('returns nothing before the column has been measured', () => {
        expect(resolveKitMessageRowMaxWidth(0, 0.82)).toBe(0);
        expect(resolveKitMessageRowMaxWidth(Number.NaN, 0.82)).toBe(0);
    });
});
