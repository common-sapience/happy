import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BROWSER_AUTO_CONNECT_ENV_VAR,
  BROWSER_HEADLESS_ENV_VAR,
  buildEngineBrowserEnv,
  readBrowserSettings,
} from './browserSettings';
import { readSettings } from '@/persistence';

vi.mock('@/persistence', () => ({ readSettings: vi.fn() }));

const mockedReadSettings = vi.mocked(readSettings);

const baseSettings = { schemaVersion: 2, onboardingCompleted: true };

describe('ENG-04 browser switches in the settings file', () => {
  beforeEach(() => {
    mockedReadSettings.mockReset();
  });

  it('reads nothing when the host never set a switch', async () => {
    mockedReadSettings.mockResolvedValue({ ...baseSettings });

    await expect(readBrowserSettings()).resolves.toEqual({});
  });

  it('reads both switches the host set', async () => {
    mockedReadSettings.mockResolvedValue({ ...baseSettings, browserHeadless: true, browserAutoConnect: true });

    await expect(readBrowserSettings()).resolves.toEqual({ headless: true, autoConnect: true });
  });

  it('keeps an explicit off as off rather than dropping it', async () => {
    mockedReadSettings.mockResolvedValue({ ...baseSettings, browserHeadless: false });

    await expect(readBrowserSettings()).resolves.toEqual({ headless: false });
  });

  it('ignores a non-boolean value rather than coercing it on', async () => {
    mockedReadSettings.mockResolvedValue({
      ...baseSettings,
      browserHeadless: 'true' as unknown as boolean,
      browserAutoConnect: 1 as unknown as boolean,
    });

    await expect(readBrowserSettings()).resolves.toEqual({});
  });
});

describe('ENG-04 browser environment passed to the engine', () => {
  it('names nothing by default, so the engine keeps its own headed default', () => {
    expect(buildEngineBrowserEnv({})).toEqual({});
  });

  it('turns the window off only when the host asked for headless', () => {
    expect(buildEngineBrowserEnv({ headless: true })).toEqual({
      [BROWSER_HEADLESS_ENV_VAR]: 'true',
    });
  });

  it('passes an explicit headed through', () => {
    expect(buildEngineBrowserEnv({ headless: false })).toEqual({
      [BROWSER_HEADLESS_ENV_VAR]: 'false',
    });
  });

  it('passes auto-connect through on its own', () => {
    expect(buildEngineBrowserEnv({ autoConnect: true })).toEqual({
      [BROWSER_AUTO_CONNECT_ENV_VAR]: 'true',
    });
  });

  it('passes both when both are set', () => {
    expect(buildEngineBrowserEnv({ headless: true, autoConnect: false })).toEqual({
      [BROWSER_HEADLESS_ENV_VAR]: 'true',
      [BROWSER_AUTO_CONNECT_ENV_VAR]: 'false',
    });
  });
});
