/**
 * WebSocket client for machine/daemon communication with Happy server
 * Similar to ApiSessionClient but for machine-scoped connections
 */

import { io, Socket } from 'socket.io-client';
import { logger } from '@/ui/logger';
import { configuration } from '@/configuration';
import { MachineMetadata, DaemonState, Machine, Metadata, Update, UpdateMachineBody } from './types';
import { isMetadataArchived } from './sessionArchiveMarker';
import { registerCommonHandlers, SpawnSessionOptions, SpawnSessionResult } from '../modules/common/registerCommonHandlers';
import { encodeBase64, decodeBase64, encrypt, decrypt } from './encryption';
import { backoff } from '@/utils/time';
import { RpcHandlerManager } from './rpc/RpcHandlerManager';
import { detectCLIAvailability, CLIAvailability } from '@/utils/detectCLI';
import { shouldReconnect } from '@/utils/lidState';

interface ServerToDaemonEvents {
    update: (data: Update) => void;
    'rpc-request': (data: { method: string, params: string }, callback: (response: string) => void) => void;
    'rpc-registered': (data: { method: string }) => void;
    'rpc-unregistered': (data: { method: string }) => void;
    'rpc-error': (data: { type: string, error: string }) => void;
    auth: (data: { success: boolean, user: string }) => void;
    error: (data: { message: string }) => void;
}

interface DaemonToServerEvents {
    'machine-alive': (data: {
        machineId: string;
        time: number;
    }) => void;

    'machine-update-metadata': (data: {
        machineId: string;
        metadata: string; // Encrypted MachineMetadata
        expectedVersion: number
    }, cb: (answer: {
        result: 'error'
    } | {
        result: 'version-mismatch'
        version: number,
        metadata: string
    } | {
        result: 'success',
        version: number,
        metadata: string
    }) => void) => void;

    'machine-update-state': (data: {
        machineId: string;
        daemonState: string; // Encrypted DaemonState
        expectedVersion: number
    }, cb: (answer: {
        result: 'error'
    } | {
        result: 'version-mismatch'
        version: number,
        daemonState: string
    } | {
        result: 'success',
        version: number,
        daemonState: string
    }) => void) => void;

    /**
     * RL-07: the daemon writes a session's archive state for the whole machine — the session's own
     * process may be long gone by the time a control end asks. The plaintext `archived` marker goes
     * out in the same call as the ciphertext, and the relay accepts it only from a host connection.
     */
    'update-metadata': (data: {
        sid: string;
        expectedVersion: number;
        metadata: string; // Encrypted Metadata
        archived: boolean;
    }, cb: (answer: {
        result: 'error'
    } | {
        result: 'version-mismatch'
        version: number,
        metadata: string
    } | {
        result: 'success',
        version: number,
        metadata: string
    }) => void) => void;

    'rpc-register': (data: { method: string }) => void;
    'rpc-unregister': (data: { method: string }) => void;
    'rpc-call': (data: { method: string, params: any }, callback: (response: {
        ok: boolean
        result?: any
        error?: string
    }) => void) => void;
}

type MachineRpcHandlers = {
    spawnSession: (options: SpawnSessionOptions) => Promise<SpawnSessionResult>;
    stopSession: (sessionId: string) => boolean;
    /** RL-07: archive or restore a session of this machine on the host's authority. */
    archiveSession: (sessionId: string, archived: boolean) => Promise<void>;
    requestShutdown: () => void;
}

/** What the daemon knows about a session whose metadata it is about to rewrite. */
export interface SessionMetadataTarget {
    sessionId: string;
    encryptionKey: Uint8Array;
    encryptionVariant: 'legacy' | 'dataKey';
    metadata: Metadata;
    metadataVersion: number;
}

/** A bounded retry: an RPC caller waits on this, so it must fail rather than retry forever. */
const SESSION_METADATA_WRITE_ATTEMPTS = 3;

export class ApiMachineClient {
    private socket!: Socket<ServerToDaemonEvents, DaemonToServerEvents>;
    private keepAliveInterval: NodeJS.Timeout | null = null;
    private lastKnownCLIAvailability: CLIAvailability | null = null;
    private rpcHandlerManager: RpcHandlerManager;
    private reconnectInterval: NodeJS.Timeout | null = null;

