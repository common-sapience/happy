/**
 * Session operations for remote procedure calls
 * Provides strictly typed functions for all session-related RPC operations
 */

import { apiSocket } from './apiSocket';
import { sync } from './sync';
import { storage } from './storage';
import type { AgentQuestionAnswer, MachineMetadata, SessionAgentModesPatch } from './storageTypes';
import { markAgentModePushPending, clearAgentModePushPending, type AgentModeField } from './agentModesPending';
import type { NewSessionAgentType } from './persistence';

export type { SessionAgentModesPatch };

// Strict type definitions for all operations

// Permission operation types
interface SessionPermissionRequest {
    id: string;
    approved: boolean;
    reason?: string;
    mode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
    allowTools?: string[];
    updatedInput?: Record<string, unknown>;
    decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort';
}

/**
 * Reply to an agent-to-user communication. Separate from the permission channel
 * on purpose: nothing here approves or denies an action, it carries information
 * the agent asked for. `kind` mirrors the request so the agent can route the
 * reply once other kinds of communication exist.
 */
interface SessionCommunicationReply {
    id: string;
    kind: string;
    status: 'answered' | 'cancelled';
    answers?: Record<string, AgentQuestionAnswer>;
}

// Mode change operation types
interface SessionModeChangeRequest {
    to: 'remote' | 'local';
}

interface SessionGoalActionRequest {
    action: 'clear' | 'stop' | 'edit';
    objective?: string;
}

// Bash operation types
interface SessionBashRequest {
    command: string;
    cwd?: string;
    timeout?: number;
}

interface SessionBashResponse {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
}

// Read file operation types
interface SessionReadFileRequest {
    path: string;
}

interface SessionReadFileResponse {
    success: boolean;
    content?: string; // base64 encoded
    error?: string;
}

// Write file operation types
interface SessionWriteFileRequest {
    path: string;
    content: string; // base64 encoded
    expectedHash?: string | null;
}

interface SessionWriteFileResponse {
    success: boolean;
    hash?: string;
    error?: string;
}

// List directory operation types
interface SessionListDirectoryRequest {
    path: string;
}

interface DirectoryEntry {
    name: string;
    type: 'file' | 'directory' | 'other';
    size?: number;
    modified?: number;
}

interface SessionListDirectoryResponse {
    success: boolean;
    entries?: DirectoryEntry[];
    error?: string;
}

// Directory tree operation types
interface SessionGetDirectoryTreeRequest {
    path: string;
    maxDepth: number;
}

interface TreeNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: number;
    children?: TreeNode[];
}

interface SessionGetDirectoryTreeResponse {
    success: boolean;
    tree?: TreeNode;
    error?: string;
}

// Ripgrep operation types
interface SessionRipgrepRequest {
    args: string[];
    cwd?: string;
}

interface SessionRipgrepResponse {
    success: boolean;
    exitCode?: number;
    stdout?: string;
    stderr?: string;
    error?: string;
}

// Kill session operation types
interface SessionKillRequest {
    // No parameters needed
}

interface SessionKillResponse {
    success: boolean;
    message: string;
}

// Response types for spawn session
export type SpawnSessionResult =
    | { type: 'success'; sessionId: string }
    | { type: 'pending'; clientRequestId: string; retryAfterMs: number }
    | { type: 'requestToApproveDirectoryCreation'; directory: string }
    | { type: 'error'; errorMessage: string };

// Options for spawning a session
export interface SpawnSessionOptions {
    machineId: string;
    directory: string;
    approvedNewDirectoryCreation?: boolean;
    token?: string;
    agent?: NewSessionAgentType;
    /**
     * HOST-12: the engine agent profile the session runs under. The profile is defined in the
     * engine's managed config and carries the tool and skill allow-list, so the control end only
     * names it; the host binds the session to it at creation.
     */
    agentProfile?: string;
    /** Idempotency key so a retried spawn cannot create a second session. */
    clientRequestId?: string;
    /** Happy session id this fork was branched from (lineage). */
    parentSessionId?: string;
    /** Happy message id used as the rewind point (only set for "duplicate"). */
    forkedFromMessageId?: string;
    /** Marks the spawned session as a hidden side chat of `parentSessionId`. */
}

// Exported session operation functions

/**
 * Spawn a new remote session on a specific machine
 */
