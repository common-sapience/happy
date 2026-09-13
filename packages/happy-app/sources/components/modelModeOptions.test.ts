import { describe, expect, it, vi } from 'vitest';

// The catalog reads its profile names from the translation table, which pulls in
// React Native; only the lookup matters here.
vi.mock('@/text', () => ({ t: (key: string) => key.split('.').at(-1) ?? key }));

import {
    findOptionByKey,
    getAvailableModels,
    getAvailablePermissionModes,
    groupModelModesByProvider,
    mapMetadataOptions,
    resolveCurrentOption,
} from './modelModeOptions';
import { listAgentProfiles } from '@/utils/agentProfiles';
import { ENGINE_INTERNAL_AGENT_PROFILE } from '@/utils/harnessCatalog';
import type { Metadata } from '@/sync/storageTypes';

function metadata(overrides: Partial<Metadata>): Metadata {
    return { path: '/work', host: 'laptop', ...overrides } as Metadata;
}

describe('DESK-10 agent profiles', () => {
    it('offers the product profiles before a session exists', () => {
        expect(getAvailablePermissionModes(null).map((mode) => mode.key))
            .toEqual(['default', 'plan', 'build']);
    });

    it('never offers the host\'s own consolidation profile', () => {
        const offered = getAvailablePermissionModes(null).map((mode) => mode.key);
        expect(offered).not.toContain(ENGINE_INTERNAL_AGENT_PROFILE);
        expect(listAgentProfiles().map((profile) => profile.key))
            .not.toContain(ENGINE_INTERNAL_AGENT_PROFILE);
    });

    it('names every offered profile in words rather than leaving a bare key', () => {
        for (const profile of listAgentProfiles()) {
            expect(profile.name.trim().length).toBeGreaterThan(0);
            expect(profile.name).not.toBe(profile.key);
            expect(profile.description.trim().length).toBeGreaterThan(0);
        }
    });

    it('prefers what the engine reports for a live session', () => {
        const modes = getAvailablePermissionModes(metadata({
            operatingModes: [
                { code: 'default', value: 'Default' },
                { code: 'research', value: 'Research' },
            ],
        }));
        expect(modes.map((mode) => mode.key)).toContain('research');
    });

    it('shows the profile a session actually runs on even when this build does not name it', () => {
        const modes = getAvailablePermissionModes(metadata({ agentProfile: 'bespoke' }));
        expect(modes[0].key).toBe('bespoke');
    });
});

describe('DESK-10 models', () => {
    it('offers nothing when the engine reports no models', () => {
        expect(getAvailableModels(null)).toEqual([]);
        expect(getAvailableModels(metadata({}))).toEqual([]);
    });

    it('offers exactly what the engine reported, in its order', () => {
        const models = getAvailableModels(metadata({
            models: [
                { code: 'gateway/a', value: 'Model A', provider: { id: 'gateway', kind: 'custom', name: 'Gateway' } },
                { code: 'gateway/b', value: 'Model B' },
            ],
        }));
        expect(models.map((model) => model.key)).toEqual(['gateway/a', 'gateway/b']);
        expect(models[0].providerName).toBe('Gateway');
    });

    it('groups models by the provider that published them', () => {
        const groups = groupModelModesByProvider([
            { key: 'a', name: 'A', providerId: 'one', providerName: 'One' },
            { key: 'b', name: 'B', providerId: 'two', providerName: 'Two' },
            { key: 'c', name: 'C', providerId: 'one', providerName: 'One' },
        ]);
        expect(groups.map((group) => group.key)).toEqual(['one', 'two']);
        expect(groups[0].models.map((model) => model.key)).toEqual(['a', 'c']);
    });
});

describe('option helpers', () => {
    it('maps engine-published options onto pickable rows', () => {
        expect(mapMetadataOptions([{ code: 'plan', value: 'Plan', description: 'read only' }]))
            .toEqual([{ key: 'plan', name: 'Plan', description: 'read only' }]);
        expect(mapMetadataOptions(null)).toEqual([]);
    });

    it('finds the first preference that is actually on offer', () => {
        const options = [{ key: 'a', name: 'A' }, { key: 'b', name: 'B' }];
        expect(resolveCurrentOption(options, ['missing', 'b'])?.key).toBe('b');
        expect(resolveCurrentOption(options, ['missing'])).toBeNull();
        expect(findOptionByKey(options, null)).toBeNull();
    });
});
