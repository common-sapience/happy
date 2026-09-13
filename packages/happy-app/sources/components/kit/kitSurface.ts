import type { GlassMaterial } from '../glassWebMaterial';

/**
 * Where a kit surface sits in the layer stack. Glass is a functional layer:
 * navigation chrome, floating panels and the writing surface get it, content
 * never does (DESK-18, DESK-19).
 */
export type KitSurfaceRole = 'chrome' | 'floating' | 'writing' | 'content';

export type KitSurfaceResolution = {
    glass: boolean;
    material: GlassMaterial;
    elevated: boolean;
};

export function resolveKitSurface(role: KitSurfaceRole): KitSurfaceResolution {
    switch (role) {
        case 'chrome':
            return { glass: true, material: 'static', elevated: false };
        case 'floating':
            return { glass: true, material: 'liquid', elevated: true };
        case 'writing':
            return { glass: true, material: 'frosted', elevated: true };
        default:
            return { glass: false, material: 'liquid', elevated: false };
    }
}

/**
 * One glass layer per place on screen: a glass surface nested inside another
 * glass surface is flattened to content rather than stacked.
 */
export function resolveNestedKitSurfaceRole(
    outer: KitSurfaceRole,
    inner: KitSurfaceRole,
): KitSurfaceRole {
    return resolveKitSurface(outer).glass && resolveKitSurface(inner).glass ? 'content' : inner;
}

/**
 * An icon button may draw smaller than the minimum hit target as long as its
 * pressable area reaches it; the slack is spread evenly around the glyph.
 */
export function resolveKitHitSlop(visualSize: number, minTouchTarget: number): number {
    if (!Number.isFinite(visualSize) || !Number.isFinite(minTouchTarget)) {
        return 0;
    }
    return Math.max(0, Math.ceil((minTouchTarget - visualSize) / 2));
}
