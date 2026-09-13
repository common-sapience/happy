import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiMachineClient } from './apiMachine';
import type { Machine } from './types';

const {
    mockIo,
    mockShouldReconnect,
    mockReadPermissionConfirmationEnabled,
    mockReadEngineCredentials
} = vi.hoisted(() => ({
    mockIo: vi.fn(),
    mockShouldReconnect: vi.fn(() => true),
    mockReadPermissionConfirmationEnabled: vi.fn(async () => false),
    mockReadEngineCredentials: vi.fn(async () => ({}) as Record<string, string>)
}));

vi.mock('socket.io-client', () => ({
    io: mockIo
}));

vi.mock('@/configuration', () => ({
    configuration: {
        relayUrl: 'http://127.0.0.1:3005',
        currentCliVersion: 'test'
    },
    requireRelayUrl: () => 'http://127.0.0.1:3005'
}));

vi.mock('@/ui/logger', () => ({
    logger: {
        debug: vi.fn(),
        debugLargeJson: vi.fn()
    }
}));

vi.mock('@/modules/common/registerCommonHandlers', () => ({
    registerCommonHandlers: vi.fn()
}));

vi.mock('@/api/rpc/RpcHandlerManager', () => ({
    RpcHandlerManager: class {
        handlers = new Map<string, (params: unknown) => unknown>();
        onSocketConnect = vi.fn();
        onSocketDisconnect = vi.fn();
        handleRequest = vi.fn(async () => '');
        registerHandler = vi.fn((method: string, handler: (params: unknown) => unknown) => {
            this.handlers.set(method, handler);
            registeredHandlers.set(method, handler);
        });
        unregisterHandler = vi.fn();
        hasHandler = vi.fn(() => false);
    }
}));

vi.mock('@/utils/detectCLI', () => ({
    detectCLIAvailability: vi.fn(() => ({
        opencode: false,
        detectedAt: 0
    }))
}));

vi.mock('@/utils/lidState', () => ({
    shouldReconnect: mockShouldReconnect
}));

vi.mock('@/modules/permission/permissionSwitch', () => ({
    readPermissionConfirmationEnabled: mockReadPermissionConfirmationEnabled
}));

vi.mock('@/modules/credentials/engineCredentials', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/modules/credentials/engineCredentials')>()),
    readEngineCredentials: mockReadEngineCredentials
}));

const registeredHandlers = new Map<string, (params: unknown) => unknown>();

type SocketHandler = (...args: any[]) => void;
type SocketHandlers = Record<string, SocketHandler[]>;

function makeMachine(): Machine {
    return {
        id: 'test-machine-id',
        metadata: {
            host: 'localhost',
            platform: 'darwin',
            happyCliVersion: 'test',
            homeDir: '/home/user',
            happyHomeDir: '/home/user/.happy',
            happyLibDir: '/home/user/.happy/lib'
        },
        metadataVersion: 0,
        daemonState: null,
        daemonStateVersion: 0,
        encryptionKey: new Uint8Array(32),
        encryptionVariant: 'legacy'
    };
}

