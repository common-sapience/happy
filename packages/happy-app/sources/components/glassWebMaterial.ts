import * as React from 'react';

/**
 * Web/desktop backend for the glass material (DESK-18, T-18).
 *
 * The backend is CSS `backdrop-filter` plus a layered tint, hairline border and
 * sheen — the fallback path of rdev/liquid-glass-react (MIT), which is the only
 * part of that work portable here. An SVG displacement filter for refraction and
 * a WebGL shader for the full material are both out: Safari rasterises large
 * displacement maps per frame, and both repaint the whole surface whenever the
 * content behind it scrolls, which is exactly when chrome must stay cheap.
 *
 * Everything here is pure so the mapping and its accessibility fallbacks are
 * testable without a DOM; the React hook at the bottom is the only stateful part.
 */

export type GlassMaterial = 'liquid' | 'static' | 'frosted';

export type GlassAccessibilityPreferences = {
    reducedTransparency: boolean;
    increasedContrast: boolean;
    reducedMotion: boolean;
};

/** Media queries behind the three accessibility switches the material honors. */
export const GLASS_MEDIA_QUERIES = {
    reducedTransparency: '(prefers-reduced-transparency: reduce)',
    increasedContrast: '(prefers-contrast: more)',
    reducedMotion: '(prefers-reduced-motion: reduce)',
} as const;

export const NO_GLASS_ACCESSIBILITY_PREFERENCES: GlassAccessibilityPreferences = {
    reducedTransparency: false,
    increasedContrast: false,
    reducedMotion: false,
};

/** Values the material needs out of the theme's `glass` token group. */
export type GlassMaterialTokens = {
    blur: { liquid: number; static: number; frosted: number };
    saturate: { liquid: number; static: number; frosted: number };
    borderWidth: number;
    elevation: { offset: number; radius: number };
    background: string;
    backgroundStrong: string;
    backgroundSubtle: string;
    border: string;
    divider: string;
    shadow: string;
    opaque: string;
    sheen: readonly [string, string, string];
};

export type WebGlassSurface = {
    backgroundColor: string;
    /** Absent whenever the material is switched off. */
    backdropFilter?: string;
    borderWidth: number;
    borderColor: string;
    /** 'none' for chrome that sits flush, a soft drop for chrome that floats. */
    boxShadow: string;
    /** Three-stop gradient painted inside the surface, or null when flattened. */
    sheen: readonly [string, string, string] | null;
    /** False when the material must not animate at all. */
    motionEnabled: boolean;
};

/**
 * Tint per material: liquid is the lightest so navigation reads as glass,
 * frosted the densest so text on top of it never competes with the backdrop.
 */
function resolveTint(material: GlassMaterial, tokens: GlassMaterialTokens): string {
    switch (material) {
        case 'static':
            return tokens.backgroundSubtle;
        case 'frosted':
            return tokens.backgroundStrong;
        default:
            return tokens.background;
    }
}

export function resolveWebGlassSurface({
    material,
    tokens,
    preferences = NO_GLASS_ACCESSIBILITY_PREFERENCES,
    opaqueBorderColor,
    supportsBackdropFilter = true,
    elevated = material !== 'static',
}: {
    material: GlassMaterial;
    tokens: GlassMaterialTokens;
    preferences?: GlassAccessibilityPreferences;
    /** Solid border used once the material is flattened; the theme's divider. */
    opaqueBorderColor: string;
    supportsBackdropFilter?: boolean;
    /**
     * Whether the surface floats over content. The static material is the
     * flush chrome — title bars, toolbars, tab bars — so it carries no drop.
     */
    elevated?: boolean;
}): WebGlassSurface {
    const boxShadow = elevated
        ? `0px ${tokens.elevation.offset}px ${tokens.elevation.radius}px ${tokens.shadow}`
        : 'none';
    const motionEnabled = !preferences.reducedMotion;

    // Readability wins over material: no blur, no sheen, a solid edge.
    if (preferences.reducedTransparency || !supportsBackdropFilter) {
        return {
            backgroundColor: tokens.opaque,
            borderWidth: tokens.borderWidth,
            borderColor: opaqueBorderColor,
            boxShadow,
            sheen: null,
            motionEnabled,
        };
    }

    const blur = tokens.blur[material];
    const saturate = tokens.saturate[material];

    // Increased contrast keeps the blur but drops the translucency that makes
    // foreground text sit on an unpredictable backdrop, and turns the
    // translucent hairline into a solid line.
    if (preferences.increasedContrast) {
        return {
            backgroundColor: tokens.backgroundStrong,
            backdropFilter: `blur(${blur}px)`,
            borderWidth: tokens.borderWidth,
            borderColor: opaqueBorderColor,
            boxShadow,
            sheen: null,
            motionEnabled,
        };
    }

    return {
        backgroundColor: resolveTint(material, tokens),
        backdropFilter: `blur(${blur}px) saturate(${saturate})`,
        borderWidth: tokens.borderWidth,
        borderColor: tokens.border,
        boxShadow,
        sheen: tokens.sheen,
        motionEnabled,
    };
}

/**
 * Nested containers share one centre: the inner radius is the outer radius less
 * the gap between them, never a second value picked by hand.
 */
export function resolveConcentricRadius(outerRadius: number, inset: number): number {
    return Math.max(0, outerRadius - inset);
}

export function readGlassAccessibilityPreferences(
    matches: (query: string) => boolean,
): GlassAccessibilityPreferences {
    return {
        reducedTransparency: matches(GLASS_MEDIA_QUERIES.reducedTransparency),
        increasedContrast: matches(GLASS_MEDIA_QUERIES.increasedContrast),
        reducedMotion: matches(GLASS_MEDIA_QUERIES.reducedMotion),
    };
}

function queryMatches(query: string): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    try {
        return window.matchMedia(query).matches;
    } catch {
        // A browser that does not know the query reports neither support nor an
        // error in a useful way; treat it as "not requested".
        return false;
    }
}

export function supportsBackdropFilter(): boolean {
    if (typeof window === 'undefined' || typeof window.CSS === 'undefined' || typeof window.CSS.supports !== 'function') {
        return false;
    }
    return window.CSS.supports('backdrop-filter', 'blur(1px)')
        || window.CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
}

/** Live accessibility preferences; re-renders when the user flips a switch. */
export function useGlassAccessibilityPreferences(): GlassAccessibilityPreferences {
    const [preferences, setPreferences] = React.useState<GlassAccessibilityPreferences>(
        () => readGlassAccessibilityPreferences(queryMatches),
    );

    React.useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }
        const sync = () => setPreferences(readGlassAccessibilityPreferences(queryMatches));
        const lists = Object.values(GLASS_MEDIA_QUERIES).map((query) => {
            try {
                return window.matchMedia(query);
            } catch {
                return null;
            }
        });
        for (const list of lists) {
            list?.addEventListener?.('change', sync);
        }
        sync();
        return () => {
            for (const list of lists) {
                list?.removeEventListener?.('change', sync);
            }
        };
    }, []);

    return preferences;
}