export async function machineSpawnNewSession(options: SpawnSessionOptions): Promise<SpawnSessionResult> {

    const { machineId, directory, approvedNewDirectoryCreation = false, token, agent, agentProfile, clientRequestId, parentSessionId, forkedFromMessageId } = options;

    try {
        type DirectorySpawnRequest = {
            type: 'spawn-in-directory'
            directory: string
            approvedNewDirectoryCreation?: boolean,
            token?: string,
            agent?: NewSessionAgentType,
            agentProfile?: string,
            clientRequestId?: string,
            parentSessionId?: string,
            forkedFromMessageId?: string,
        };
        type SpawnRequest = DirectorySpawnRequest;
        const request: SpawnRequest = { type: 'spawn-in-directory', directory, approvedNewDirectoryCreation, token, agent, agentProfile, clientRequestId, parentSessionId, forkedFromMessageId };
        const result = await apiSocket.machineRPC<SpawnSessionResult, SpawnRequest>(
            machineId,
            'spawn-happy-session',
            request,
        );
        return result;
    } catch (error) {
        // Handle RPC errors
        return {
            type: 'error',
            errorMessage: error instanceof Error ? error.message : 'Failed to spawn session'
        };
    }
}

/**
 * Permanently remove a machine from the server. Sessions spawned by the
 * machine are preserved; only the Machine row and its AccessKeys are deleted.
 */
