import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ENGINE_PERMISSION_ENV_VAR,
  buildEnginePermissionEnv,
  readPermissionConfirmationEnabled,
} from './permissionSwitch';
import { readSettings } from '@/persistence';

vi.mock('@/persistence', () => ({ readSettings: vi.fn() }));

const mockedReadSettings = vi.mocked(readSettings);

describe('PERM-08 permission confirmation switch', () => {
  beforeEach(() => {
    mockedReadSettings.mockReset();
  });

  it('is off when the host has never set it', async () => {
    mockedReadSettings.mockResolvedValue({ schemaVersion: 2, onboardingCompleted: true });

    await expect(readPermissionConfirmationEnabled()).resolves.toBe(false);
  });

  it('is off when explicitly disabled', async () => {
    mockedReadSettings.mockResolvedValue({
      schemaVersion: 2,
      onboardingCompleted: true,
      permissionConfirmationEnabled: false,
    });

    await expect(readPermissionConfirmationEnabled()).resolves.toBe(false);
  });

  it('is on only when the host set it to true', async () => {
    mockedReadSettings.mockResolvedValue({
      schemaVersion: 2,
      onboardingCompleted: true,
      permissionConfirmationEnabled: true,
    });

    await expect(readPermissionConfirmationEnabled()).resolves.toBe(true);
  });

  it('refuses a non-boolean value rather than reading it as on', async () => {
    mockedReadSettings.mockResolvedValue({
      schemaVersion: 2,
      onboardingCompleted: true,
      permissionConfirmationEnabled: 'yes' as unknown as boolean,
    });

    await expect(readPermissionConfirmationEnabled()).resolves.toBe(false);
  });
});

describe('PERM-08 engine permission baseline', () => {
  it('pins the allow baseline while confirmation is off', () => {
    expect(buildEnginePermissionEnv(false)).toEqual({
      [ENGINE_PERMISSION_ENV_VAR]: '{"*":"allow"}',
    });
  });

  it('pins nothing while confirmation is on, so the engine applies its own rules', () => {
    expect(buildEnginePermissionEnv(true)).toEqual({});
  });
});
