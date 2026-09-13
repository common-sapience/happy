import * as z from 'zod';
import { AgentDefaultOverridesSchema } from './agentDefaults';
import { DEFAULT_USER_MESSAGE_BUBBLE_COLOR } from '../utils/userMessageBubbleColor';

//
// Settings Schema
//

// Current schema version for backward compatibility
export const SUPPORTED_SCHEMA_VERSION = 2;


export const SettingsSchema = z.object({
    // Schema version for compatibility detection
    schemaVersion: z.number().default(SUPPORTED_SCHEMA_VERSION).describe('Settings schema version for compatibility checks'),

    viewInline: z.boolean().describe('Legacy inline tool-call preference (no longer used)'),
    inferenceOpenAIKey: z.string().nullish().describe('OpenAI API key for inference'),
    expandTodos: z.boolean().describe('Legacy todo expansion preference (no longer used)'),
    showLineNumbers: z.boolean().describe('Legacy diff line-number preference (no longer used)'),
    showLineNumbersInToolViews: z.boolean().describe('Whether to show line numbers in tool view diffs'),
    wrapLinesInDiffs: z.boolean().describe('Legacy diff line-wrapping preference (no longer used)'),
    diffStyle: z.enum(['unified', 'split']).describe('Diff view style (split is web-only)'),
    analyticsOptOut: z.boolean().describe('Whether to opt out of anonymous analytics'),
    experiments: z.boolean().describe('Enable current experiments: the Rig session file browser and the Usage settings page'),
    userMessageBubbleColor: z.string().describe('User message bubble color preset'),
    // DESK-17: the product shows no usage badge under the input, so this has no
    // settings row and stays at its default. The field remains because settings
    // sync field by field with app versions that still write it.
    alwaysShowContextSize: z.boolean().describe('Always show context and plan usage under the agent input'),

    // Drives the archive-visibility toggle: it hides archived sessions, not
    // merely disconnected ones. The key keeps its original name because these
    // settings sync between devices and app versions field by field, with no
    // rename migration to carry an old key across.
    hideInactiveSessions: z.boolean().describe('Hide archived sessions in the main list'),
    sortSessionsByActivity: z.boolean().describe('Legacy session sort preference (no longer used)'),
    // Resume is capability-driven; this legacy rollout key still protects the
    // newer fork/duplicate RPC on older daemons.
    expResumeSession: z.boolean().describe('Enable session fork and duplicate actions'),
    // DESK-17: the sidebar is a product default, not a choice — it has no
    // settings row and keeps its default value.
    fileDiffsSidebar: z.boolean().describe('Show the file changes sidebar next to the chat on desktop'),
    groupToolCalls: z.boolean().describe('Collapse consecutive tool calls into grouped containers in chat'),
    reviewPromptAnswered: z.boolean().describe('Whether the review prompt has been answered'),
    reviewPromptLikedApp: z.boolean().nullish().describe('Whether user liked the app when asked'),
    voiceAssistantLanguage: z.string().nullable().describe('Preferred language for voice assistant (null for auto-detect)'),
    voiceCustomAgentId: z.string().nullable().describe('Custom ElevenLabs agent ID (null to use Happy default)'),
    voiceBypassToken: z.boolean().describe('Bypass Happy server token and connect directly to ElevenLabs (requires custom agent ID)'),
    preferredLanguage: z.string().nullable().describe('Preferred UI language (null for auto-detect from device locale)'),
    recentMachinePaths: z.array(z.object({
        machineId: z.string(),
        path: z.string()
    })).describe('Last 10 machine-path combinations, ordered by most recent first'),
    lastUsedAgent: z.string().nullable().describe('Last selected agent type for new sessions'),
    lastUsedPermissionMode: z.string().nullable().describe('Last selected permission mode for new sessions'),
    lastUsedModelMode: z.string().nullable().describe('Last selected model mode for new sessions'),
    agentDefaultOverrides: AgentDefaultOverridesSchema.describe('User-selected agent defaults. Missing values use code defaults and are not sent as agent metadata.'),
    // Dismissed CLI warning banners (supports both per-machine and global dismissal)
    dismissedCLIWarnings: z.object({
        perMachine: z.record(z.string(), z.object({
            claude: z.boolean().optional(),
            codex: z.boolean().optional(),
            gemini: z.boolean().optional(),
            openclaw: z.boolean().optional(),
        })).default({}),
        global: z.object({
            claude: z.boolean().optional(),
            codex: z.boolean().optional(),
            gemini: z.boolean().optional(),
            openclaw: z.boolean().optional(),
        }).default({}),
    }).default({ perMachine: {}, global: {} }).describe('Tracks which CLI installation warnings user has dismissed (per-machine or globally)'),
});

