/**
 * Session Metadata Factory
 *
 * Single place the daemon builds a session's state and metadata.
 *
 * @module createSessionMetadata
 */

import os from 'node:os';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import type { AgentState, Metadata } from '@/api/types';
import { configuration } from '@/configuration';
import { projectPath } from '@/projectPath';
import type { EngineAgentName } from '@/agent/acp/acpAgentConfig';
import packageJson from '../../package.json';

/**
 * Backend flavor identifier for session metadata. The engine is the only
 * backend (HOST-10).
 */
export type BackendFlavor = EngineAgentName;

/**
 * Options for creating session metadata.
 */
export interface CreateSessionMetadataOptions {
    /** Backend flavor */
    flavor: BackendFlavor;
    /** Machine ID for server identification */
    machineId: string;
    /** How the session was started */
    startedBy?: 'daemon' | 'terminal';
    /** Engine agent profile this session runs under (HOST-12). */
    agentProfile?: string;
    /** Happy session id this session was forked from. */
    parentSessionId?: string;
    /** Marks this session as a hidden side chat of `parentSessionId`. */
    isSideChat?: boolean;
    /** Marks a session the host started for its own housekeeping (ENG-19). */
    internal?: boolean;
}

/**
 * Result containing both state and metadata for session creation.
 */
export interface SessionMetadataResult {
    /** Agent state for session */
    state: AgentState;
    /** Session metadata */
    metadata: Metadata;
}

function getGitBranch(cwd: string): string | undefined {
    try {
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            windowsHide: true,
        }).trim();
        return branch && branch !== 'HEAD' ? branch : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Creates session state and metadata for an engine session.
 *
 * @param opts - Options specifying flavor, machineId, and startedBy
 * @returns Object containing state and metadata for session creation
 */
export function createSessionMetadata(opts: CreateSessionMetadataOptions): SessionMetadataResult {
    const state: AgentState = {
        controlledByUser: false,
    };
    const cwd = process.cwd();
    const gitBranch = getGitBranch(cwd);

    const metadata: Metadata = {
        path: cwd,
        host: os.hostname(),
        version: packageJson.version,
        os: os.platform(),
        machineId: opts.machineId,
        homeDir: os.homedir(),
        happyHomeDir: configuration.happyHomeDir,
        happyLibDir: projectPath(),
        happyToolsDir: resolve(projectPath(), 'tools', 'unpacked'),
        startedFromDaemon: opts.startedBy === 'daemon',
        hostPid: process.pid,
        startedBy: opts.startedBy || 'terminal',
        lifecycleState: 'running',
        lifecycleStateSince: Date.now(),
        flavor: opts.flavor,
        ...(opts.agentProfile ? { agentProfile: opts.agentProfile } : {}),
        ...(gitBranch ? { gitBranch } : {}),
        ...(opts.parentSessionId ? { parentSessionId: opts.parentSessionId } : {}),
        ...(opts.isSideChat ? { isSideChat: true } : {}),
        ...(opts.internal ? { internal: true } : {}),
    };

    return { state, metadata };
}
