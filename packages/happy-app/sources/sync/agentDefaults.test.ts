import { describe, expect, it } from 'vitest';
import {
    getCodeAgentDefaults,
    resolveAgentDefaultConfig,
} from './agentDefaults';

describe('agent defaults', () => {
    it('starts on the engine profile that has everything switched on', () => {
        expect(getCodeAgentDefaults('opencode').permissionMode).toBe('default');
        expect(resolveAgentDefaultConfig({}, 'opencode').permissionMode).toBe('default');
    });

    it('keeps an explicit profile override', () => {
        expect(resolveAgentDefaultConfig(
            { opencode: { permissionMode: 'plan' } },
            'opencode',
        ).permissionMode).toBe('plan');
    });
});
