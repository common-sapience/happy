import { dirname } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { isPackagedExecutable, packagedExecutableDir } from './packagedExecutable';

const bun = globalThis as { Bun?: { main?: string } };

describe('DESK-09 packaged daemon layout', () => {
  const original = bun.Bun;

  afterEach(() => {
    if (original === undefined) {
      delete bun.Bun;
    } else {
      bun.Bun = original;
    }
  });

  it('is not packaged when running on a JavaScript runtime over real files', () => {
    delete bun.Bun;
    expect(isPackagedExecutable()).toBe(false);
  });

  it('is not packaged when Bun runs sources from disk', () => {
    bun.Bun = { main: '/home/person/happy/packages/happy-cli/dist/index.mjs' };
    expect(isPackagedExecutable()).toBe(false);
  });

  it('is packaged when Bun serves the sources from its virtual root', () => {
    bun.Bun = { main: '/$bunfs/root/happy-daemon' };
    expect(isPackagedExecutable()).toBe(true);
  });

  it('is packaged for the Windows virtual root', () => {
    bun.Bun = { main: 'B:\\~BUN\\root\\happy-daemon.exe' };
    expect(isPackagedExecutable()).toBe(true);
  });

  it('points at the directory the executable was installed into', () => {
    expect(packagedExecutableDir()).toBe(dirname(process.execPath));
  });
});
