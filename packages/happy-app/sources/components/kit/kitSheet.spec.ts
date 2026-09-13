import { describe, expect, it } from 'vitest';
import { resolveKitSheetGeometry } from './kitSheet';

const base = { maxWidth: 360, margin: 24, radius: 28, contentInset: 12 };

describe('DESK-19 kit sheet geometry', () => {
    it('is the floating layer', () => {
        expect(resolveKitSheetGeometry({ ...base, viewportWidth: 1200 }).surfaceRole).toBe('floating');
    });

    it('stops growing at its own width on a wide window', () => {
        expect(resolveKitSheetGeometry({ ...base, viewportWidth: 1200 }).width).toBe(360);
    });

    it('keeps its margin on a narrow window', () => {
        expect(resolveKitSheetGeometry({ ...base, viewportWidth: 320 }).width).toBe(272);
    });

    it('derives the inner corner from the outer one, not from a second value', () => {
        const sheet = resolveKitSheetGeometry({ ...base, viewportWidth: 1200 });
        expect(sheet.contentRadius).toBe(sheet.borderRadius - base.contentInset);
    });

    it('never rounds a corner past half the sheet', () => {
        const narrow = resolveKitSheetGeometry({ ...base, viewportWidth: 60, radius: 28 });
        expect(narrow.borderRadius).toBeLessThanOrEqual(narrow.width / 2);
        expect(narrow.contentRadius).toBeGreaterThanOrEqual(0);
    });

    it('falls back to its own width when the window has not been measured', () => {
        expect(resolveKitSheetGeometry({ ...base, viewportWidth: Number.NaN }).width).toBe(360);
    });
});
