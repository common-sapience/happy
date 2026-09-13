import { describe, expect, it } from 'vitest';
import { MOBILE_COMPOSER_METRICS } from '../agentInputLayout';
import { resolveKitComposerAction, resolveKitComposerShell } from './kitComposer';

describe('DESK-19 kit composer shell', () => {
    it('is the writing surface, never chrome', () => {
        expect(resolveKitComposerShell({ density: 'regular', regularRadius: 28 }).surfaceRole).toBe('writing');
    });

    it('keeps the capsule corner on phone widths', () => {
        const compact = resolveKitComposerShell({ density: 'compact', regularRadius: 28 });
        expect(compact.borderRadius).toBe(MOBILE_COMPOSER_METRICS.shellRadius);
    });

    it('takes the desktop corner from the radius scale', () => {
        const regular = resolveKitComposerShell({ density: 'regular', regularRadius: 28 });
        expect(regular.borderRadius).toBe(28);
    });

    it('shares one set of insets across both densities so the bar does not shift', () => {
        const compact = resolveKitComposerShell({ density: 'compact', regularRadius: 28 });
        const regular = resolveKitComposerShell({ density: 'regular', regularRadius: 28 });
        expect(regular.paddingHorizontal).toBe(compact.paddingHorizontal);
        expect(regular.paddingTop).toBe(compact.paddingTop);
        expect(regular.paddingBottom).toBe(compact.paddingBottom);
        expect(regular.minHeight).toBe(compact.minHeight);
    });
});

describe('DESK-19 kit composer primary action', () => {
    it('holds one circle of the same size whatever the action is', () => {
        const send = resolveKitComposerAction('send');
        const stop = resolveKitComposerAction('stop');
        const disabled = resolveKitComposerAction('disabled');
        expect(send.size).toBe(MOBILE_COMPOSER_METRICS.primaryActionSize);
        expect(stop.size).toBe(send.size);
        expect(disabled.size).toBe(send.size);
        expect(send.borderRadius).toBe(send.size / 2);
    });

    it('fills the circle for send and stop and empties it when nothing can be sent', () => {
        expect(resolveKitComposerAction('send').filled).toBe(true);
        expect(resolveKitComposerAction('stop').filled).toBe(true);
        expect(resolveKitComposerAction('disabled').filled).toBe(false);
    });

    it('demands a label because the control carries no text', () => {
        expect(resolveKitComposerAction('send').accessibilityLabelRequired).toBe(true);
    });
});
