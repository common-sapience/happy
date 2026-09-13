import { describe, expect, it } from 'vitest';
import {
    resolveKitSettingsRowIconColor,
    resolveKitSettingsRowTitleColor,
    type KitSettingsRowTokens,
    type KitSettingsRowTone,
} from './kitSettingsRow';

const tokens: KitSettingsRowTokens = {
    text: '#FFFFFF',
    secondary: '#8E8E93',
    accent: '#0A84FF',
    destructive: '#FF453A',
    warning: '#FF9F0A',
    success: '#32D74B',
};

describe('DESK-19 kit settings row tones', () => {
    it('takes every glyph colour from a token', () => {
        expect(resolveKitSettingsRowIconColor('accent', tokens)).toBe(tokens.accent);
        expect(resolveKitSettingsRowIconColor('destructive', tokens)).toBe(tokens.destructive);
        expect(resolveKitSettingsRowIconColor('warning', tokens)).toBe(tokens.warning);
        expect(resolveKitSettingsRowIconColor('success', tokens)).toBe(tokens.success);
    });

    it('keeps an untoned row neutral rather than accenting everything', () => {
        expect(resolveKitSettingsRowIconColor('neutral', tokens)).toBe(tokens.secondary);
        expect(resolveKitSettingsRowIconColor('link' as KitSettingsRowTone, tokens)).toBe(tokens.secondary);
    });

    it('colours the title only when the row itself is destructive', () => {
        expect(resolveKitSettingsRowTitleColor('destructive', tokens)).toBe(tokens.destructive);
        expect(resolveKitSettingsRowTitleColor('accent', tokens)).toBe(tokens.text);
        expect(resolveKitSettingsRowTitleColor('neutral', tokens)).toBe(tokens.text);
    });
});
