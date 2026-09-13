import { describe, expect, it } from 'vitest';
import {
    GLASS_MEDIA_QUERIES,
    NO_GLASS_ACCESSIBILITY_PREFERENCES,
    readGlassAccessibilityPreferences,
    resolveConcentricRadius,
    resolveWebGlassSurface,
    type GlassMaterialTokens,
} from './glassWebMaterial';

const tokens: GlassMaterialTokens = {
    blur: { liquid: 32, static: 20, frosted: 44 },
    saturate: { liquid: 1.8, static: 1.4, frosted: 1.2 },
    borderWidth: 1,
    elevation: { offset: 8, radius: 24 },
    background: 'rgba(255, 255, 255, 0.68)',
    backgroundStrong: 'rgba(255, 255, 255, 0.84)',
    backgroundSubtle: 'rgba(255, 255, 255, 0.42)',
    border: 'rgba(255, 255, 255, 0.82)',
    divider: 'rgba(60, 60, 67, 0.12)',
    shadow: 'rgba(39, 47, 54, 0.16)',
    opaque: '#F7F7FA',
    sheen: ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.40)'],
};

const OPAQUE_BORDER = '#eaeaea';

function surfaceFor(material: 'liquid' | 'static' | 'frosted', preferences = NO_GLASS_ACCESSIBILITY_PREFERENCES) {
    return resolveWebGlassSurface({ material, tokens, preferences, opaqueBorderColor: OPAQUE_BORDER });
}

describe('DESK-18 web glass material mapping', () => {
    it('blurs and saturates each of the three materials from the glass tokens', () => {
        expect(surfaceFor('liquid').backdropFilter).toBe('blur(32px) saturate(1.8)');
        expect(surfaceFor('static').backdropFilter).toBe('blur(20px) saturate(1.4)');
        expect(surfaceFor('frosted').backdropFilter).toBe('blur(44px) saturate(1.2)');
    });

    it('tints lightest for navigation glass and densest for writing surfaces', () => {
        expect(surfaceFor('static').backgroundColor).toBe(tokens.backgroundSubtle);
        expect(surfaceFor('liquid').backgroundColor).toBe(tokens.background);
        expect(surfaceFor('frosted').backgroundColor).toBe(tokens.backgroundStrong);
    });

    it('takes border, shadow and sheen from the glass tokens', () => {
        const surface = surfaceFor('liquid');
        expect(surface.borderWidth).toBe(tokens.borderWidth);
        expect(surface.borderColor).toBe(tokens.border);
        expect(surface.boxShadow).toBe('0px 8px 24px rgba(39, 47, 54, 0.16)');
        expect(surface.sheen).toBe(tokens.sheen);
        expect(surface.motionEnabled).toBe(true);
    });

    it('drops the shadow for flush chrome and keeps it for floating chrome', () => {
        expect(surfaceFor('static').boxShadow).toBe('none');
        expect(surfaceFor('frosted').boxShadow).not.toBe('none');
        expect(
            resolveWebGlassSurface({ material: 'liquid', tokens, opaqueBorderColor: OPAQUE_BORDER, elevated: false }).boxShadow,
        ).toBe('none');
    });
});

describe('DESK-18 glass accessibility fallbacks', () => {
    it('falls back to an opaque surface under reduced transparency', () => {
        const surface = surfaceFor('liquid', {
            ...NO_GLASS_ACCESSIBILITY_PREFERENCES,
            reducedTransparency: true,
        });

        expect(surface.backdropFilter).toBeUndefined();
        expect(surface.backgroundColor).toBe(tokens.opaque);
        expect(surface.sheen).toBeNull();
        expect(surface.borderColor).toBe(OPAQUE_BORDER);
    });

    it('falls back to an opaque surface when the browser has no backdrop-filter', () => {
        const surface = resolveWebGlassSurface({
            material: 'frosted',
            tokens,
            opaqueBorderColor: OPAQUE_BORDER,
            supportsBackdropFilter: false,
        });

        expect(surface.backdropFilter).toBeUndefined();
        expect(surface.backgroundColor).toBe(tokens.opaque);
        expect(surface.sheen).toBeNull();
    });

    it('drops translucency and the sheen, and solidifies the hairline, under increased contrast', () => {
        const surface = surfaceFor('static', {
            ...NO_GLASS_ACCESSIBILITY_PREFERENCES,
            increasedContrast: true,
        });

        expect(surface.backdropFilter).toBe('blur(20px)');
        expect(surface.backgroundColor).toBe(tokens.backgroundStrong);
        expect(surface.borderColor).toBe(OPAQUE_BORDER);
        expect(surface.sheen).toBeNull();
    });

    it('reports motion off under reduced motion while keeping the material', () => {
        const surface = surfaceFor('liquid', {
            ...NO_GLASS_ACCESSIBILITY_PREFERENCES,
            reducedMotion: true,
        });

        expect(surface.motionEnabled).toBe(false);
        expect(surface.backdropFilter).toBe('blur(32px) saturate(1.8)');
    });

    it('reads all three preferences from their media queries', () => {
        const asked: string[] = [];
        const preferences = readGlassAccessibilityPreferences((query) => {
            asked.push(query);
            return query === GLASS_MEDIA_QUERIES.increasedContrast;
        });

        expect(asked).toEqual([
            '(prefers-reduced-transparency: reduce)',
            '(prefers-contrast: more)',
            '(prefers-reduced-motion: reduce)',
        ]);
        expect(preferences).toEqual({
            reducedTransparency: false,
            increasedContrast: true,
            reducedMotion: false,
        });
    });
});

describe('DESK-18 concentric radii', () => {
    it('insets the inner radius by the gap to the outer container', () => {
        expect(resolveConcentricRadius(28, 8)).toBe(20);
        expect(resolveConcentricRadius(12, 1)).toBe(11);
    });

    it('never goes negative when the inset is larger than the radius', () => {
        expect(resolveConcentricRadius(4, 12)).toBe(0);
    });
});
