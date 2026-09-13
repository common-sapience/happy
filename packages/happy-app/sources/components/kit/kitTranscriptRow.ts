import type { Message, ToolCall } from '@/sync/typesMessage';
import { stringifyToolCommand } from '@/utils/toolCommand';

/**
 * What a message from the agent stream renders as. One column, five shapes: the
 * user's own message, the reply, an activity line, a thinking line, a notice.
 * Anything with nothing to show is dropped rather than drawn empty.
 */
export type TranscriptRowKind = 'user' | 'reply' | 'activity' | 'thinking' | 'notice' | 'hidden';

export function resolveTranscriptRowKind(message: Message): TranscriptRowKind {
    switch (message.kind) {
        case 'user-text':
            return message.text.trim().length === 0 ? 'hidden' : 'user';
        case 'agent-text':
            if (message.text.trim().length === 0) {
                return 'hidden';
            }
            return message.isThinking === true ? 'thinking' : 'reply';
        case 'tool-call':
            return message.tool ? 'activity' : 'hidden';
        case 'agent-event':
            return 'notice';
    }
}

/**
 * The verb an activity line opens with. It is derived from the engine's tool
 * category, never from the tool's own name: an MCP server's `server_method` and
 * the engine's own protocol words are technical detail, and DESK-01 keeps those
 * out of the line and inside the expansion.
 */
export type ActivityVerb = 'ran' | 'edited' | 'read' | 'searched' | 'fetched' | 'delegated' | 'used';

/** Whether the step stands, failed, or was refused. */
export type ActivityTone = 'normal' | 'failed' | 'declined';

export type TranscriptActivity = {
    verb: ActivityVerb;
    /** File name, command summary or page — whatever the verb acted on. */
    target: string | null;
    tone: ActivityTone;
    running: boolean;
    /** The tool and its arguments, shown only once the row is expanded. */
    raw: string;
};

/**
 * The engine reaches the transcript over ACP, so a tool arrives under its
 * protocol kind (`execute`, `edit`, `think`, `other`). The engine's own tool
 * names are accepted alongside them: both describe the same seven things, and
 * a name we have no word for is simply a tool the agent used.
 */
const VERB_BY_TOOL: Record<string, ActivityVerb> = {
    execute: 'ran',
    bash: 'ran',
    shell: 'ran',
    edit: 'edited',
    write: 'edited',
    patch: 'edited',
    apply_patch: 'edited',
    read: 'read',
    search: 'searched',
    grep: 'searched',
    glob: 'searched',
    list: 'searched',
    fetch: 'fetched',
    webfetch: 'fetched',
    websearch: 'fetched',
    think: 'delegated',
    task: 'delegated',
};

export function resolveActivityVerb(toolName: string): ActivityVerb {
    return VERB_BY_TOOL[toolName.trim().toLowerCase()] ?? 'used';
}

/**
 * Whether an activity could have changed the working tree. Reading, searching
 * and fetching cannot; everything else is assumed to, including a tool we have
 * no word for, because guessing the safe way round is the unsafe one.
 */
export function isMutableActivity(toolName: string): boolean {
    const verb = resolveActivityVerb(toolName);
    return verb !== 'read' && verb !== 'searched' && verb !== 'fetched';
}

const TARGET_PATH_KEYS = ['filePath', 'filepath', 'file_path', 'target_file', 'path', 'target_directory'];
const TARGET_TEXT_KEYS = ['pattern', 'query', 'url', 'objective', 'description', 'prompt'];

/** Protocol words a title may repeat; a title that is only one of them says nothing. */
const PROTOCOL_TITLES = new Set([
    ...Object.keys(VERB_BY_TOOL),
    'unknown',
    'other',
    'delete',
    'move',
    'switch_mode',
]);

function firstLine(value: string): string | null {
    const collapsed = value.replace(/\s+/gu, ' ').trim();
    return collapsed.length > 0 ? collapsed : null;
}

function readString(input: unknown, key: string): string | null {
    if (input === null || typeof input !== 'object') {
        return null;
    }
    const value = (input as Record<string, unknown>)[key];
    return typeof value === 'string' ? firstLine(value) : null;
}

/** A path reads as its file name: the directory it sits in is detail, not target. */
function fileName(path: string): string {
    const trimmed = path.replace(/\/+$/u, '');
    const lastSlash = trimmed.lastIndexOf('/');
    const name = lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
    return name.length > 0 ? name : trimmed;
}

function readLocationPath(input: unknown): string | null {
    if (input === null || typeof input !== 'object') {
        return null;
    }
    const locations = (input as { locations?: unknown }).locations;
    if (!Array.isArray(locations)) {
        return null;
    }
    for (const location of locations) {
        const path = readString(location, 'path');
        if (path) {
            return path;
        }
    }
    return null;
}

export function resolveActivityTarget(tool: Pick<ToolCall, 'name' | 'title' | 'input'>): string | null {
    const verb = resolveActivityVerb(tool.name);
    const input = tool.input;

    if (verb === 'ran') {
        const command = stringifyToolCommand(
            (input as { command?: unknown; cmd?: unknown } | null)?.command
            ?? (input as { cmd?: unknown } | null)?.cmd,
        );
        if (command) {
            return firstLine(command);
        }
    }

    for (const key of TARGET_PATH_KEYS) {
        const path = readString(input, key);
        if (path) {
            return fileName(path);
        }
    }

    const locationPath = readLocationPath(input);
    if (locationPath) {
        return verb === 'ran' ? locationPath : fileName(locationPath);
    }

    for (const key of TARGET_TEXT_KEYS) {
        const text = readString(input, key);
        if (text) {
            return text;
        }
    }

    const title = tool.title ? firstLine(tool.title) : null;
    if (title && !PROTOCOL_TITLES.has(title.toLowerCase())) {
        return title;
    }

    return null;
}

export function resolveActivityTone(tool: Pick<ToolCall, 'state' | 'permission'>): ActivityTone {
    const status = tool.permission?.status;
    if (status === 'denied' || status === 'canceled') {
        return 'declined';
    }
    return tool.state === 'error' ? 'failed' : 'normal';
}

export function resolveTranscriptRawCall(tool: Pick<ToolCall, 'name' | 'input'>): string {
    try {
        return JSON.stringify({ tool: tool.name, input: tool.input ?? null }, null, 2);
    } catch {
        return JSON.stringify({ tool: tool.name });
    }
}

export function resolveTranscriptActivity(
    tool: Pick<ToolCall, 'name' | 'title' | 'input' | 'state' | 'permission'>,
): TranscriptActivity {
    return {
        verb: resolveActivityVerb(tool.name),
        target: resolveActivityTarget(tool),
        tone: resolveActivityTone(tool),
        running: tool.state === 'running',
        raw: resolveTranscriptRawCall(tool),
    };
}

/**
 * How long the agent spent on a thinking block, measured to the message that
 * followed it. The last block of a turn has no successor yet, so its duration is
 * unknown and the row says only that it was thinking.
 *
 * Messages arrive newest first, so a block's successor is the entry before it.
 */
export function buildThinkingDurations(messages: Message[]): Map<string, number> {
    const durations = new Map<string, number>();
    for (let index = 0; index < messages.length; index++) {
        const message = messages[index];
        if (message.kind !== 'agent-text' || message.isThinking !== true) {
            continue;
        }
        const successor = messages[index - 1];
        if (!successor) {
            continue;
        }
        const durationMs = successor.createdAt - message.createdAt;
        if (durationMs > 0) {
            durations.set(message.id, durationMs);
        }
    }
    return durations;
}