//
// NOTE: Settings must be a flat object with no to minimal nesting, one field == one setting,
// you can name them with a prefix if you want to group them, but don't nest them.
// You can nest if value is a single value (like image with url and width and height)
// Settings are always merged with defaults and field by field.
//
// This structure must be forward and backward compatible. Meaning that some versions of the app
// could be missing some fields or have a new fields. Everything must be preserved and client must
// only touch the fields it knows about.
//

const SettingsSchemaPartial = SettingsSchema.partial();

export type Settings = z.infer<typeof SettingsSchema>;

//
// Defaults
//

export const settingsDefaults: Settings = {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    viewInline: false,
    inferenceOpenAIKey: null,
    expandTodos: true,
    showLineNumbers: true,
    showLineNumbersInToolViews: false,
    wrapLinesInDiffs: true,
    diffStyle: 'unified',
    analyticsOptOut: false,
    experiments: false,
    userMessageBubbleColor: DEFAULT_USER_MESSAGE_BUBBLE_COLOR,
    alwaysShowContextSize: false,

    hideInactiveSessions: true,
    sortSessionsByActivity: true,
    expResumeSession: true,
    fileDiffsSidebar: true,
    groupToolCalls: false,
    reviewPromptAnswered: false,
    reviewPromptLikedApp: null,
    voiceAssistantLanguage: null,
    voiceCustomAgentId: null,
    voiceBypassToken: false,
    preferredLanguage: null,
    recentMachinePaths: [],
    lastUsedAgent: null,
    lastUsedPermissionMode: null,
    lastUsedModelMode: null,
    agentDefaultOverrides: {},
    dismissedCLIWarnings: { perMachine: {}, global: {} },
};
Object.freeze(settingsDefaults);

//
// Resolving
//

export function settingsParse(settings: unknown): Settings {
    // Handle null/undefined/invalid inputs
    if (!settings || typeof settings !== 'object') {
        return { ...settingsDefaults };
    }

    const parsed = SettingsSchemaPartial.safeParse(settings);
    if (!parsed.success) {
        // For invalid settings, preserve unknown fields but use defaults for known fields
        const unknownFields = { ...(settings as any) };
        // Remove all known schema fields from unknownFields
        const knownFields = Object.keys(SettingsSchema.shape);
        knownFields.forEach(key => delete unknownFields[key]);
        return { ...settingsDefaults, ...unknownFields };
    }

    // Migration: Convert old 'zh' language code to 'zh-Hans'
    if (parsed.data.preferredLanguage === 'zh') {
        console.log('[Settings Migration] Converting language code from "zh" to "zh-Hans"');
        parsed.data.preferredLanguage = 'zh-Hans';
    }

    // Merge defaults, parsed settings, and preserve unknown fields
    const unknownFields = { ...(settings as any) };
    // Remove known fields from unknownFields to preserve only the unknown ones
    Object.keys(parsed.data).forEach(key => delete unknownFields[key]);

    return { ...settingsDefaults, ...parsed.data, ...unknownFields };
}

//
// Applying changes
// NOTE: May be something more sophisticated here around defaults and merging, but for now this is fine.
//

export function applySettings(settings: Settings, delta: Partial<Settings>): Settings {
    // Original behavior: start with settings, apply delta, fill in missing with defaults
    const result = { ...settings, ...delta };

    // Fill in any missing fields with defaults
    Object.keys(settingsDefaults).forEach(key => {
        if (!(key in result)) {
            (result as any)[key] = (settingsDefaults as any)[key];
        }
    });

    return result;
}

export function settingsToSyncPayload(settings: Settings): Partial<Settings> {
    const result: Partial<Settings> = { ...settings };
    const compactAgentOverrides = Object.fromEntries(
        Object.entries(settings.agentDefaultOverrides ?? {}).filter(([, value]) => (
            value && typeof value === 'object' && Object.keys(value).length > 0
        )),
    ) as Settings['agentDefaultOverrides'];
    if (Object.keys(compactAgentOverrides).length === 0) {
        delete result.agentDefaultOverrides;
    } else {
        result.agentDefaultOverrides = compactAgentOverrides;
    }
    return result;
}
