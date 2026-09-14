/**
 * Project file listing.
 *
 * Most folders a general agent works in are not git repositories, so the
 * listing asks git first (cheap, honours .gitignore) and falls back to a
 * bounded `find` when git says the folder is not a repository. The result
 * records which of the two answered, so a git-only view can say so instead of
 * rendering an empty list.
 */

import { sessionBash } from './ops';
import { storage } from './storage';

export interface ProjectFile {
    fileName: string;
    filePath: string;
    fullPath: string;
}

export interface ProjectFilesList {
    files: ProjectFile[];
    fetchedAt: number;
    fromGit: boolean;
    truncated: boolean;
}

/** Directories the fallback listing never descends into, at any depth. */
export const PROJECT_FILES_EXCLUDED_DIRECTORIES = [
    '.git',
    'node_modules',
    '.venv',
    '__pycache__',
    'dist',
    'build',
    '.next',
    'target',
] as const;

/** Upper bound on listed files. A folder with more is listed up to here and marked truncated. */
export const PROJECT_FILES_MAX_ENTRIES = 2000;

/** Matches the daemon-side cap on a bash RPC, so a silent computer fails instead of hanging. */
const LISTING_TIMEOUT_MS = 15000;

const GIT_LIST_COMMAND = 'git -c core.quotepath=false ls-files --cached --others --exclude-standard';

function buildFallbackListCommand(): string {
    const prunedNames = PROJECT_FILES_EXCLUDED_DIRECTORIES.map((name) => `-name '${name}'`).join(' -o ');
    // One line over the cap is fetched so a truncated listing is distinguishable
    // from a folder that holds exactly the cap.
    return `find . \\( ${prunedNames} \\) -prune -o -type f -print 2>/dev/null | head -n ${PROJECT_FILES_MAX_ENTRIES + 1}`;
}

function toProjectFiles(stdout: string): { files: ProjectFile[]; truncated: boolean } {
    const paths = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => (line.startsWith('./') ? line.slice(2) : line))
        .filter((line) => line.length > 0);

    const truncated = paths.length > PROJECT_FILES_MAX_ENTRIES;
    const files = paths.slice(0, PROJECT_FILES_MAX_ENTRIES).map((path) => {
        const parts = path.split('/');
        const fileName = parts[parts.length - 1] || path;
        const filePath = parts.slice(0, -1).join('/');
        return { fileName, filePath, fullPath: path };
    });

    return { files, truncated };
}

/**
 * Fetch the files of a session's folder.
 * Returns null when the folder is unknown or neither listing could be run.
 */
export async function getProjectFiles(sessionId: string): Promise<ProjectFilesList | null> {
    const session = storage.getState().sessions[sessionId];
    if (!session?.metadata?.path) {
        return null;
    }

    const cwd = session.metadata.path;

    const gitResult = await sessionBash(sessionId, {
        command: GIT_LIST_COMMAND,
        cwd,
        timeout: LISTING_TIMEOUT_MS,
    });

    if (gitResult.success && gitResult.exitCode === 0) {
        const { files, truncated } = toProjectFiles(gitResult.stdout ?? '');
        return { files, truncated, fromGit: true, fetchedAt: Date.now() };
    }

    // A positive exit code means the command ran and git refused the folder, so
    // the fallback is worth asking. Anything else (no answer, timeout) means the
    // computer is not listing anything right now: say so rather than waiting twice.
    if (typeof gitResult.exitCode !== 'number' || gitResult.exitCode <= 0) {
        return null;
    }

    const fallbackResult = await sessionBash(sessionId, {
        command: buildFallbackListCommand(),
        cwd,
        timeout: LISTING_TIMEOUT_MS,
    });

    if (!fallbackResult.success || fallbackResult.exitCode !== 0) {
        return null;
    }

    const { files, truncated } = toProjectFiles(fallbackResult.stdout ?? '');
    return { files, truncated, fromGit: false, fetchedAt: Date.now() };
}
