/**
 * Where the daemon is running from.
 *
 * Two layouts exist. Installed from npm the daemon is JavaScript under a package
 * directory, so sibling files are found relative to the source file. Shipped
 * inside the desktop installer it is a single-file executable compiled by Bun
 * (DESK-09), its sources live in a virtual filesystem, and everything it needs
 * on disk — the engine binary above all — sits next to `process.execPath`.
 */

import { dirname } from 'node:path';

const BUN_VIRTUAL_ROOTS = ['/$bunfs/', 'B:\\~BUN\\', '/~BUN/'];

/**
 * True when this process is a Bun single-file executable. Bun maps the bundled
 * sources onto a virtual root, which is what distinguishes a compiled binary
 * from `bun run` over real files.
 */
export function isPackagedExecutable(): boolean {
  const main = (globalThis as { Bun?: { main?: string } }).Bun?.main;
  if (typeof main !== 'string') {
    return false;
  }
  return BUN_VIRTUAL_ROOTS.some((root) => main.startsWith(root));
}

/** Directory holding the shipped executable and the binaries installed beside it. */
export function packagedExecutableDir(): string {
  return dirname(process.execPath);
}
