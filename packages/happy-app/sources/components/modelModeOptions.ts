import type { Metadata } from '@/sync/storageTypes';
import { hackModes } from '@/sync/modeHacks';
import { sortPermissionModes } from '@/utils/permissionModeLabels';
import { listAgentProfiles } from '@/utils/agentProfiles';

/**
 * What the composer and the conversation can offer, and nothing else.
 *
 * There is one agent and one engine (D-12), so there are no per-vendor catalogs
 * here: every option on this screen comes from what the engine itself publishes
 * in session metadata. A session that reports no models gets no model picker,
 * and there is no effort scale at all — the engine does not expose one.
 *
 * The engine publishes its agent profiles (ENG-17) as ACP modes, which arrive as
 * `metadata.operatingModes` and are selected through the session's
 * `permissionMode` field. So a "mode" in this file means an agent profile; the
 * wire keeps the older field name.
 */
export type ModeOption = {
    key: string;
    name: string;
    description?: string | null;
    disabled?: boolean;
};

export type PermissionMode = ModeOption;
export type ModelMode = ModeOption & {
    modelId?: string;
    providerId?: string;
    providerName?: string;
};

export type PermissionModeKey = string;
export type ModelModeKey = string;

export type ModelModeProviderGroup = {
    key: string;
    title: string | null;
    models: ModelMode[];
};

/**
 * Group models without sorting them. Provider groups keep the order in which
 * the engine first publishes each provider, and rows keep their wire order.
 */
export function groupModelModesByProvider(models: readonly ModelMode[]): ModelModeProviderGroup[] {
    const groups = new Map<string, ModelModeProviderGroup>();
    for (const model of models) {
        const providerId = model.providerId?.trim() || null;
        const key = providerId ?? '__models__';
        let group = groups.get(key);
        if (!group) {
            group = {
                key,
                title: model.providerName?.trim() || providerId,
                models: [],
            };
            groups.set(key, group);
        }
        group.models.push(model);
    }
    return [...groups.values()];
}

type MetadataOption = {
    code: string;
    value: string;
    description?: string | null;
};

export function mapMetadataOptions(options?: MetadataOption[] | null): ModeOption[] {
    if (!options || options.length === 0) {
        return [];
    }

    return options.map((option) => ({
        key: option.code,
        name: option.value,
        description: option.description ?? null,
    }));
}

/**
 * The models this session can switch to. Empty when the engine publishes none,
 * and the picker is then absent rather than showing an invented default: the
 * model a session runs on belongs to its profile and to the platform gateway.
 */
export function getAvailableModels(metadata: Metadata | null | undefined): ModelMode[] {
    const models: ModelMode[] = [];
    for (const model of metadata?.models ?? []) {
        const key = model.code?.trim() || model.id?.trim();
        if (!key) continue;
        models.push({
            key,
            name: model.name?.trim() || model.value?.trim() || key,
            description: model.description ?? null,
            modelId: model.id?.trim() || key,
            providerId: model.provider?.id ?? model.providerId,
            providerName: model.provider?.name ?? model.providerName,
        });
    }
    return models;
}

/**
 * The agent profiles this session can switch to: what the engine reports for it,
 * falling back to the names the product itself offers when a session predates
 * the report. The internal consolidation profile is never among them — the
 * daemon marks those sessions internal and they never reach a picker.
 */
export function getAvailablePermissionModes(
    metadata: Metadata | null | undefined,
    selectedKey?: string | null,
): PermissionMode[] {
    const reported = sortPermissionModes(hackModes(mapMetadataOptions(metadata?.operatingModes)));
    const modes = reported.length > 0
        ? reported
        : listAgentProfiles().map((profile) => ({
            key: profile.key,
            name: profile.name,
            description: profile.description,
        }));

    const current = selectedKey
        ?? metadata?.currentOperatingModeCode
        ?? metadata?.permissionMode
        ?? metadata?.agentProfile;
    // A profile the host config defines but this build does not name still has
    // to be shown, or the conversation would claim the session runs on a
    // profile it does not.
    if (current && !modes.some((mode) => mode.key === current)) {
        return [{ key: current, name: current, description: null }, ...modes];
    }
    return modes;
}

export function findOptionByKey<T extends ModeOption>(options: T[], key: string | null | undefined): T | null {
    if (!key) {
        return null;
    }
    return options.find((option) => option.key === key) ?? null;
}

export function resolveCurrentOption<T extends ModeOption>(
    options: T[],
    preferredKeys: Array<string | null | undefined>,
): T | null {
    for (const key of preferredKeys) {
        const option = findOptionByKey(options, key);
        if (option) {
            return option;
        }
    }
    return null;
}
