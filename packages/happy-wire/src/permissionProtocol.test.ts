import { describe, expect, it } from 'vitest';
import {
  completedPermissionRequestSchema,
  permissionAnswerSchema,
  permissionRequestSchema,
} from './permissionProtocol';

describe('permission protocol schemas', () => {
  it('accepts a request as the host writes it', () => {
    const parsed = permissionRequestSchema.parse({
      tool: 'execute',
      arguments: { command: 'rm -rf build' },
      createdAt: 1700000000000,
    });
    expect(parsed.tool).toBe('execute');
  });

  it('accepts a request whose id is scoped by a subagent', () => {
    const parsed = permissionRequestSchema.parse({
      tool: 'execute',
      arguments: {},
      createdAt: 1,
      toolUseId: 'call-1',
    });
    expect(parsed.toolUseId).toBe('call-1');
  });

  it('rejects a request without a tool', () => {
    expect(permissionRequestSchema.safeParse({ arguments: {}, createdAt: 1 }).success).toBe(false);
  });

  it('accepts an answered request under either spelling of the grant', () => {
    const allowedTools = completedPermissionRequestSchema.parse({
      tool: 'execute',
      arguments: {},
      createdAt: 1,
      completedAt: 2,
      status: 'approved',
      decision: 'approved_for_session',
      allowedTools: ['execute'],
    });
    const allowTools = completedPermissionRequestSchema.parse({
      tool: 'execute',
      arguments: {},
      createdAt: 1,
      completedAt: 2,
      status: 'approved',
      decision: 'approved_for_session',
      allowTools: ['execute'],
    });
    expect(allowedTools.allowedTools).toEqual(['execute']);
    expect(allowTools.allowTools).toEqual(['execute']);
  });

  it('rejects an outcome that is not one of the three', () => {
    expect(completedPermissionRequestSchema.safeParse({
      tool: 'execute',
      arguments: {},
      createdAt: 1,
      completedAt: 2,
      status: 'timed-out',
    }).success).toBe(false);
  });

  it('accepts the three answers a reader can give', () => {
    for (const decision of ['approved', 'approved_for_session', 'denied'] as const) {
      const parsed = permissionAnswerSchema.parse({
        id: 'call-1',
        approved: decision !== 'denied',
        decision,
      });
      expect(parsed.decision).toBe(decision);
    }
  });

  it('rejects an answer for no particular request', () => {
    expect(permissionAnswerSchema.safeParse({ approved: true }).success).toBe(false);
  });
});
