import type { SessionRowData } from '@/sync/storage';
import { getRepoPath, getWorktreeName, isWorktreePath } from '@/utils/worktreePaths';

/**
 * One agent as the list shows it: the agent's own title, plus the folder (and
 * worktree) it runs in spelled out on the row.
 */
export interface FlatSessionRowData {
    session: SessionRowData;
    projectName: string;
    /** Null in a project's primary checkout, which needs no second name. */
    workspaceName: string | null;
}

/**
 * Names the folder an agent works in: a worktree reports its repository as the
 * project and itself as the workspace.
 */
export function toFlatSessionRow(session: SessionRowData): FlatSessionRowData {
    const path = session.path?.trim() || '';
    const worktree = isWorktreePath(path);
    const projectPath = worktree ? getRepoPath(path) : path;
    return {
        session,
        projectName: session.projectName
            ?? projectPath.split(/[\\/]/).filter(Boolean).at(-1)
            ?? '',
        workspaceName: session.workspaceName ?? (worktree ? getWorktreeName(path) : null),
    };
}
