import { describe, expect, it } from 'vitest';

import { resolveMachineAgent } from './newSessionAgentSelection';
import { ENGINE_AGENT } from './harnessCatalog';

describe('resolveMachineAgent', () => {
    it('resolves to the engine whatever the draft asked for', () => {
        expect(resolveMachineAgent(ENGINE_AGENT, undefined)).toBe(ENGINE_AGENT);
    });

    it('resolves to the engine when a machine reports no capabilities', () => {
        expect(resolveMachineAgent(ENGINE_AGENT, {})).toBe(ENGINE_AGENT);
    });
});
