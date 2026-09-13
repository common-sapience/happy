import { describe, expect, it } from 'vitest';
import {
    resolveKitHitSlop,
    resolveKitSurface,
    resolveNestedKitSurfaceRole,
    type KitSurfaceRole,
} from './kitSurface';

describe('DESK-19 kit surface roles', () => {
    it('gives navigation chrome the flush static material', () => {
        expect(resolveKitSurface('chrome')).toEqual({ glass: true, material: 'static', elevated: false });
    });

    it('gives floating panels the liquid material and a drop', () => {
        expect(resolveKitSurface('floating')).toEqual({ glass: true, material: 'liquid', elevated: true });
    });

    it('gives the writing surface the densest material so the transcript cannot compete', () => {
        expect(resolveKitSurface('writing')).toEqual({ glass: true, material: 'frosted', elevated: true });
    });

    it('keeps content opaque', () => {
        expect(resolveKitSurface('content').glass).toBe(false);
    });

    it('falls back to opaque content for an unknown role', () => {
        expect(resolveKitSurface('banner' as KitSurfaceRole).glass).toBe(false);
    });
});

describe('DESK-19 kit surface nesting', () => {
    it('flattens glass nested inside glass', () => {
        expect(resolveNestedKitSurfaceRole('floating', 'writing')).toBe('content');
        expect(resolveNestedKitSurfaceRole('chrome', 'chrome')).toBe('content');
    });

    it('keeps glass when the surface underneath is content', () => {
        expect(resolveNestedKitSurfaceRole('content', 'floating')).toBe('floating');
    });
});

describe('DESK-19 kit hit targets', () => {
    it('pads a small glyph out to the minimum touch target', () => {
        expect(resolveKitHitSlop(20, 44)).toBe(12);
    });

    it('adds nothing once the control already reaches the minimum', () => {
        expect(resolveKitHitSlop(44, 44)).toBe(0);
        expect(resolveKitHitSlop(60, 44)).toBe(0);
    });

    it('rounds up so an odd remainder never lands under the minimum', () => {
        expect(resolveKitHitSlop(21, 44)).toBe(12);
    });

    it('returns no slack for a non-numeric measurement', () => {
        expect(resolveKitHitSlop(Number.NaN, 44)).toBe(0);
    });
});
