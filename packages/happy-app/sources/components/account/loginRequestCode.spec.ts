import { describe, expect, it } from 'vitest';
import { normalizeLoginRequestCode } from './loginRequestCode';

const key = 'A'.repeat(43);

describe('DESK-06 approving a computer that asked to join', () => {
    it('accepts the code as shown by the waiting computer', () => {
        expect(normalizeLoginRequestCode(key)).toBe(`happy:///account?${key}`);
    });

    it('accepts the whole link, and ignores whitespace around either form', () => {
        expect(normalizeLoginRequestCode(`  happy:///account?${key}\n`)).toBe(`happy:///account?${key}`);
    });

    it('refuses anything that is not a one-time key', () => {
        expect(normalizeLoginRequestCode('')).toBeNull();
        expect(normalizeLoginRequestCode('   ')).toBeNull();
        expect(normalizeLoginRequestCode('short')).toBeNull();
        expect(normalizeLoginRequestCode(`${key}!!`)).toBeNull();
    });

    it('refuses a link from another flow rather than approving the wrong thing', () => {
        expect(normalizeLoginRequestCode(`happy://terminal?${key}`)).toBeNull();
        expect(normalizeLoginRequestCode(`https://example.com/${key}`)).toBeNull();
        expect(normalizeLoginRequestCode(`happy:///account?${key}&machine=other`)).toBeNull();
    });
});