    constructor(
        private token: string,
        private machine: Machine
    ) {
        // Initialize RPC handler manager
        this.rpcHandlerManager = new RpcHandlerManager({
            scopePrefix: this.machine.id,
            encryptionKey: this.machine.encryptionKey,
            encryptionVariant: this.machine.encryptionVariant,
            logger: (msg, data) => logger.debug(msg, data)
        });

        // null = unrestricted: the daemon serves the whole machine, and its
        // process.cwd() is an accident of where it was started, not a workspace.
        registerCommonHandlers(this.rpcHandlerManager, null);
    }

    setRPCHandlers({
        spawnSession,
        stopSession,
        archiveSession,
        requestShutdown
    }: MachineRpcHandlers) {
        // Register spawn session handler
        this.rpcHandlerManager.registerHandler('spawn-happy-session', async (params: any) => {
            const { directory, sessionId, machineId, approvedNewDirectoryCreation, agent, agentProfile, environmentVariables, parentSessionId, isSideChat } = params || {};
            logger.debug(`[API MACHINE] Spawning session with params: ${JSON.stringify(params)}`);

            if (!directory) {
                throw new Error('Directory is required');
            }

            const result = await spawnSession({ directory, sessionId, machineId, approvedNewDirectoryCreation, agent, agentProfile, environmentVariables, parentSessionId, isSideChat });

            switch (result.type) {
                case 'success':
                    logger.debug(`[API MACHINE] Spawned session ${result.sessionId}`);
                    return { type: 'success', sessionId: result.sessionId };

                case 'requestToApproveDirectoryCreation':
                    logger.debug(`[API MACHINE] Requesting directory creation approval for: ${result.directory}`);
                    return { type: 'requestToApproveDirectoryCreation', directory: result.directory };

                case 'error':
                    throw new Error(result.errorMessage);
            }
        });

        // Register stop session handler
        this.rpcHandlerManager.registerHandler('stop-session', (params: any) => {
            const { sessionId } = params || {};

            if (!sessionId) {
                throw new Error('Session ID is required');
            }

            const success = stopSession(sessionId);
            if (!success) {
                throw new Error('Session not found or failed to stop');
            }

            logger.debug(`[API MACHINE] Stopped session ${sessionId}`);
            return { message: 'Session stopped' };
        });

        // Register archive session handler (RL-07). The control end asks, the host decides: the
        // daemon rewrites the session metadata and the relay's list marker follows that write.
        this.rpcHandlerManager.registerHandler('archive-session', async (params: any) => {
            const { sessionId, archived } = params || {};

            if (!sessionId || typeof sessionId !== 'string') {
                throw new Error('Session ID is required');
            }
            if (typeof archived !== 'boolean') {
                throw new Error('archived must be a boolean');
            }

            await archiveSession(sessionId, archived);
            logger.debug(`[API MACHINE] Session ${sessionId} archived=${archived}`);
            return { sessionId, archived };
        });

        // Register stop daemon handler
        this.rpcHandlerManager.registerHandler('stop-daemon', () => {
            logger.debug('[API MACHINE] Received stop-daemon RPC request');

            // Trigger shutdown callback after a delay
            setTimeout(() => {
                logger.debug('[API MACHINE] Initiating daemon shutdown from RPC');
                requestShutdown();
            }, 100);

            return { message: 'Daemon stop request acknowledged, starting shutdown sequence...' };
        });
    }

    /**
     * Rewrite a session's metadata from the daemon, carrying the plaintext archive marker the
     * relay keeps for list queries (RL-07). The session's own process is not involved: a session
     * a control end wants archived has usually already exited.
     *
     * Returns the metadata and version the relay settled on, so the caller can keep its copy.
     */
    async updateSessionMetadata(
        target: SessionMetadataTarget,
        handler: (metadata: Metadata) => Metadata
    ): Promise<{ metadata: Metadata, metadataVersion: number }> {
        let metadata = target.metadata;
        let metadataVersion = target.metadataVersion;

        for (let attempt = 1; attempt <= SESSION_METADATA_WRITE_ATTEMPTS; attempt++) {
            const updated = handler(metadata);
            const answer = await this.socket.emitWithAck('update-metadata', {
                sid: target.sessionId,
                expectedVersion: metadataVersion,
                metadata: encodeBase64(encrypt(target.encryptionKey, target.encryptionVariant, updated)),
                archived: isMetadataArchived(updated)
            });

            if (answer.result === 'success') {
                return {
                    metadata: decrypt(target.encryptionKey, target.encryptionVariant, decodeBase64(answer.metadata)),
                    metadataVersion: answer.version
                };
            }
            if (answer.result !== 'version-mismatch') {
                throw new Error(`Relay rejected the metadata write for session ${target.sessionId}`);
            }

            // Another writer got there first; rebase on its copy and try again.
            metadata = decrypt(target.encryptionKey, target.encryptionVariant, decodeBase64(answer.metadata));
            metadataVersion = answer.version;
        }

        throw new Error(`Metadata for session ${target.sessionId} kept changing under the write`);
    }

