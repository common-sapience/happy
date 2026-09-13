/**
 * The permission confirmation switch against the real settings file (PERM-05, PERM-08).
 *
 * permissionSwitch.test.ts stubs persistence to pin the reading rules; this suite keeps the
 * settings file itself in the loop, because the switch a control end flips has to survive a daemon
 * restart and must not take an unrelated field down with it.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const testHome = vi.hoisted(() => ({ directory: '' }));

vi.mock('@/configuration', () => {
  testHome.directory = mkdtempSync(join(tmpdir(), 'harness-permission-switch-'));
  return {
    configuration: {
      happyHomeDir: testHome.directory,
      settingsFile: join(testHome.directory, 'settings.json'),
    },
  };
});

vi.mock('@/ui/logger', () => ({
  logger: { debug: vi.fn(), debugLargeJson: vi.fn(), warn: vi.fn() },
}));

import {
  readPermissionConfirmationEnabled,
  writePermissionConfirmationEnabled,
} from './permissionSwitch';

const settingsFile = () => join(testHome.directory, 'settings.json');
const readSettingsFile = () => JSON.parse(readFileSync(settingsFile(), 'utf8'));

describe('PERM-05 / PERM-08 the switch round trips through the settings file', () => {
  beforeEach(() => {
    if (existsSync(settingsFile())) {
      rmSync(settingsFile());
    }
  });

  afterAll(() => {
    rmSync(testHome.directory, { recursive: true, force: true });
  });

  it('PERM-08: reads as off while the host has written no settings at all', async () => {
    await expect(readPermissionConfirmationEnabled()).resolves.toBe(false);
  });

  it('PERM-05: a switch a control end turned on is readable again from disk', async () => {
    await expect(writePermissionConfirmationEnabled(true)).resolves.toBe(true);

    await expect(readPermissionConfirmationEnabled()).resolves.toBe(true);
    expect(readSettingsFile().permissionConfirmationEnabled).toBe(true);
  });

  it('PERM-05: turning the switch back off is persisted, not just forgotten', async () => {
    await writePermissionConfirmationEnabled(true);

    await expect(writePermissionConfirmationEnabled(false)).resolves.toBe(false);

    await expect(readPermissionConfirmationEnabled()).resolves.toBe(false);
    expect(readSettingsFile().permissionConfirmationEnabled).toBe(false);
  });

  it('PERM-05: writes the switch without dropping settings another writer owns', async () => {
    writeFileSync(settingsFile(), JSON.stringify({
      schemaVersion: 2,
      onboardingCompleted: true,
      machineId: 'machine-1',
      browserHeadless: true,
    }));

    await writePermissionConfirmationEnabled(true);

    expect(readSettingsFile()).toEqual(expect.objectContaining({
      schemaVersion: 2,
      onboardingCompleted: true,
      machineId: 'machine-1',
      browserHeadless: true,
      permissionConfirmationEnabled: true,
    }));
  });

  it('PERM-08: refuses a non-boolean and leaves the stored switch alone', async () => {
    await writePermissionConfirmationEnabled(false);

    await expect(writePermissionConfirmationEnabled('yes' as unknown as boolean))
      .rejects.toThrow('must be a boolean');

    expect(readSettingsFile().permissionConfirmationEnabled).toBe(false);
  });
});
