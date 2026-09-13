import { describe, expect, it } from 'vitest';
import { toFlatSessionRow } from './flatSessionList';
import type { SessionRowData } from '@/sync/storage';

function row(overrides: Partial<SessionRowData> & { id: string }): SessionRowData {
    return {
        name: overrides.id,
        subtitle: '',
        avatarId: overrides.id,
        state: 'waiting',
        createdAt: 0,
        lastActivityAt: 0,
        hasDraft: false,
        active: true,
        archived: false,
        machineId: 'machine',
        machineOffline: false,
        path: null,
        homeDir: null,
        completedTodosCount: 0,
        totalTodosCount: 0,
        hasUnread: false,
        projectId: null,
        projectName: null,
        workspaceId: null,
        workspaceName: null,
        ...overrides,
    };
}

describe('toFlatSessionRow', () => {
    it('names the folder the agent works in', () => {
        expect(toFlatSessionRow(row({ id: 'a', path: '/home/steve/code/happy' }))).toMatchObject({
            projectName: 'happy',
            workspaceName: null,
        });
    });

    it('prefers the project name the host published', () => {
        expect(toFlatSessionRow(row({
            id: 'a',
            path: '/home/steve/code/happy',
            projectName: 'Happy',
        })).projectName).toBe('Happy');
    });

    it('names a worktree by its repository and its own branch folder', () => {
        const flat = toFlatSessionRow(row({
            id: 'a',
            path: '/home/steve/code/happy/.dev/worktree/innsbruck',
        }));
        expect(flat.projectName).toBe('happy');
        expect(flat.workspaceName).toBe('innsbruck');
    });

    it('leaves the folder blank rather than guessing when there is no path', () => {
        expect(toFlatSessionRow(row({ id: 'a' }))).toMatchObject({
            projectName: '',
            workspaceName: null,
        });
    });
});
