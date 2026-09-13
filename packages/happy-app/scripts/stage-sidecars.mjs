#!/usr/bin/env node

/**
 * Builds the two sidecars the desktop installer ships (DESK-09) and stages them
 * under src-tauri/binaries with the target triple Tauri expects.
 *
 * Both are single-file executables compiled by Bun: the daemon from this
 * repository, the engine from the engine fork. The engine checkout is passed in
 * because it is a separate repository, pinned by the harness.
 *
 * Usage: node scripts/stage-sidecars.mjs --engine-repo <path> [--target <triple>]
 */

import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(appDir, '..', '..');
const binariesDir = join(appDir, 'src-tauri', 'binaries');

const DAEMON_NAME = 'happy-daemon';
const ENGINE_NAME = 'opencode';

function parseArgs(argv) {
  const args = { engineRepo: process.env.ENGINE_REPO, target: process.env.SIDECAR_TARGET };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--engine-repo') {
      args.engineRepo = argv[++i];
    } else if (argv[i] === '--target') {
      args.target = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  if (!args.engineRepo) {
    throw new Error('Pass the engine checkout with --engine-repo <path> or ENGINE_REPO=<path>');
  }
  return args;
}

// Windows ships pnpm as a .cmd wrapper, which Node refuses to spawn directly.
const windowsHost = process.platform === 'win32';

function run(command, args, cwd, env = {}) {
  console.log(`> ${command} ${args.join(' ')}`);
  const quoted = windowsHost ? args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)) : args;
  execFileSync(command, quoted, { cwd, stdio: 'inherit', shell: windowsHost, env: { ...process.env, ...env } });
}

function capture(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' });
}

/** The triple Tauri appends to every external binary, as reported by the Rust toolchain. */
function hostTargetTriple() {
  const host = capture('rustc', ['-vV'])
    .split('\n')
    .find((line) => line.startsWith('host:'));
  if (!host) {
    throw new Error('Could not read the host target triple from rustc -vV');
  }
  return host.replace('host:', '').trim();
}

/** Bun names its compile targets by platform and architecture, not by Rust triple. */
function bunTarget(triple) {
  const arch = triple.startsWith('aarch64') ? 'arm64' : 'x64';
  if (triple.includes('darwin')) return { bun: `bun-darwin-${arch}`, os: 'darwin', arch };
  if (triple.includes('windows')) return { bun: `bun-windows-${arch}`, os: 'windows', arch };
  if (triple.includes('linux')) return { bun: `bun-linux-${arch}`, os: 'linux', arch };
  throw new Error(`Unsupported target triple: ${triple}`);
}

function stagedPath(name, triple, windows) {
  return join(binariesDir, `${name}-${triple}${windows ? '.exe' : ''}`);
}

function buildDaemon(target, triple, windows) {
  run('pnpm', ['--filter', '@slopus/happy-wire', 'build'], repoRoot);
  run('pnpm', ['--filter', 'happy', 'build'], repoRoot);

  const entrypoint = join(repoRoot, 'packages', 'happy-cli', 'dist', 'index.mjs');
  const outfile = stagedPath(DAEMON_NAME, triple, windows);
  run('bun', ['build', '--compile', `--target=${target.bun}`, entrypoint, '--outfile', outfile], repoRoot);
  return outfile;
}

function buildEngine(engineRepo, target, triple, windows) {
  const engineDir = join(resolve(engineRepo), 'packages', 'opencode');
  if (!existsSync(engineDir)) {
    throw new Error(`No engine package at ${engineDir}`);
  }

  // A checkout that already has its dependencies is left untouched: local builds
  // reuse the engine worktree, CI starts from a fresh clone.
  const installed = existsSync(join(resolve(engineRepo), 'node_modules'));
  if (!installed) {
    run('bun', ['install', '--frozen-lockfile'], resolve(engineRepo));
  }
  run('bun', ['run', 'script/build.ts', '--single', ...(installed ? ['--skip-install'] : [])], engineDir);

  const built = join(engineDir, 'dist', `opencode-${target.os}-${target.arch}`, 'bin', windows ? 'opencode.exe' : 'opencode');
  if (!existsSync(built)) {
    throw new Error(`The engine build produced no binary at ${built}`);
  }

  const outfile = stagedPath(ENGINE_NAME, triple, windows);
  copyFileSync(built, outfile);
  return outfile;
}

const args = parseArgs(process.argv.slice(2));
const triple = args.target ?? hostTargetTriple();
const target = bunTarget(triple);
const windows = target.os === 'windows';

rmSync(binariesDir, { recursive: true, force: true });
mkdirSync(binariesDir, { recursive: true });

const staged = [buildDaemon(target, triple, windows), buildEngine(args.engineRepo, target, triple, windows)];

for (const file of staged) {
  chmodSync(file, 0o755);
  console.log(`staged ${file} (${(statSync(file).size / 1024 / 1024).toFixed(1)} MB)`);
}
