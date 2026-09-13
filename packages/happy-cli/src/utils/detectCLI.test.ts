import { execSync } from 'child_process';
import os from 'os';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { detectCLIAvailability } from './detectCLI';

vi.mock('child_process', () => ({ execSync: vi.fn() }));
vi.mock('os', () => ({
  default: {
    homedir: vi.fn(() => '/home/person'),
    platform: vi.fn(() => 'darwin'),
  },
}));

const mockedExecSync = vi.mocked(execSync);
const mockedPlatform = vi.mocked(os.platform);

describe('HOST-10 machine capability report', () => {
  beforeEach(() => {
    mockedExecSync.mockReset();
    mockedExecSync.mockImplementation(() => {
      throw new Error('not installed');
    });
    mockedPlatform.mockReturnValue('darwin');
  });

  it('reports only the engine', () => {
    expect(Object.keys(detectCLIAvailability()).sort()).toEqual(['detectedAt', 'opencode']);
  });

  it('reports the engine as unavailable when the command does not resolve', () => {
    expect(detectCLIAvailability().opencode).toBe(false);
    expect(mockedExecSync).toHaveBeenCalledTimes(1);
    expect(String(mockedExecSync.mock.calls[0][0])).toContain('opencode');
  });

  it('reports the engine as available when the command resolves', () => {
    mockedExecSync.mockImplementation(() => Buffer.from(''));

    expect(detectCLIAvailability().opencode).toBe(true);
  });

  it('probes with PowerShell on Windows', () => {
    mockedPlatform.mockReturnValue('win32');
    mockedExecSync.mockImplementation(() => Buffer.from(''));

    expect(detectCLIAvailability().opencode).toBe(true);
    expect(String(mockedExecSync.mock.calls[0][0])).toContain('Get-Command opencode');
  });
});

describe('DESK-09 engine shipped with the desktop install', () => {
  beforeEach(() => {
    mockedExecSync.mockReset();
  });

  it('answers from the file itself when the engine path is explicit', () => {
    vi.stubEnv('HAPPY_ENGINE_PATH', process.execPath);

    expect(detectCLIAvailability().opencode).toBe(true);
    expect(mockedExecSync).not.toHaveBeenCalled();

    vi.unstubAllEnvs();
  });

  it('reports the engine missing when the explicit path does not exist', () => {
    vi.stubEnv('HAPPY_ENGINE_PATH', '/nonexistent/opencode');

    expect(detectCLIAvailability().opencode).toBe(false);
    expect(mockedExecSync).not.toHaveBeenCalled();

    vi.unstubAllEnvs();
  });
});