    /**
     * Update machine metadata
     * Currently unused, changes from the mobile client are more likely
     * for example to set a custom name.
     */
    async updateMachineMetadata(handler: (metadata: MachineMetadata | null) => MachineMetadata): Promise<void> {
        await backoff(async () => {
            const updated = handler(this.machine.metadata);

            const answer = await this.socket.emitWithAck('machine-update-metadata', {
                machineId: this.machine.id,
                metadata: encodeBase64(encrypt(this.machine.encryptionKey, this.machine.encryptionVariant, updated)),
                expectedVersion: this.machine.metadataVersion
            });

            if (answer.result === 'success') {
                this.machine.metadata = decrypt(this.machine.encryptionKey, this.machine.encryptionVariant, decodeBase64(answer.metadata));
                this.machine.metadataVersion = answer.version;
                logger.debug('[API MACHINE] Metadata updated successfully');
            } else if (answer.result === 'version-mismatch') {
                if (answer.version > this.machine.metadataVersion) {
                    this.machine.metadataVersion = answer.version;
                    this.machine.metadata = decrypt(this.machine.encryptionKey, this.machine.encryptionVariant, decodeBase64(answer.metadata));
                }
                throw new Error('Metadata version mismatch'); // Triggers retry
            }
        });
    }

    /**
     * Update daemon state (runtime info) - similar to session updateAgentState
     * Simplified without lock - relies on backoff for retry
     */
    async updateDaemonState(handler: (state: DaemonState | null) => DaemonState): Promise<void> {
        await backoff(async () => {
            const updated = handler(this.machine.daemonState);

            const answer = await this.socket.emitWithAck('machine-update-state', {
                machineId: this.machine.id,
                daemonState: encodeBase64(encrypt(this.machine.encryptionKey, this.machine.encryptionVariant, updated)),
                expectedVersion: this.machine.daemonStateVersion
            });

            if (answer.result === 'success') {
                this.machine.daemonState = decrypt(this.machine.encryptionKey, this.machine.encryptionVariant, decodeBase64(answer.daemonState));
                this.machine.daemonStateVersion = answer.version;
                logger.debug('[API MACHINE] Daemon state updated successfully');
            } else if (answer.result === 'version-mismatch') {
                if (answer.version > this.machine.daemonStateVersion) {
                    this.machine.daemonStateVersion = answer.version;
                    this.machine.daemonState = decrypt(this.machine.encryptionKey, this.machine.encryptionVariant, decodeBase64(answer.daemonState));
                }
                throw new Error('Daemon state version mismatch'); // Triggers retry
            }
        });
    }

