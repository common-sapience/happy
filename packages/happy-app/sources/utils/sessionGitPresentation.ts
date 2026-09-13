import type { GitStatusFiles } from '@/sync/gitStatusFiles';
import type { GitStatus, Metadata } from '@/sync/storageTypes';
import type { VisibleGitLineChanges } from './gitLineChanges';
import { resolveStatusBarGitBranch } from './sessionStatusBar';

export function resolveSessionGitPresentation(
    metadata: Metadata | null | undefined,
    gitStatus: GitStatus | null,
    gitStatusFiles: GitStatusFiles | null = null,
): {
    subtitle: string | undefined;
    changedFileCount: number | null;
    changes: VisibleGitLineChanges | null;
} {
    const metadataBranch = typeof metadata?.gitBranch === 'string' ? metadata.gitBranch : null;
    const subtitle = metadata?.workspace?.name.trim()
        || resolveStatusBarGitBranch(gitStatus?.branch ?? gitStatusFiles?.branch, metadataBranch)
        || undefined;

    const files = gitStatusFiles
        ? [...gitStatusFiles.stagedFiles, ...gitStatusFiles.unstagedFiles]
        : null;
    const changedFileCount = files ? new Set(files.map((file) => file.fullPath)).size : null;
    const hasLiveStatus = gitStatus !== null && gitStatus.lastUpdatedAt > 0;
    const insertions = hasLiveStatus
        ? gitStatus.linesAdded
        : files?.reduce((total, file) => total + file.linesAdded, 0) ?? 0;
    const deletions = hasLiveStatus
        ? gitStatus.linesRemoved
        : files?.reduce((total, file) => total + file.linesRemoved, 0) ?? 0;

    return {
        subtitle,
        changedFileCount,
        changes: insertions > 0 || deletions > 0
            ? { insertions, deletions, approximate: false }
            : null,
    };
}