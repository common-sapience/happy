import { describe, expect, it } from 'vitest';

import { engineDeathDetail } from './AcpBackend';

describe('HOST-01 the engine process ending', () => {
  it('says nothing about an engine that finished on its own', () => {
    expect(engineDeathDetail(0, null)).toBeNull();
  });

  it('reports an engine that was killed by a signal, which carries no exit code', () => {
    expect(engineDeathDetail(null, 'SIGKILL')).toBe('Killed by SIGKILL');
    expect(engineDeathDetail(null, 'SIGTERM')).toBe('Killed by SIGTERM');
  });

  it('reports an engine that exited with a failure code', () => {
    expect(engineDeathDetail(1, null)).toBe('Exit code: 1');
  });

  it('reports an engine killed while it was also given a code, rather than staying silent', () => {
    expect(engineDeathDetail(0, 'SIGKILL')).toBe('Killed by SIGKILL');
  });
});
