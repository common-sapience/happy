import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ENGINE_AGENT_NAME,
  ENGINE_PATH_ENV_VAR,
  ENGINE_SIDECAR_NAME,
  isEngineAgentName,
  resolveAcpAgentConfig,
  resolveEngineCommand,
} from './acpAgentConfig';

describe('HOST-10 engine agent identity', () => {
  it('names the engine as the only agent', () => {
    expect(ENGINE_AGENT_NAME).toBe('opencode');
  });

  it('T-29: ships the engine under a product-prefixed file name', () => {
    expect(ENGINE_SIDECAR_NAME).toBe('happy-engine');
    expect(ENGINE_SIDECAR_NAME).not.toBe(ENGINE_AGENT_NAME);
  });

  it('accepts the engine and an unset agent, rejects every other agent', () => {
    expect(isEngineAgentName('opencode')).toBe(true);
    expect(isEngineAgentName(undefined)).toBe(true);
    for (const agent of ['claude', 'codex', 'gemini', 'openclaw', 'agy']) {
      expect(isEngineAgentName(agent)).toBe(false);
    }
  });
});

describe('resolveAcpAgentConfig', () => {
  it('HOST-10: defaults to the engine when no agent is named', () => {
    expect(resolveAcpAgentConfig([])).toEqual({
      agentName: 'opencode',
      command: 'opencode',
      args: ['acp'],
    });
  });

  it('resolves the engine name to its ACP invocation', () => {
    expect(resolveAcpAgentConfig(['opencode'])).toEqual({
      agentName: 'opencode',
      command: 'opencode',
      args: ['acp'],
    });
  });

  it('appends extra CLI args after the ACP subcommand', () => {
    expect(resolveAcpAgentConfig(['opencode', '--foo'])).toEqual({
      agentName: 'opencode',
      command: 'opencode',
      args: ['acp', '--foo'],
    });
  });

  it('strips legacy --acp for opencode compatibility', () => {
    expect(resolveAcpAgentConfig(['opencode', '--acp', '--foo'])).toEqual({
      agentName: 'opencode',
      command: 'opencode',
      args: ['acp', '--foo'],
    });
  });

  it('resolves a specific engine build with the -- separator', () => {
    expect(resolveAcpAgentConfig(['--', '/opt/engine/opencode', 'acp'])).toEqual({
      agentName: 'opencode',
      command: '/opt/engine/opencode',
      args: ['acp'],
    });
  });

  it('HOST-10: rejects every other agent name instead of running it as a command', () => {
    for (const agent of ['claude', 'codex', 'gemini', 'openclaw', 'agy']) {
      expect(() => resolveAcpAgentConfig([agent])).toThrow(`Unsupported agent: '${agent}'`);
    }
  });

  it('throws when separator form omits command', () => {
    expect(() => resolveAcpAgentConfig(['--'])).toThrow('Missing command after "--". Usage: happy acp -- <command> [args]');
  });
});

describe('DESK-09 engine resolution in a desktop install', () => {
  const packagedDir = '/usr/bin';
  const engineBeside = '/usr/bin/happy-engine';

  it('prefers the explicit engine path over everything else', () => {
    expect(
      resolveEngineCommand({
        env: { [ENGINE_PATH_ENV_VAR]: '/builds/opencode' },
        packaged: true,
        executableDir: packagedDir,
        exists: () => true,
      }),
    ).toBe('/builds/opencode');
  });

  it('uses the engine shipped next to the daemon', () => {
    expect(
      resolveEngineCommand({
        env: {},
        packaged: true,
        executableDir: packagedDir,
        exists: (path) => path === engineBeside,
        platform: 'linux',
      }),
    ).toBe(engineBeside);
  });

  it('T-29: never takes a sibling named after the generic engine, which is the user\'s own install', () => {
    const probed: string[] = [];
    expect(
      resolveEngineCommand({
        env: {},
        packaged: true,
        executableDir: packagedDir,
        exists: (path) => {
          probed.push(path);
          return path === join(packagedDir, 'opencode');
        },
        platform: 'linux',
      }),
    ).toBe('opencode');
    expect(probed).toEqual([engineBeside]);
  });

  it('looks for the Windows executable name on Windows', () => {
    const probed: string[] = [];
    const installDir = 'C:\\Program Files\\Happy';
    resolveEngineCommand({
      env: {},
      packaged: true,
      executableDir: installDir,
      exists: (path) => {
        probed.push(path);
        return false;
      },
      platform: 'win32',
    });

    expect(probed).toEqual([join(installDir, 'happy-engine.exe')]);
  });

  it('falls back to the engine on PATH when nothing ships beside the daemon', () => {
    expect(
      resolveEngineCommand({ env: {}, packaged: true, executableDir: packagedDir, exists: () => false }),
    ).toBe('opencode');
  });

  it('does not probe the executable directory outside a desktop install', () => {
    const probed: string[] = [];
    expect(
      resolveEngineCommand({
        env: {},
        packaged: false,
        executableDir: packagedDir,
        exists: (path) => {
          probed.push(path);
          return true;
        },
      }),
    ).toBe('opencode');
    expect(probed).toEqual([]);
  });
});
