import { describe, expect, it } from 'vitest';
import { ENGINE_AGENT_NAME, isEngineAgentName, resolveAcpAgentConfig } from './acpAgentConfig';

describe('HOST-10 engine agent identity', () => {
  it('names the engine as the only agent', () => {
    expect(ENGINE_AGENT_NAME).toBe('opencode');
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
