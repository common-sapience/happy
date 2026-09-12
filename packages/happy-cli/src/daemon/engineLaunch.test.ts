import { describe, expect, it } from 'vitest';
import { AGENT_PROFILE_FLAG, buildEngineSessionLaunchArgs, rejectNonEngineSpawn } from './engineLaunch';

describe('HOST-10 daemon spawns the engine', () => {
  it('starts the engine over ACP and marks the session as daemon-started', () => {
    expect(buildEngineSessionLaunchArgs({})).toEqual([
      'acp',
      'opencode',
      '--started-by',
      'daemon',
    ]);
  });

  it('keeps the command the e2e drives by hand working', () => {
    // e2e/run.sh starts a session with `happy acp opencode --started-by daemon`.
    const args = buildEngineSessionLaunchArgs({});
    expect(args.slice(0, 2)).toEqual(['acp', 'opencode']);
    expect(args).toContain('--started-by');
  });
});

describe('HOST-10 daemon refuses every other agent', () => {
  it('accepts the engine', () => {
    expect(rejectNonEngineSpawn({ agent: 'opencode' })).toBeNull();
  });

  it('accepts a request that names no agent', () => {
    expect(rejectNonEngineSpawn({})).toBeNull();
  });

  it('rejects every other agent with an error result', () => {
    for (const agent of ['claude', 'codex', 'gemini', 'openclaw', 'agy']) {
      expect(rejectNonEngineSpawn({ agent: agent as 'opencode' })).toEqual({
        type: 'error',
        errorMessage: `Unsupported agent type: '${agent}'. Only 'opencode' is supported.`,
      });
    }
  });
});

describe('HOST-12 daemon passes the agent profile', () => {
  it('appends the profile flag when the control end chose a profile', () => {
    expect(buildEngineSessionLaunchArgs({ agentProfile: 'research' })).toEqual([
      'acp',
      'opencode',
      '--started-by',
      'daemon',
      AGENT_PROFILE_FLAG,
      'research',
    ]);
  });

  it('omits the profile flag for the default profile', () => {
    expect(buildEngineSessionLaunchArgs({ agentProfile: undefined })).not.toContain(AGENT_PROFILE_FLAG);
  });
});
