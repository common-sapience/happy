/**
 * Low-level ripgrep wrapper - just arguments in, string out
 */

import { spawn as crossSpawn } from 'cross-spawn';
import { existsSync } from 'node:fs';
import { projectPath } from '@/projectPath';
import { join, resolve } from 'path';

export interface RipgrepResult {
    exitCode: number
    stdout: string
    stderr: string
}

export interface RipgrepOptions {
    cwd?: string
}

/**
 * Run ripgrep with the given arguments
 * @param args - Array of command line arguments to pass to ripgrep
 * @param options - Options for ripgrep execution
 * @returns Promise with exit code, stdout and stderr
 */
export function run(args: string[], options?: RipgrepOptions): Promise<RipgrepResult> {
    const launcher = ripgrepLauncherPath();
    // Desktop installs ship the daemon as one compiled executable, so the
    // launcher script is not on disk (DESK-09); there the system ripgrep is run
    // directly and search degrades to unavailable when none is installed.
    const command = launcher ? 'node' : 'rg';
    const commandArgs = launcher ? [launcher, JSON.stringify(args)] : args;
    return new Promise((resolve, reject) => {
        // Use cross-spawn so `node` resolves to `node.exe` on Windows (issue #1082).
        const child = crossSpawn(command, commandArgs, {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: options?.cwd,
            windowsHide: true,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            resolve({
                exitCode: code || 0,
                stdout,
                stderr
            });
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

export function ripgrepLauncherPath(): string | null {
    const launcher = resolve(join(projectPath(), 'scripts', 'ripgrep_launcher.cjs'));
    return existsSync(launcher) ? launcher : null;
}