    connect() {
        const serverUrl = configuration.serverUrl.replace(/^http/, 'ws');
        logger.debug(`[API MACHINE] Connecting to ${serverUrl}`);

        this.socket = io(serverUrl, {
            transports: ['websocket'],
            auth: {
                token: this.token,
                clientType: 'machine-scoped' as const,
                machineId: this.machine.id,
                happyClient: `cli-daemon/${configuration.currentCliVersion}`
            },
            path: '/v1/updates',
            reconnection: false,
        });

        this.socket.on('connect', () => {
            logger.debug('[API MACHINE] Connected to server');

            if (this.reconnectInterval) {
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }

            this.updateDaemonState((state) => ({
                ...state,
                status: 'running',
                pid: process.pid,
                httpPort: this.machine.daemonState?.httpPort,
                startedAt: Date.now()
            }));

            this.rpcHandlerManager.onSocketConnect(this.socket);
            this.startKeepAlive();
        });

        this.socket.on('disconnect', (reason) => {
            logger.debug(`[API MACHINE] Disconnected from server — reason: ${reason}`);
            this.rpcHandlerManager.onSocketDisconnect();
            this.stopKeepAlive();
            this.startSmartReconnect();
        });

        // Single consolidated RPC handler
        this.socket.on('rpc-request', async (data: { method: string, params: string }, callback: (response: string) => void) => {
            logger.debugLargeJson(`[API MACHINE] Received RPC request:`, data);
            callback(await this.rpcHandlerManager.handleRequest(data));
        });

        // Handle update events from server
        this.socket.on('update', (data: Update) => {
            // Machine clients should only care about machine updates
            if (data.body.t === 'update-machine' && (data.body as UpdateMachineBody).machineId === this.machine.id) {
                // Handle machine metadata or daemon state updates from other clients (e.g., mobile app)
                const update = data.body as UpdateMachineBody;

                if (update.metadata) {
                    logger.debug('[API MACHINE] Received external metadata update');
                    this.machine.metadata = decrypt(this.machine.encryptionKey, this.machine.encryptionVariant, decodeBase64(update.metadata.value));
                    this.machine.metadataVersion = update.metadata.version;
                }

                if (update.daemonState) {
                    logger.debug('[API MACHINE] Received external daemon state update');
                    this.machine.daemonState = decrypt(this.machine.encryptionKey, this.machine.encryptionVariant, decodeBase64(update.daemonState.value));
                    this.machine.daemonStateVersion = update.daemonState.version;
                }
            } else {
                logger.debug(`[API MACHINE] Received unknown update type: ${(data.body as any).t}`);
            }
        });

        this.socket.on('connect_error', (error) => {
            logger.debug(`[API MACHINE] Connection error: ${error.message}`);
            this.startSmartReconnect();
        });

        this.socket.io.on('error', (error: any) => {
            logger.debug('[API MACHINE] Socket error:', error);
        });
    }

    private sendKeepAlive() {
        const payload = {
            machineId: this.machine.id,
            time: Date.now()
        };
        if (process.env.DEBUG) {
            logger.debugLargeJson(`[API MACHINE] Emitting machine-alive`, payload);
        }
        this.socket.emit('machine-alive', payload);

        // Re-detect engine availability and push metadata update if changed.
        // The engine is the only agent reported (HOST-10), so one flag is compared.
        const newAvailability = detectCLIAvailability();
        const prev = this.lastKnownCLIAvailability;
        const cliAvailabilityChanged = !prev || prev.opencode !== newAvailability.opencode;
        // POST /v1/machines returns the stored encrypted metadata when the
        // machine already exists. After a CLI upgrade that can leave the app
        // looking at the version from the machine's first registration even
        // though this daemon is newer. Repair it through the normal versioned
        // metadata update so fields owned by the app (for example displayName)
        // are preserved.
        const cliVersionChanged = this.machine.metadata?.happyCliVersion !== configuration.currentCliVersion;

        if (cliAvailabilityChanged || cliVersionChanged) {
            this.lastKnownCLIAvailability = newAvailability;
            this.updateMachineMetadata((metadata) => ({
                ...(metadata || {} as any),
                happyCliVersion: configuration.currentCliVersion,
                cliAvailability: newAvailability,
            })).catch((err) => {
                logger.debug('[API MACHINE] Failed to update machine capabilities:', err);
            });
        }
    }

    private startKeepAlive() {
        this.stopKeepAlive();
        this.sendKeepAlive();
        this.keepAliveInterval = setInterval(() => {
            this.sendKeepAlive();
        }, 20000);
        logger.debug('[API MACHINE] Keep-alive started (20s interval)');
    }

    private startSmartReconnect() {
        if (this.reconnectInterval) return;

        this.reconnectInterval = setInterval(() => {
            if (this.socket.connected) {
                clearInterval(this.reconnectInterval!);
                this.reconnectInterval = null;
                return;
            }
            if (!shouldReconnect()) {
                logger.debug('[API MACHINE] Still not ready to reconnect');
                return;
            }
            logger.debug('[API MACHINE] Attempting reconnect');
            this.socket.connect();
        }, 3000);

        if (shouldReconnect()) {
            logger.debug('[API MACHINE] Network up + lid open — reconnecting in 1s');
            setTimeout(() => { if (!this.socket.connected) this.socket.connect() }, 1000);
        }
    }

    private stopKeepAlive() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
            logger.debug('[API MACHINE] Keep-alive stopped');
        }
    }

    shutdown() {
        logger.debug('[API MACHINE] Shutting down');
        this.stopKeepAlive();
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        if (this.socket) {
            this.socket.close();
            logger.debug('[API MACHINE] Socket closed');
        }
    }
}
