import { beforeEach, describe, expect, it, vi } from 'vitest';

const { machineRPC, getState } = vi.hoisted(() => ({
    machineRPC: vi.fn(),
    getState: vi.fn(),
}));

vi.mock('./apiSocket', () => ({ apiSocket: { machineRPC } }));
vi.mock('./sync', () => ({ sync: {} }));
vi.mock('./storage', () => ({ storage: { getState } }));

describe('RL-07 archiving asks the host instead of the relay', () => {
    beforeEach(() => {
        machineRPC.mockReset();
        machineRPC.mockResolvedValue({ sessionId: 'session-1', archived: true });
        getState.mockReturnValue({
            sessions: { 'session-1': { metadata: { machineId: 'machine-1', path: '/work' } } },
        });
    });

    it('archives through the machine RPC of the session host', async () => {
        const { sessionArchive } = await import('./ops');

        await expect(sessionArchive('session-1')).resolves.toEqual({ success: true });
        expect(machineRPC).toHaveBeenCalledWith('machine-1', 'archive-session', {
            sessionId: 'session-1',
            archived: true,
        });
    });

    it('restores an archived session through the same RPC', async () => {
        const { sessionArchive } = await import('./ops');

        await sessionArchive('session-1', false);

        expect(machineRPC).toHaveBeenCalledWith('machine-1', 'archive-session', {
            sessionId: 'session-1',
            archived: false,
        });
    });

    it('refuses when the session names no host to ask', async () => {
        getState.mockReturnValue({ sessions: { 'session-1': { metadata: { path: '/work' } } } });
        const { sessionArchive } = await import('./ops');

        await expect(sessionArchive('session-1')).resolves.toMatchObject({ success: false });
        expect(machineRPC).not.toHaveBeenCalled();
    });

    it('reports the host refusal rather than claiming success', async () => {
        machineRPC.mockRejectedValue(new Error('Session session-1 is not known to this machine'));
        const { sessionArchive } = await import('./ops');

        await expect(sessionArchive('session-1')).resolves.toEqual({
            success: false,
            message: 'Session session-1 is not known to this machine',
        });
    });
});
