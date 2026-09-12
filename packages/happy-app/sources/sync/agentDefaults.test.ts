import { describe, expect, it } from 'vitest';
import {
    getCodeAgentDefaults,
    resolveAgentDefaultConfig,
} from './agentDefaults';

describe('agent defaults', () => {
    it('uses Auto as the code default for the engine', () => {
        expect(getCodeAgentDefaults('opencode').permissionMode).toBe('auto');
    });

    it('falls back to Default on an old CLI', () => {
        expect(getCodeAgentDefaults('opencode', '1.2.0').permissionMode).toBe('default');
        expect(resolveAgentDefaultConfig({}, 'opencode', '1.2.1-beta.1').permissionMode).toBe('default');
        expect(resolveAgentDefaultConfig({}, 'opencode', '1.2.0').permissionMode).toBe('default');
        expect(resolveAgentDefaultConfig({}, 'opencode', 'not-a-version').permissionMode).toBe('default');
    });

    it('keeps Auto on a new or unknown-version CLI', () => {
        expect(resolveAgentDefaultConfig({}, 'opencode', '1.2.1-beta.2').permissionMode).toBe('auto');
        expect(resolveAgentDefaultConfig({}, 'opencode', '1.3.0').permissionMode).toBe('auto');
        expect(resolveAgentDefaultConfig({}, 'opencode').permissionMode).toBe('auto');
    });

    it('does not rewrite an explicit YOLO override for an old CLI', () => {
        expect(resolveAgentDefaultConfig(
            { opencode: { permissionMode: 'bypassPermissions' } },
            'opencode',
            '1.2.0',
        ).permissionMode).toBe('bypassPermissions');
    });

    it('leaves an explicit unsupported Auto override available for the send path to reject', () => {
        expect(resolveAgentDefaultConfig(
            { opencode: { permissionMode: 'auto' } },
            'opencode',
            '1.2.0',
        ).permissionMode).toBe('auto');
    });
});
