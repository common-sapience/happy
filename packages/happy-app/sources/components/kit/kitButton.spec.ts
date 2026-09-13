import { describe, expect, it } from 'vitest';
import {
    KIT_BUTTON_DISABLED_OPACITY,
    resolveKitButtonAppearance,
    type KitButtonTokens,
    type KitButtonVariant,
} from './kitButton';

const tokens: KitButtonTokens = {
    primaryBackground: '#0A84FF',
    primaryTint: '#FFFFFF',
    primaryDisabled: '#C0C0C0',
    secondaryTint: '#8E8E93',
    destructiveTint: '#FF453A',
};

describe('DESK-19 kit button variants', () => {
    it('fills only the primary action and puts it on a glass capsule', () => {
        const primary = resolveKitButtonAppearance({ variant: 'primary', tokens });
        expect(primary.filled).toBe(true);
        expect(primary.backgroundColor).toBe(tokens.primaryBackground);
        expect(primary.textColor).toBe(tokens.primaryTint);
        expect(primary.surfaceRole).toBe('floating');
    });

    it('leaves the secondary action as plain text on content', () => {
        const secondary = resolveKitButtonAppearance({ variant: 'secondary', tokens });
        expect(secondary.filled).toBe(false);
        expect(secondary.backgroundColor).toBe('transparent');
        expect(secondary.textColor).toBe(tokens.secondaryTint);
        expect(secondary.surfaceRole).toBe('content');
    });

    it('keeps a destructive action as text until it is the confirmed action', () => {
        const inline = resolveKitButtonAppearance({ variant: 'destructive', tokens });
        expect(inline.filled).toBe(false);
        expect(inline.textColor).toBe(tokens.destructiveTint);

        const confirmed = resolveKitButtonAppearance({ variant: 'destructive', tokens, confirming: true });
        expect(confirmed.filled).toBe(true);
        expect(confirmed.backgroundColor).toBe(tokens.destructiveTint);
        expect(confirmed.textColor).toBe(tokens.primaryTint);
    });

    it('never reads the accent for a disabled fill', () => {
        const disabled = resolveKitButtonAppearance({ variant: 'primary', tokens, disabled: true });
        expect(disabled.backgroundColor).toBe(tokens.primaryDisabled);
        expect(disabled.opacity).toBe(KIT_BUTTON_DISABLED_OPACITY);
    });

    it('treats an unknown variant as a secondary action rather than a filled one', () => {
        const unknown = resolveKitButtonAppearance({ variant: 'ghost' as KitButtonVariant, tokens });
        expect(unknown.filled).toBe(false);
        expect(unknown.textColor).toBe(tokens.secondaryTint);
    });
});
