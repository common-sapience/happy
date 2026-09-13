import { describe, expect, it } from 'vitest';

import { compactCount } from './gitLineChanges';

describe('compactCount', () => {
    it('keeps counts below one thousand exact', () => {
        expect(compactCount(0)).toBe('0');
        expect(compactCount(842)).toBe('842');
        expect(compactCount(999)).toBe('999');
    });

    it('uses useful tenths below five thousand', () => {
        expect(compactCount(1_000)).toBe('1k');
        expect(compactCount(1_200)).toBe('1.2k');
        expect(compactCount(4_038)).toBe('4k');
        expect(compactCount(4_238)).toBe('4.2k');
        expect(compactCount(4_950)).toBe('5k');
    });

    it('rounds larger counts to whole thousands', () => {
        expect(compactCount(5_300)).toBe('5k');
        expect(compactCount(12_800)).toBe('13k');
    });
});
