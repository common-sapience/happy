import { execSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionMetadata } from './createSessionMetadata';

vi.mock('node:child_process', () => ({
    execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(execSync);

describe('createSessionMetadata', () => {
    beforeEach(() => {
        mockedExecSync.mockReset();
        mockedExecSync.mockReturnValue('main\n');
    });

    it('HOST-10: reports the engine as the session flavor', () => {
        const { metadata } = createSessionMetadata({
            flavor: 'opencode',
            machineId: 'machine-1',
            startedBy: 'daemon',
        });

        expect(metadata.flavor).toBe('opencode');
    });

    it('HOST-12: carries the agent profile into session metadata', () => {
        const { metadata } = createSessionMetadata({
            flavor: 'opencode',
            machineId: 'machine-2',
            agentProfile: 'research',
        });

        expect(metadata.agentProfile).toBe('research');
    });

    it('HOST-12: omits the agent profile when the session runs on the default', () => {
        const { metadata } = createSessionMetadata({
            flavor: 'opencode',
            machineId: 'machine-3',
        });

        expect(metadata.agentProfile).toBeUndefined();
    });

    it('sets fork lineage metadata when provided', () => {
        const { metadata } = createSessionMetadata({
            flavor: 'opencode',
            machineId: 'machine-6',
            parentSessionId: 'happy-source',
        });

        expect(metadata.parentSessionId).toBe('happy-source');
    });

    it('sets metadata.isSideChat when the session is a side chat', () => {
        const { metadata } = createSessionMetadata({
            flavor: 'opencode',
            machineId: 'machine-side',
            parentSessionId: 'happy-parent',
            isSideChat: true,
        });

        expect(metadata.isSideChat).toBe(true);
        expect(metadata.parentSessionId).toBe('happy-parent');
    });

    it('omits metadata.isSideChat for a normal session', () => {
        const { metadata } = createSessionMetadata({
            flavor: 'opencode',
            machineId: 'machine-normal',
        });

        expect(metadata.isSideChat).toBeUndefined();
    });

    it('sets metadata.gitBranch when a git branch is detected', () => {
        mockedExecSync.mockReturnValue('fix/session-status\n');

        const { metadata } = createSessionMetadata({
            flavor: 'opencode',
            machineId: 'machine-7',
        });

        expect(metadata.gitBranch).toBe('fix/session-status');
        expect(mockedExecSync).toHaveBeenCalledWith('git rev-parse --abbrev-ref HEAD', expect.objectContaining({
            cwd: process.cwd(),
        }));
    });

    it('omits metadata.gitBranch when git is unavailable or detached', () => {
        mockedExecSync.mockReturnValue('HEAD\n');

        const detached = createSessionMetadata({
            flavor: 'opencode',
            machineId: 'machine-8',
        });

        expect(detached.metadata.gitBranch).toBeUndefined();

        mockedExecSync.mockImplementation(() => {
            throw new Error('not a git repository');
        });

        const unavailable = createSessionMetadata({
            flavor: 'opencode',
            machineId: 'machine-9',
        });

        expect(unavailable.metadata.gitBranch).toBeUndefined();
    });
});
