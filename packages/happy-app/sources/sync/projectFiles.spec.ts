import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sessionBash, getState } = vi.hoisted(() => ({
    sessionBash: vi.fn(),
    getState: vi.fn(),
}));

vi.mock('./ops', () => ({ sessionBash }));
vi.mock('./storage', () => ({ storage: { getState } }));

const GIT_FAILURE = {
    success: true,
    stdout: '',
    stderr: 'fatal: not a git repository (or any of the parent directories): .git',
    exitCode: 128,
};

function bashOk(stdout: string) {
    return { success: true, stdout, stderr: '', exitCode: 0 };
}

describe('project file listing outside a git repository', () => {
    beforeEach(() => {
        sessionBash.mockReset();
        getState.mockReturnValue({
            sessions: { 'session-1': { metadata: { machineId: 'machine-1', path: '/home/user/proj' } } },
        });
    });

    it('lists tracked and untracked files through git when the folder is a repository', async () => {
        sessionBash.mockResolvedValueOnce(bashOk('src/index.ts\nREADME.md\n'));
        const { getProjectFiles } = await import('./projectFiles');

        const result = await getProjectFiles('session-1');

        expect(sessionBash).toHaveBeenCalledTimes(1);
        expect(sessionBash.mock.calls[0][1].command).toContain('git');
        expect(result).toMatchObject({
            fromGit: true,
            truncated: false,
            files: [
                { fileName: 'index.ts', filePath: 'src', fullPath: 'src/index.ts' },
                { fileName: 'README.md', filePath: '', fullPath: 'README.md' },
            ],
        });
    });

    it('keeps an empty repository on the git source instead of falling back', async () => {
        sessionBash.mockResolvedValueOnce(bashOk(''));
        const { getProjectFiles } = await import('./projectFiles');

        const result = await getProjectFiles('session-1');

        expect(sessionBash).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ fromGit: true, files: [] });
    });

    it('falls back to a portable listing when the folder is not a repository', async () => {
        sessionBash.mockResolvedValueOnce(GIT_FAILURE);
        sessionBash.mockResolvedValueOnce(bashOk('./hello.txt\n./notes/todo.md\n'));
        const { getProjectFiles } = await import('./projectFiles');

        const result = await getProjectFiles('session-1');

        expect(sessionBash).toHaveBeenCalledTimes(2);
        expect(result).toMatchObject({
            fromGit: false,
            truncated: false,
            files: [
                { fileName: 'hello.txt', filePath: '', fullPath: 'hello.txt' },
                { fileName: 'todo.md', filePath: 'notes', fullPath: 'notes/todo.md' },
            ],
        });
    });

    it('bounds the fallback listing and excludes the usual noise directories', async () => {
        sessionBash.mockResolvedValueOnce(GIT_FAILURE);
        sessionBash.mockResolvedValueOnce(bashOk('./hello.txt\n'));
        const { getProjectFiles, PROJECT_FILES_EXCLUDED_DIRECTORIES, PROJECT_FILES_MAX_ENTRIES } =
            await import('./projectFiles');

        await getProjectFiles('session-1');

        const command: string = sessionBash.mock.calls[1][1].command;
        expect(command).toContain('find .');
        expect(command).toContain('-type f');
        expect(command).toContain(`head -n ${PROJECT_FILES_MAX_ENTRIES + 1}`);
        for (const directory of PROJECT_FILES_EXCLUDED_DIRECTORIES) {
            expect(command).toContain(`-name '${directory}'`);
        }
        expect(PROJECT_FILES_EXCLUDED_DIRECTORIES).toContain('.git');
        expect(PROJECT_FILES_EXCLUDED_DIRECTORIES).toContain('node_modules');
    });

    it('marks the listing truncated when the folder holds more files than the cap', async () => {
        const { PROJECT_FILES_MAX_ENTRIES } = await import('./projectFiles');
        const overflowing = Array.from(
            { length: PROJECT_FILES_MAX_ENTRIES + 1 },
            (_, index) => `./file-${index}.txt`,
        ).join('\n');
        sessionBash.mockResolvedValueOnce(GIT_FAILURE);
        sessionBash.mockResolvedValueOnce(bashOk(overflowing));
        const { getProjectFiles } = await import('./projectFiles');

        const result = await getProjectFiles('session-1');

        expect(result?.truncated).toBe(true);
        expect(result?.files).toHaveLength(PROJECT_FILES_MAX_ENTRIES);
    });

    it('reports an empty folder as an empty listing, not as a failure', async () => {
        sessionBash.mockResolvedValueOnce(GIT_FAILURE);
        sessionBash.mockResolvedValueOnce(bashOk(''));
        const { getProjectFiles } = await import('./projectFiles');

        const result = await getProjectFiles('session-1');

        expect(result).toMatchObject({ fromGit: false, files: [] });
    });

    it('gives up at once when the computer does not answer, instead of asking twice', async () => {
        sessionBash.mockResolvedValue({
            success: false,
            stdout: '',
            stderr: 'The computer did not respond',
            exitCode: -1,
            error: 'The computer did not respond',
        });
        const { getProjectFiles } = await import('./projectFiles');

        await expect(getProjectFiles('session-1')).resolves.toBeNull();
        expect(sessionBash).toHaveBeenCalledTimes(1);
    });

    it('gives up at once when the listing command times out', async () => {
        sessionBash.mockResolvedValue({
            success: false,
            stdout: '',
            stderr: '',
            exitCode: -1,
            error: 'Command timed out',
        });
        const { getProjectFiles } = await import('./projectFiles');

        await expect(getProjectFiles('session-1')).resolves.toBeNull();
        expect(sessionBash).toHaveBeenCalledTimes(1);
    });

    it('returns no listing when the fallback itself cannot run', async () => {
        sessionBash.mockResolvedValueOnce(GIT_FAILURE);
        sessionBash.mockResolvedValueOnce({
            success: false,
            stdout: '',
            stderr: 'find: not found',
            exitCode: 127,
            error: 'Command failed',
        });
        const { getProjectFiles } = await import('./projectFiles');

        await expect(getProjectFiles('session-1')).resolves.toBeNull();
        expect(sessionBash).toHaveBeenCalledTimes(2);
    });

    it('asks with a bounded timeout so an unanswering computer cannot hang the panel', async () => {
        sessionBash.mockResolvedValueOnce(GIT_FAILURE);
        sessionBash.mockResolvedValueOnce(bashOk('./hello.txt\n'));
        const { getProjectFiles } = await import('./projectFiles');

        await getProjectFiles('session-1');

        for (const call of sessionBash.mock.calls) {
            expect(call[1].timeout).toBeGreaterThan(0);
            expect(call[1].timeout).toBeLessThanOrEqual(15000);
            expect(call[1].cwd).toBe('/home/user/proj');
        }
    });

    it('returns no listing when the session has no folder to list', async () => {
        getState.mockReturnValue({ sessions: { 'session-1': { metadata: {} } } });
        const { getProjectFiles } = await import('./projectFiles');

        await expect(getProjectFiles('session-1')).resolves.toBeNull();
        expect(sessionBash).not.toHaveBeenCalled();
    });
});