export async function machineDelete(machineId: string): Promise<{ success: boolean; message?: string }> {
    try {
        const response = await apiSocket.request(`/v1/machines/${machineId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            return { success: true };
        }
        const error = await response.text();
        return { success: false, message: error || 'Failed to delete machine' };
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Ask the daemon that started a session to stop it, by SIGTERM to the process
 * it is tracking.
 *
 * This is the only stop that reaches a session which has only just been
 * spawned. `sessionKill` talks to the session's own RPC handler, which does not
 * exist until that process is up and has registered it, and it needs the
 * session's encryption key, which arrives with the sessions list — so for the
 * first seconds of a session's life it fails on both counts. The daemon's
 * socket, by contrast, is the one we just spawned through.
 */
export async function machineStopSession(
    machineId: string,
    sessionId: string,
): Promise<{ success: boolean; message?: string }> {
    try {
        const result = await apiSocket.machineRPC<{ message: string }, { sessionId: string }>(
            machineId,
            'stop-session',
            { sessionId },
        );
        return { success: true, message: result?.message };
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to stop session',
        };
    }
}

/**
 * Stop the daemon on a specific machine
 */
export async function machineStopDaemon(machineId: string): Promise<{ message: string }> {
    const result = await apiSocket.machineRPC<{ message: string }, {}>(
        machineId,
        'stop-daemon',
        {}
    );
    return result;
}

/**
 * Execute a bash command on a specific machine
 */
export async function machineBash(
    machineId: string,
    command: string,
    cwd: string
): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
}> {
    try {
        const result = await apiSocket.machineRPC<{
            success: boolean;
            stdout: string;
            stderr: string;
            exitCode: number;
        }, {
            command: string;
            cwd: string;
        }>(
            machineId,
            'bash',
            { command, cwd }
        );
        return result;
    } catch (error) {
        return {
            success: false,
            stdout: '',
            stderr: error instanceof Error ? error.message : 'Unknown error',
            exitCode: -1
        };
    }
}

/**
 * Update machine metadata with optimistic concurrency control and automatic retry
 */
export async function machineUpdateMetadata(
    machineId: string,
    metadata: MachineMetadata,
    expectedVersion: number,
    maxRetries: number = 3
): Promise<{ version: number; metadata: string }> {
    let currentVersion = expectedVersion;
    let currentMetadata = { ...metadata };
    let retryCount = 0;

    const machineEncryption = sync.encryption.getMachineEncryption(machineId);
    if (!machineEncryption) {
        throw new Error(`Machine encryption not found for ${machineId}`);
    }

    while (retryCount < maxRetries) {
        const encryptedMetadata = await machineEncryption.encryptRaw(currentMetadata);

        const result = await apiSocket.emitWithAck<{
            result: 'success' | 'version-mismatch' | 'error';
            version?: number;
            metadata?: string;
            message?: string;
        }>('machine-update-metadata', {
            machineId,
            metadata: encryptedMetadata,
            expectedVersion: currentVersion
        });

        if (result.result === 'success') {
            return {
                version: result.version!,
                metadata: result.metadata!
            };
        } else if (result.result === 'version-mismatch') {
            // Get the latest version and metadata from the response
            currentVersion = result.version!;
            const latestMetadata = await machineEncryption.decryptRaw(result.metadata!) as MachineMetadata;

            // Merge our changes with the latest metadata
            // Preserve the displayName we're trying to set, but use latest values for other fields
            currentMetadata = {
                ...latestMetadata,
                displayName: metadata.displayName // Keep our intended displayName change
            };

            retryCount++;

            // If we've exhausted retries, throw error
            if (retryCount >= maxRetries) {
                throw new Error(`Failed to update after ${maxRetries} retries due to version conflicts`);
            }

            // Otherwise, loop will retry with updated version and merged metadata
        } else {
            throw new Error(result.message || 'Failed to update machine metadata');
        }
    }

    throw new Error('Unexpected error in machineUpdateMetadata');
}

/**
 * Persist per-session mode picks into synced session metadata with optimistic
 * concurrency and automatic retry. On version conflict the latest metadata is
 * taken from the server via the schema-free raw decrypt, so fields this app
 * version doesn't know about survive the read-modify-write.
 */
async function sessionUpdateAgentModesMetadata(
    sessionId: string,
    patch: SessionAgentModesPatch,
    maxRetries: number = 3
): Promise<void> {
    const encryption = sync.encryption.getSessionEncryption(sessionId);
    const session = storage.getState().sessions[sessionId];
    if (!encryption || !session?.metadata) {
        throw new Error(`Session ${sessionId} is not ready for metadata updates`);
    }

    // Defensive copy: retries drop fields from the patch (see below)
    let pendingPatch: SessionAgentModesPatch = { ...patch };
    let currentVersion = session.metadataVersion;
    let currentMetadata: Record<string, unknown> = { ...session.metadata, ...pendingPatch };

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const encrypted = await encryption.encryptRaw(currentMetadata);
        const result = await apiSocket.emitWithAck<{
            result: 'success' | 'version-mismatch' | 'error';
            version?: number;
            metadata?: string;
        }>('update-metadata', {
            sid: sessionId,
            metadata: encrypted,
            expectedVersion: currentVersion
        });

        if (result.result === 'success') {
            return;
        }
        if (result.result === 'version-mismatch') {
            currentVersion = result.version!;
            const latest = await encryption.decryptRaw(result.metadata!);
            if (!latest) {
                throw new Error('Failed to decrypt latest session metadata');
            }
            // A newer local action (another pick, an abort clearing modes) may
            // have changed the mirror since this push started — that action
            // owns the field now, and blindly replaying the original patch
            // would resurrect a pick the user already cleared.
            const liveSession = storage.getState().sessions[sessionId];
            for (const field of Object.keys(pendingPatch) as (keyof SessionAgentModesPatch)[]) {
                if ((liveSession?.[field] ?? null) !== (pendingPatch[field] ?? null)) {
                    delete pendingPatch[field];
                }
            }
            if (Object.keys(pendingPatch).length === 0) {
                return;
            }
            currentMetadata = { ...latest, ...pendingPatch };
            continue;
        }
        throw new Error('Failed to update session metadata');
    }

    throw new Error(`Failed to update session metadata after ${maxRetries} retries due to version conflicts`);
}

/**
 * Apply a per-session model / effort pick: updates local state immediately for
 * a snappy UI and pushes the pick into synced session metadata so other
 * devices receive it through the update-session broadcast. Never throws — a
 * failed push leaves the optimistic local value, and the next inbound
 * metadata update reconciles the UI.
 */
export function sessionSetAgentModes(sessionId: string, patch: SessionAgentModesPatch): void {
    const state = storage.getState();
    const session = state.sessions[sessionId];

    // Only touch fields that actually change — clearing modes on a session
    // with no picks (e.g. every abort) must not cost a metadata round-trip.
    // A pick counts as changed when it differs from the local mirror OR from
    // synced metadata: a local-only value (e.g. the EnterPlanMode auto-switch
    // writes the mirror without metadata) must still be pushed when the user
    // picks it explicitly, or other devices never see it.
    const isChanged = (value: string | null, field: keyof SessionAgentModesPatch): boolean => {
        const mirror = session?.[field] ?? null;
        const metaRaw = session?.metadata?.[field];
        const meta = metaRaw === undefined ? null : (metaRaw ?? null);
        return value !== mirror || value !== meta;
    };
    const changed: SessionAgentModesPatch = {};
    if (patch.permissionMode !== undefined && isChanged(patch.permissionMode, 'permissionMode')) {
        changed.permissionMode = patch.permissionMode;
    }
    if (patch.modelMode !== undefined && isChanged(patch.modelMode, 'modelMode')) {
        changed.modelMode = patch.modelMode;
    }
    if (patch.effortLevel !== undefined && isChanged(patch.effortLevel, 'effortLevel')) {
        changed.effortLevel = patch.effortLevel;
    }
    if (Object.keys(changed).length === 0) {
        return;
    }

    state.updateSessionAgentModes(sessionId, changed);

    // While the push is in flight, inbound updates still carry the OLD
    // metadata; mark the fields pending so applySessions keeps the fresher
    // local mirror instead of bouncing the pick back.
    const changedFields = Object.keys(changed) as AgentModeField[];
    markAgentModePushPending(sessionId, changedFields);
    sessionUpdateAgentModesMetadata(sessionId, changed)
        .catch((error) => {
            console.error(`Failed to sync agent modes for session ${sessionId}`, error);
        })
        .finally(() => {
            clearAgentModePushPending(sessionId, changedFields);
        });
}

/**
 * Abort the current session operation
 */
export async function sessionAbort(sessionId: string): Promise<void> {
    await apiSocket.sessionRPC(sessionId, 'abort', {
        reason: `The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.`
    });
}

/**
 * Allow a permission request
 */
export async function sessionAllow(sessionId: string, id: string, mode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan', allowedTools?: string[], decision?: 'approved' | 'approved_for_session', updatedInput?: Record<string, unknown>): Promise<void> {
    const request: SessionPermissionRequest = { id, approved: true, mode, allowTools: allowedTools, decision, updatedInput };
    await apiSocket.sessionRPC(sessionId, 'permission', request);
}

/**
 * Answer a question the agent asked. The reply carries back the same `kind` the
 * agent published, so the agent can route it without guessing.
 */
export async function sessionAnswerQuestion(
    sessionId: string,
    id: string,
    answers: Record<string, AgentQuestionAnswer>,
    kind: string = 'form',
): Promise<void> {
    const reply: SessionCommunicationReply = { id, kind, status: 'answered', answers };
    await apiSocket.sessionRPC(sessionId, 'communication', reply);
}

/**
 * Dismiss a communication without answering it.
 */
export async function sessionCancelCommunication(
    sessionId: string,
    id: string,
    kind: string = 'form',
): Promise<void> {
    const reply: SessionCommunicationReply = { id, kind, status: 'cancelled' };
    await apiSocket.sessionRPC(sessionId, 'communication', reply);
}

/**
 * Deny a permission request
 */
export async function sessionDeny(sessionId: string, id: string, mode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan', allowedTools?: string[], decision?: 'denied' | 'abort'): Promise<void> {
    const request: SessionPermissionRequest = { id, approved: false, mode, allowTools: allowedTools, decision };
    await apiSocket.sessionRPC(sessionId, 'permission', request);
}

/**
 * Request mode change for a session
 */
export async function sessionSwitch(sessionId: string, to: 'remote' | 'local'): Promise<boolean> {
    const request: SessionModeChangeRequest = { to };
    const response = await apiSocket.sessionRPC<boolean, SessionModeChangeRequest>(
        sessionId,
        'switch',
        request,
    );
    return response;
}

/**
 * Request an agent-owned goal action.
 */
export async function sessionGoalAction(
    sessionId: string,
    action: SessionGoalActionRequest['action'],
    objective?: string,
): Promise<void> {
    await apiSocket.sessionRPC(sessionId, 'goal-action', {
        action,
        ...(objective !== undefined ? { objective } : {}),
    } satisfies SessionGoalActionRequest);
}

/**
 * Execute a bash command in the session
 */
export async function sessionBash(sessionId: string, request: SessionBashRequest): Promise<SessionBashResponse> {
    try {
        const response = await apiSocket.sessionRPC<SessionBashResponse, SessionBashRequest>(
            sessionId,
            'bash',
            request
        );
        return response;
    } catch (error) {
        return {
            success: false,
            stdout: '',
            stderr: error instanceof Error ? error.message : 'Unknown error',
            exitCode: -1,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Read a file from the session
 */
export async function sessionReadFile(sessionId: string, path: string): Promise<SessionReadFileResponse> {
    try {
        const request: SessionReadFileRequest = { path };
        const response = await apiSocket.sessionRPC<SessionReadFileResponse, SessionReadFileRequest>(
            sessionId,
            'readFile',
            request
        );
        return response;
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Write a file to the session
 */
export async function sessionWriteFile(
    sessionId: string,
    path: string,
    content: string,
    expectedHash?: string | null
): Promise<SessionWriteFileResponse> {
    try {
        const request: SessionWriteFileRequest = { path, content, expectedHash };
        const response = await apiSocket.sessionRPC<SessionWriteFileResponse, SessionWriteFileRequest>(
            sessionId,
            'writeFile',
            request
        );
        return response;
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * List directory contents in the session
 */
export async function sessionListDirectory(sessionId: string, path: string): Promise<SessionListDirectoryResponse> {
    try {
        const request: SessionListDirectoryRequest = { path };
        const response = await apiSocket.sessionRPC<SessionListDirectoryResponse, SessionListDirectoryRequest>(
            sessionId,
            'listDirectory',
            request
        );
        return response;
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Get directory tree from the session
 */
export async function sessionGetDirectoryTree(
    sessionId: string,
    path: string,
    maxDepth: number
): Promise<SessionGetDirectoryTreeResponse> {
    try {
        const request: SessionGetDirectoryTreeRequest = { path, maxDepth };
        const response = await apiSocket.sessionRPC<SessionGetDirectoryTreeResponse, SessionGetDirectoryTreeRequest>(
            sessionId,
            'getDirectoryTree',
            request
        );
        return response;
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Run ripgrep in the session
 */
export async function sessionRipgrep(
    sessionId: string,
    args: string[],
    cwd?: string
): Promise<SessionRipgrepResponse> {
    try {
        const request: SessionRipgrepRequest = { args, cwd };
        const response = await apiSocket.sessionRPC<SessionRipgrepResponse, SessionRipgrepRequest>(
            sessionId,
            'ripgrep',
            request
        );
        return response;
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Kill the session process immediately
 */
export async function sessionKill(sessionId: string): Promise<SessionKillResponse> {
    try {
        const response = await apiSocket.sessionRPC<SessionKillResponse, {}>(
            sessionId,
            'killSession',
            {}
        );
        return response;
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Archive a session, or put an archived one back in the active list.
 *
 * RL-07: the archive state belongs to the host, so this asks the session's machine rather than
 * writing anything itself. The relay's plaintext list marker follows the host's metadata write;
 * with the host offline there is nothing to ask and the caller is told so.
 */
export async function sessionArchive(sessionId: string, archived = true): Promise<{ success: boolean; message?: string }> {
    const session = storage.getState().sessions[sessionId];
    if (session?.metadata?.bot) {
        return { success: false, message: 'Connect to the bot’s machine to archive it.' };
    }
    const machineId = session?.metadata?.machineId;
    if (!machineId) {
        return { success: false, message: 'This session has no machine to ask.' };
    }
    try {
        await apiSocket.machineRPC<{ sessionId: string; archived: boolean }, { sessionId: string; archived: boolean }>(
            machineId,
            'archive-session',
            { sessionId, archived },
        );
        return { success: true };
    } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Permanently delete a session from the server
 * This will remove the session and all its associated data (messages, usage reports, access keys)
 * The session should be inactive/archived before deletion
 */
export async function sessionDelete(sessionId: string): Promise<{ success: boolean; message?: string }> {
    if (storage.getState().sessions[sessionId]?.metadata?.bot) {
        return { success: false, message: 'A bot keeps one continuous conversation. Archive the bot instead.' };
    }
    try {
        const response = await apiSocket.request(`/v1/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            const result = await response.json();
            return { success: true };
        } else {
            const error = await response.text();
            return {
                success: false,
                message: error || 'Failed to delete session'
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// Export types for external use
export type {
    SessionBashRequest,
    SessionBashResponse,
    SessionReadFileResponse,
    SessionWriteFileResponse,
    SessionListDirectoryResponse,
    DirectoryEntry,
    SessionGetDirectoryTreeResponse,
    TreeNode,
    SessionRipgrepResponse,
    SessionKillResponse
};
