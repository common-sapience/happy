import { describe, expect, it, vi } from 'vitest';

vi.mock('@/text', () => ({ t: (key: string) => key }));

import { formatTranscriptDuration, resolveTranscriptStatus } from './kitTranscriptStatus';

describe('DESK-20 transcript status line', () => {
    it('shows a line while the agent works', () => {
        expect(resolveTranscriptStatus({ state: 'thinking', archived: false }))
            .toEqual({ visible: true, state: 'running', pulsing: true });
    });

    it('shows the same line for a permission request and for a question', () => {
        const permission = resolveTranscriptStatus({ state: 'permission_required', archived: false });
        const question = resolveTranscriptStatus({ state: 'input_required', archived: false });
        expect(permission).toEqual({ visible: true, state: 'waiting', pulsing: true });
        expect(question).toEqual(permission);
    });

    it('stays out of the way when there is nothing happening', () => {
        expect(resolveTranscriptStatus({ state: 'waiting', archived: false }).visible).toBe(false);
        expect(resolveTranscriptStatus({ state: 'thinking', archived: true }).visible).toBe(false);
        expect(resolveTranscriptStatus({ state: 'disconnected', archived: false }).visible).toBe(false);
    });
});

describe('DESK-20 durations', () => {
    it('drops the units that would read as zero', () => {
        expect(formatTranscriptDuration(4_200)).toBe('4s');
        expect(formatTranscriptDuration(125_000)).toBe('2m5s');
        expect(formatTranscriptDuration(3_780_000)).toBe('1h3m');
    });

    it('never reports a negative duration', () => {
        expect(formatTranscriptDuration(-1_000)).toBe('0s');
    });
});
