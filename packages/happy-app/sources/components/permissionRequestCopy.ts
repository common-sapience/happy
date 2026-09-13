/**
 * Turns a pending tool call into the words a permission card shows (DESK-03,
 * PERM-03): what the agent wants to do, what it wants to do it to, and how far
 * the answer reaches. Tool names and argument names never reach the card.
 *
 * The templates are fixed and deliberately few. An action no template covers
 * falls back to `useTool` and carries the raw call, so the user still sees
 * exactly what was asked rather than a reassuring guess.
 */
export type PermissionCategoryKey =
    | 'runCommand'
    | 'readFile'
    | 'createFile'
    | 'changeFile'
    | 'searchFiles'
    | 'fetchWeb'
    | 'searchWeb'
    | 'startHelper'
    | 'startChanges'
    | 'useTool';

export type PermissionScopeKey = 'folder' | 'computer' | 'web';

export type PermissionRequestCopy = {
    categoryKey: PermissionCategoryKey;
    /** The thing acted on, verbatim: a path, a command, a URL. */
    target: string;
    scopeKey: PermissionScopeKey;
    /** Present only when no template covers the action. */
    raw?: string;
};

type Template = {
    categoryKey: PermissionCategoryKey;
    scopeKey: PermissionScopeKey;
    target: (input: Record<string, unknown>) => string | undefined;
};

const firstString = (input: Record<string, unknown>, keys: readonly string[]): string | undefined => {
    for (const key of keys) {
        const value = input[key];
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
    }
    return undefined;
};

const PATH_KEYS = ['file_path', 'filePath', 'path', 'notebook_path'] as const;

/**
 * Keys are the engine's tool names and the ACP kinds they arrive under, since a
 * request reaches the control end over ACP and carries the kind rather than the
 * name. Both spellings of one action share a template.
 */
const TEMPLATES: Record<string, Template> = {
    execute: {
        categoryKey: 'runCommand',
        scopeKey: 'computer',
        target: (input) => firstString(input, ['command', 'cmd']),
    },
    search: {
        categoryKey: 'searchFiles',
        scopeKey: 'folder',
        target: (input) => firstString(input, ['pattern', 'query', ...PATH_KEYS]),
    },
    fetch: {
        categoryKey: 'fetchWeb',
        scopeKey: 'web',
        target: (input) => firstString(input, ['url']),
    },
    think: {
        categoryKey: 'startHelper',
        scopeKey: 'computer',
        target: (input) => firstString(input, ['description', 'prompt']),
    },
    patch: {
        categoryKey: 'changeFile',
        scopeKey: 'folder',
        target: (input) => firstString(input, PATH_KEYS),
    },
    bash: {
        categoryKey: 'runCommand',
        scopeKey: 'computer',
        target: (input) => firstString(input, ['command', 'cmd']),
    },
    read: {
        categoryKey: 'readFile',
        scopeKey: 'folder',
        target: (input) => firstString(input, PATH_KEYS),
    },
    write: {
        categoryKey: 'createFile',
        scopeKey: 'folder',
        target: (input) => firstString(input, PATH_KEYS),
    },
    edit: {
        categoryKey: 'changeFile',
        scopeKey: 'folder',
        target: (input) => firstString(input, PATH_KEYS),
    },
    multiedit: {
        categoryKey: 'changeFile',
        scopeKey: 'folder',
        target: (input) => firstString(input, PATH_KEYS),
    },
    notebookedit: {
        categoryKey: 'changeFile',
        scopeKey: 'folder',
        target: (input) => firstString(input, PATH_KEYS),
    },
    apply_patch: {
        categoryKey: 'changeFile',
        scopeKey: 'folder',
        target: (input) => firstString(input, PATH_KEYS),
    },
    glob: {
        categoryKey: 'searchFiles',
        scopeKey: 'folder',
        target: (input) => firstString(input, ['pattern', 'path']),
    },
    grep: {
        categoryKey: 'searchFiles',
        scopeKey: 'folder',
        target: (input) => firstString(input, ['pattern', 'path']),
    },
    list: {
        categoryKey: 'searchFiles',
        scopeKey: 'folder',
        target: (input) => firstString(input, PATH_KEYS),
    },
    ls: {
        categoryKey: 'searchFiles',
        scopeKey: 'folder',
        target: (input) => firstString(input, PATH_KEYS),
    },
    webfetch: {
        categoryKey: 'fetchWeb',
        scopeKey: 'web',
        target: (input) => firstString(input, ['url']),
    },
    websearch: {
        categoryKey: 'searchWeb',
        scopeKey: 'web',
        target: (input) => firstString(input, ['query']),
    },
    task: {
        categoryKey: 'startHelper',
        scopeKey: 'computer',
        target: (input) => firstString(input, ['description', 'subagent_type']),
    },
    exit_plan_mode: {
        categoryKey: 'startChanges',
        scopeKey: 'folder',
        target: () => undefined,
    },
    exitplanmode: {
        categoryKey: 'startChanges',
        scopeKey: 'folder',
        target: () => undefined,
    },
};

/** A long command or patch is the card's body, not its headline. */
const MAX_TARGET_LENGTH = 240;

function clamp(value: string): string {
    const collapsed = value.replace(/\s+/g, ' ').trim();
    return collapsed.length > MAX_TARGET_LENGTH
        ? `${collapsed.slice(0, MAX_TARGET_LENGTH - 1)}…`
        : collapsed;
}

function asRecord(input: unknown): Record<string, unknown> {
    return input !== null && typeof input === 'object' && !Array.isArray(input)
        ? input as Record<string, unknown>
        : {};
}

function serializeRaw(toolName: string, input: unknown): string {
    const record = asRecord(input);
    if (Object.keys(record).length === 0) {
        return toolName;
    }
    try {
        return `${toolName} ${JSON.stringify(record)}`;
    } catch {
        return toolName;
    }
}

export function resolvePermissionRequestCopy({ toolName, toolInput }: {
    toolName: string;
    toolInput?: unknown;
}): PermissionRequestCopy {
    const input = asRecord(toolInput);
    const template = TEMPLATES[toolName.toLowerCase()];
    if (!template) {
        return {
            categoryKey: 'useTool',
            target: clamp(toolName),
            scopeKey: 'computer',
            raw: serializeRaw(toolName, toolInput),
        };
    }

    const target = template.target(input);
    return {
        categoryKey: template.categoryKey,
        target: target ? clamp(target) : '',
        scopeKey: template.scopeKey,
    };
}