describe('ApiMachineClient socket reconnection', () => {
    let socketHandlers: SocketHandlers;
    let mockSocket: any;

    const emitSocketEvent = (event: string, ...args: any[]) => {
        const handlers = socketHandlers[event] || [];
        handlers.forEach((handler) => handler(...args));
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockShouldReconnect.mockReturnValue(true);
        mockReadPermissionConfirmationEnabled.mockResolvedValue(false);
        socketHandlers = {};
        mockSocket = {
            connected: false,
            connect: vi.fn(),
            on: vi.fn((event: string, handler: SocketHandler) => {
                if (!socketHandlers[event]) {
                    socketHandlers[event] = [];
                }
                socketHandlers[event].push(handler);
            }),
            emit: vi.fn(),
            emitWithAck: vi.fn(),
            close: vi.fn(),
            io: {
                on: vi.fn()
            }
        };

        mockIo.mockReturnValue(mockSocket);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('retries after initial socket connection error', async () => {
        vi.useFakeTimers();

        const client = new ApiMachineClient('fake-token', makeMachine());
        client.connect();

        expect(mockIo).toHaveBeenCalledWith('ws://127.0.0.1:3005', expect.objectContaining({
            reconnection: false
        }));
        expect(mockSocket.connect).not.toHaveBeenCalled();

        emitSocketEvent('connect_error', new Error('ECONNREFUSED'));

        await vi.advanceTimersByTimeAsync(1000);
        expect(mockSocket.connect).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(3000);
        expect(mockSocket.connect).toHaveBeenCalledTimes(2);

        client.shutdown();
    });

    it('emits machine-alive immediately when the socket connects', async () => {
        vi.useFakeTimers();
        mockSocket.emitWithAck.mockImplementation(() => new Promise(() => {}));

        const client = new ApiMachineClient('fake-token', makeMachine());
        client.connect();

        expect(mockSocket.emit.mock.calls.filter(([event]: [string]) => event === 'machine-alive')).toHaveLength(0);

        emitSocketEvent('connect');

        let aliveCalls = mockSocket.emit.mock.calls.filter(([event]: [string]) => event === 'machine-alive');
        expect(aliveCalls).toHaveLength(1);
        expect(aliveCalls[0][1]).toEqual(expect.objectContaining({
            machineId: 'test-machine-id',
            time: expect.any(Number)
        }));

        await vi.advanceTimersByTimeAsync(19999);
        aliveCalls = mockSocket.emit.mock.calls.filter(([event]: [string]) => event === 'machine-alive');
        expect(aliveCalls).toHaveLength(1);

        await vi.advanceTimersByTimeAsync(1);
        aliveCalls = mockSocket.emit.mock.calls.filter(([event]: [string]) => event === 'machine-alive');
        expect(aliveCalls).toHaveLength(2);

        client.shutdown();
    });

    it('republishes the running CLI version without dropping stored machine fields', () => {
        vi.useFakeTimers();
        mockSocket.emitWithAck.mockImplementation(() => new Promise(() => {}));
        const machine = makeMachine();
        machine.metadata.happyCliVersion = '1.0.0';
        const storedMetadata = machine.metadata as Machine['metadata'] & { displayName?: string };
        storedMetadata.displayName = 'My Mac';
        const client = new ApiMachineClient('fake-token', machine);
        let publishedMetadata: (Machine['metadata'] & { displayName?: string }) | null = null;
        vi.spyOn(client, 'updateMachineMetadata').mockImplementation(async (handler) => {
            publishedMetadata = handler(storedMetadata);
        });
        client.connect();

        emitSocketEvent('connect');

        expect(publishedMetadata).toEqual(expect.objectContaining({
            displayName: 'My Mac',
            happyCliVersion: 'test',
            cliAvailability: { opencode: false, detectedAt: 0 },
        }));

        client.shutdown();
    });

    it('HOST-10: reports only the engine as an available agent', () => {
        vi.useFakeTimers();
        mockSocket.emitWithAck.mockImplementation(() => new Promise(() => {}));
        const machine = makeMachine();
        const client = new ApiMachineClient('fake-token', machine);
        let publishedMetadata: Machine['metadata'] | null = null;
        vi.spyOn(client, 'updateMachineMetadata').mockImplementation(async (handler) => {
            publishedMetadata = handler(machine.metadata);
        });
        client.connect();

        emitSocketEvent('connect');

        expect(Object.keys(publishedMetadata!.cliAvailability!).sort()).toEqual(['detectedAt', 'opencode']);

        client.shutdown();
    });
});

describe('HOST-10 / HOST-12 machine spawn RPC', () => {
    const spawnSession = vi.fn(async () => ({ type: 'success' as const, sessionId: 'session-1' }));

    const registerHandlers = () => {
        registeredHandlers.clear();
        spawnSession.mockClear();
        const client = new ApiMachineClient('fake-token', makeMachine());
        client.setRPCHandlers({
            spawnSession,
            stopSession: vi.fn(() => true),
            archiveSession: vi.fn(async () => {}),
            runDream: vi.fn(async () => 'dream-session-1'),
            getPermissionConfirmation: vi.fn(async () => false),
            setPermissionConfirmation: vi.fn(async (enabled: boolean) => enabled),
            requestShutdown: vi.fn()
        });
        return registeredHandlers.get('spawn-happy-session')!;
    };

    it('HOST-10: registers no other-agent RPC', () => {
        registerHandlers();

        expect([...registeredHandlers.keys()].sort()).toEqual([
            'archive-session',
            'get-permission-confirmation',
            'run-dream',
            'set-permission-confirmation',
            'spawn-happy-session',
            'stop-daemon',
            'stop-session'
        ]);
    });

    it('HOST-12: forwards the requested agent profile to the daemon', async () => {
        const spawn = registerHandlers();

        await spawn({ directory: '/work', agent: 'opencode', agentProfile: 'research' });

        expect(spawnSession).toHaveBeenCalledWith(expect.objectContaining({
            directory: '/work',
            agent: 'opencode',
            agentProfile: 'research'
        }));
    });

    it('requires a directory', async () => {
        const spawn = registerHandlers();

        await expect(spawn({ agent: 'opencode' })).rejects.toThrow('Directory is required');
    });
});

describe('RL-07 archive RPC and the plaintext marker', () => {
    const archiveSession = vi.fn(async () => {});

    const registerHandlers = () => {
        registeredHandlers.clear();
        archiveSession.mockClear();
        const client = new ApiMachineClient('fake-token', makeMachine());
        client.setRPCHandlers({
            spawnSession: vi.fn(async () => ({ type: 'success' as const, sessionId: 'session-1' })),
            stopSession: vi.fn(() => true),
            archiveSession,
            runDream: vi.fn(async () => 'dream-session-1'),
            getPermissionConfirmation: vi.fn(async () => false),
            setPermissionConfirmation: vi.fn(async (enabled: boolean) => enabled),
            requestShutdown: vi.fn()
        });
        return registeredHandlers.get('archive-session')!;
    };

    it('asks the host to archive the named session', async () => {
        const archive = registerHandlers();

        await expect(archive({ sessionId: 'session-1', archived: true })).resolves.toEqual({
            sessionId: 'session-1',
            archived: true
        });
        expect(archiveSession).toHaveBeenCalledWith('session-1', true);
    });

    it('asks the host to restore an archived session', async () => {
        const archive = registerHandlers();

        await archive({ sessionId: 'session-1', archived: false });

        expect(archiveSession).toHaveBeenCalledWith('session-1', false);
    });

    it('rejects a request that names no session or no state', async () => {
        const archive = registerHandlers();

        await expect(archive({ archived: true })).rejects.toThrow('Session ID is required');
        await expect(archive({ sessionId: 'session-1' })).rejects.toThrow('archived must be a boolean');
        await expect(archive({ sessionId: 'session-1', archived: 'yes' })).rejects.toThrow('archived must be a boolean');
        expect(archiveSession).not.toHaveBeenCalled();
    });
});

describe('RL-07 the daemon writes the archive marker with the metadata', () => {
    let mockSocket: any;

    const connectedClient = (ack: any) => {
        mockSocket = {
            connected: true,
            connect: vi.fn(),
            on: vi.fn(),
            emit: vi.fn(),
            emitWithAck: vi.fn(async () => ack),
            close: vi.fn(),
            io: { on: vi.fn() }
        };
        mockIo.mockReturnValue(mockSocket);
        const client = new ApiMachineClient('fake-token', makeMachine());
        client.connect();
        return client;
    };

    const target = {
        sessionId: 'session-1',
        encryptionKey: new Uint8Array(32),
        encryptionVariant: 'legacy' as const,
        metadata: { path: '/work', host: 'localhost' } as any,
        metadataVersion: 3
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockShouldReconnect.mockReturnValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('sends the plaintext archived marker in the same call as the ciphertext', async () => {
        const { encrypt, encodeBase64 } = await import('./encryption');
        const settled = { path: '/work', host: 'localhost', lifecycleState: 'archived' };
        const client = connectedClient({
            result: 'success',
            version: 4,
            metadata: encodeBase64(encrypt(target.encryptionKey, 'legacy', settled))
        });

        const result = await client.updateSessionMetadata(target, (metadata) => ({
            ...metadata,
            lifecycleState: 'archived'
        }));

        expect(mockSocket.emitWithAck).toHaveBeenCalledWith('update-metadata', expect.objectContaining({
            sid: 'session-1',
            expectedVersion: 3,
            archived: true
        }));
        expect(result.metadataVersion).toBe(4);
        expect(result.metadata.lifecycleState).toBe('archived');

        client.shutdown();
    });

    it('sends archived false when the host puts a session back in the active list', async () => {
        const { encrypt, encodeBase64 } = await import('./encryption');
        const settled = { path: '/work', host: 'localhost', lifecycleState: 'running' };
        const client = connectedClient({
            result: 'success',
            version: 4,
            metadata: encodeBase64(encrypt(target.encryptionKey, 'legacy', settled))
        });

        await client.updateSessionMetadata(target, (metadata) => ({
            ...metadata,
            lifecycleState: 'running'
        }));

        expect(mockSocket.emitWithAck).toHaveBeenCalledWith('update-metadata', expect.objectContaining({
            archived: false
        }));

        client.shutdown();
    });

    it('fails the write the relay rejected instead of reporting success', async () => {
        const client = connectedClient({ result: 'error' });

        await expect(client.updateSessionMetadata(target, (metadata) => metadata))
            .rejects.toThrow('Relay rejected the metadata write for session session-1');

        client.shutdown();
    });
});

describe('ENG-19 / T-15 run-dream RPC', () => {
    const runDream = vi.fn(async () => 'dream-session-1');

    const registerHandlers = () => {
        registeredHandlers.clear();
        runDream.mockClear();
        const client = new ApiMachineClient('fake-token', makeMachine());
        client.setRPCHandlers({
            spawnSession: vi.fn(async () => ({ type: 'success' as const, sessionId: 'session-1' })),
            stopSession: vi.fn(() => true),
            archiveSession: vi.fn(async () => {}),
            runDream,
            getPermissionConfirmation: vi.fn(async () => false),
            setPermissionConfirmation: vi.fn(async (enabled: boolean) => enabled),
            requestShutdown: vi.fn()
        });
        return registeredHandlers.get('run-dream')!;
    };

    it('takes no parameters and answers with the started pass', async () => {
        const run = registerHandlers();

        await expect(run({})).resolves.toEqual({ started: true, sessionId: 'dream-session-1' });
        expect(runDream).toHaveBeenCalledTimes(1);
    });

    it('tolerates a caller that sends no params object at all', async () => {
        const run = registerHandlers();

        await expect(run(undefined)).resolves.toEqual({ started: true, sessionId: 'dream-session-1' });
    });

    it('surfaces the refusal when a pass is already running', async () => {
        const run = registerHandlers();
        runDream.mockRejectedValueOnce(new Error('A memory consolidation pass is already running on this machine'));

        await expect(run({})).rejects.toThrow('already running');
    });
});

describe('PERM-08 / PERM-05 / DESK-17 permission confirmation RPC', () => {
    const getPermissionConfirmation = vi.fn(async () => false);
    const setPermissionConfirmation = vi.fn(async (enabled: boolean) => enabled);

    const registerHandlers = () => {
        registeredHandlers.clear();
        getPermissionConfirmation.mockClear();
        setPermissionConfirmation.mockClear();
        const client = new ApiMachineClient('fake-token', makeMachine());
        client.setRPCHandlers({
            spawnSession: vi.fn(async () => ({ type: 'success' as const, sessionId: 'session-1' })),
            stopSession: vi.fn(() => true),
            archiveSession: vi.fn(async () => {}),
            runDream: vi.fn(async () => 'dream-session-1'),
            getPermissionConfirmation,
            setPermissionConfirmation,
            requestShutdown: vi.fn()
        });
        return {
            get: registeredHandlers.get('get-permission-confirmation')!,
            set: registeredHandlers.get('set-permission-confirmation')!
        };
    };

    it('DESK-17: reads the switch with no parameters', async () => {
        const { get } = registerHandlers();

        await expect(get({})).resolves.toEqual({ enabled: false });
        expect(getPermissionConfirmation).toHaveBeenCalledTimes(1);
    });

    it('DESK-17: reports the switch as on once the host has it on', async () => {
        const { get } = registerHandlers();
        getPermissionConfirmation.mockResolvedValueOnce(true);

        await expect(get(undefined)).resolves.toEqual({ enabled: true });
    });

    it('PERM-05: a control end turns the switch on and gets the settled value back', async () => {
        const { set } = registerHandlers();

        await expect(set({ enabled: true })).resolves.toEqual({ enabled: true });
        expect(setPermissionConfirmation).toHaveBeenCalledWith(true);
    });

    it('PERM-05: a control end turns the switch off again', async () => {
        const { set } = registerHandlers();

        await expect(set({ enabled: false })).resolves.toEqual({ enabled: false });
        expect(setPermissionConfirmation).toHaveBeenCalledWith(false);
    });

    it('PERM-05: answers with the value the host settled on, not the value asked for', async () => {
        const { set } = registerHandlers();
        setPermissionConfirmation.mockResolvedValueOnce(false);

        await expect(set({ enabled: true })).resolves.toEqual({ enabled: false });
    });

    it('PERM-08: refuses anything that is not a boolean and writes nothing', async () => {
        const { set } = registerHandlers();

        await expect(set({})).rejects.toThrow('enabled must be a boolean');
        await expect(set(undefined)).rejects.toThrow('enabled must be a boolean');
        await expect(set({ enabled: 'true' })).rejects.toThrow('enabled must be a boolean');
        await expect(set({ enabled: 1 })).rejects.toThrow('enabled must be a boolean');
        expect(setPermissionConfirmation).not.toHaveBeenCalled();
    });

    it('PERM-08: surfaces a host that could not write the switch', async () => {
        const { set } = registerHandlers();
        setPermissionConfirmation.mockRejectedValueOnce(new Error('settings file is locked'));

        await expect(set({ enabled: true })).rejects.toThrow('settings file is locked');
    });
});

describe('PERM-08 / DESK-17 the machine metadata carries the switch', () => {
    let socketHandlers: SocketHandlers;
    let mockSocket: any;

    const emitSocketEvent = (event: string, ...args: any[]) => {
        const handlers = socketHandlers[event] || [];
        handlers.forEach((handler) => handler(...args));
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockShouldReconnect.mockReturnValue(true);
        mockReadPermissionConfirmationEnabled.mockResolvedValue(false);
        socketHandlers = {};
        mockSocket = {
            connected: true,
            connect: vi.fn(),
            on: vi.fn((event: string, handler: SocketHandler) => {
                if (!socketHandlers[event]) {
                    socketHandlers[event] = [];
                }
                socketHandlers[event].push(handler);
            }),
            emit: vi.fn(),
            emitWithAck: vi.fn(() => new Promise(() => {})),
            close: vi.fn(),
            io: { on: vi.fn() }
        };
        mockIo.mockReturnValue(mockSocket);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** Stands in for the relay: every accepted write becomes the machine's stored metadata. */
    const connectedClient = (machine: Machine) => {
        const client = new ApiMachineClient('fake-token', machine);
        const published: any[] = [];
        const spy = vi.spyOn(client, 'updateMachineMetadata').mockImplementation(async (handler) => {
            const settled = handler(machine.metadata);
            machine.metadata = settled;
            published.push(settled);
        });
        client.connect();
        return { client, published, spy };
    };

    it('DESK-17: publishes the switch on the heartbeat, so no RPC round trip is needed to render it', async () => {
        mockReadPermissionConfirmationEnabled.mockResolvedValue(true);
        const machine = makeMachine();
        const storedMetadata = machine.metadata as Machine['metadata'] & { displayName?: string };
        storedMetadata.displayName = 'My Mac';
        const { client, published } = connectedClient(machine);

        emitSocketEvent('connect');
        await vi.waitFor(() => {
            expect(published.some((metadata) => metadata.permissionConfirmationEnabled === true)).toBe(true);
        });

        // Additive: the field a control end reads arrives next to everything already stored.
        expect(machine.metadata).toEqual(expect.objectContaining({
            host: 'localhost',
            displayName: 'My Mac',
            permissionConfirmationEnabled: true
        }));

        client.shutdown();
    });

    it('DESK-17: publishes the switch as off when that is what the host holds', async () => {
        const machine = makeMachine();
        const { client } = connectedClient(machine);

        emitSocketEvent('connect');
        await vi.waitFor(() => {
            expect(machine.metadata!.permissionConfirmationEnabled).toBe(false);
        });

        client.shutdown();
    });

    it('PERM-08: writes no metadata of its own while the published copy already matches the host', async () => {
        const machine = makeMachine();
        machine.metadata!.permissionConfirmationEnabled = false;
        machine.metadata!.platformCredentials = { apiKey: false, baseUrl: false, modelId: false };
        const { client, published } = connectedClient(machine);

        emitSocketEvent('connect');
        await vi.waitFor(() => {
            expect(mockReadPermissionConfirmationEnabled).toHaveBeenCalled();
        });
        await mockReadPermissionConfirmationEnabled.mock.results[0]!.value;
        await Promise.resolve();

        // The only write is the first heartbeat's capability repair, which carries the switch
        // through untouched. An unchanged switch never costs a metadata version of its own.
        expect(published).toHaveLength(1);
        expect(published[0]).toEqual(expect.objectContaining({
            cliAvailability: { opencode: false, detectedAt: 0 },
            permissionConfirmationEnabled: false
        }));

        client.shutdown();
    });

    it('DESK-12: publishes which model gateway fields this computer holds, as booleans', async () => {
        mockReadEngineCredentials.mockResolvedValue({
            platformApiKey: 'sk-live-1',
            platformBaseUrl: 'https://gateway.example/v1'
        });
        const machine = makeMachine();
        const { client, published } = connectedClient(machine);

        emitSocketEvent('connect');
        await vi.waitFor(() => {
            expect(machine.metadata!.platformCredentials).toEqual({
                apiKey: true,
                baseUrl: true,
                modelId: false
            });
        });
        expect(JSON.stringify(published)).not.toContain('sk-live-1');
        expect(JSON.stringify(published)).not.toContain('gateway.example');

        client.shutdown();
    });

    it('HOST-09: writes no metadata of its own while the published copy already matches the store', async () => {
        mockReadEngineCredentials.mockResolvedValue({});
        const machine = makeMachine();
        machine.metadata!.platformCredentials = { apiKey: false, baseUrl: false, modelId: false };
        machine.metadata!.permissionConfirmationEnabled = false;
        const { client, published } = connectedClient(machine);

        emitSocketEvent('connect');
        await vi.waitFor(() => {
            expect(mockReadEngineCredentials).toHaveBeenCalled();
        });
        await mockReadEngineCredentials.mock.results[0]!.value;
        await Promise.resolve();

        expect(published).toHaveLength(1);
        expect(published[0]).toEqual(expect.objectContaining({
            platformCredentials: { apiKey: false, baseUrl: false, modelId: false }
        }));

        client.shutdown();
    });

    it('PERM-05: a switch written over RPC reaches the metadata without waiting for a heartbeat', async () => {
        registeredHandlers.clear();
        const machine = makeMachine();
        const { client, published } = connectedClient(machine);
        client.setRPCHandlers({
            spawnSession: vi.fn(async () => ({ type: 'success' as const, sessionId: 'session-1' })),
            stopSession: vi.fn(() => true),
            archiveSession: vi.fn(async () => {}),
            runDream: vi.fn(async () => 'dream-session-1'),
            getPermissionConfirmation: vi.fn(async () => false),
            setPermissionConfirmation: vi.fn(async (enabled: boolean) => enabled),
            requestShutdown: vi.fn()
        });

        await registeredHandlers.get('set-permission-confirmation')!({ enabled: true });

        expect(published.at(-1)).toEqual(expect.objectContaining({
            host: 'localhost',
            permissionConfirmationEnabled: true
        }));

        client.shutdown();
    });
});
