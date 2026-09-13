import { describe, expect, it } from 'vitest';
import { resolvePermissionRequestCopy } from './permissionRequestCopy';

describe('DESK-03 permission card copy', () => {
    it('names the action in the user\'s words and shows what it acts on', () => {
        const copy = resolvePermissionRequestCopy({ toolName: 'Bash', toolInput: { command: 'git status' } });
        expect(copy.categoryKey).toBe('runCommand');
        expect(copy.target).toBe('git status');
        expect(copy.raw).toBeUndefined();
    });

    it('reads a path out of whichever argument the engine used for it', () => {
        for (const input of [{ file_path: '/w/a.ts' }, { filePath: '/w/a.ts' }, { path: '/w/a.ts' }]) {
            expect(resolvePermissionRequestCopy({ toolName: 'Edit', toolInput: input })).toMatchObject({
                categoryKey: 'changeFile',
                target: '/w/a.ts',
            });
        }
    });

    it('falls back to the raw call for an action no template covers', () => {
        const copy = resolvePermissionRequestCopy({ toolName: 'mcp_server_wipe', toolInput: { scope: 'all' } });
        expect(copy.categoryKey).toBe('useTool');
        expect(copy.raw).toBe('mcp_server_wipe {"scope":"all"}');
    });

    it('never leaks an argument name into the headline', () => {
        const copy = resolvePermissionRequestCopy({ toolName: 'WebFetch', toolInput: { url: 'https://example.com' } });
        expect(copy.target).toBe('https://example.com');
        expect(copy.categoryKey).toBe('fetchWeb');
        expect(copy.scopeKey).toBe('web');
    });

    it('survives an input the host did not send as an object', () => {
        for (const input of [undefined, null, 'command', ['a']]) {
            expect(() => resolvePermissionRequestCopy({ toolName: 'Read', toolInput: input })).not.toThrow();
        }
        expect(resolvePermissionRequestCopy({ toolName: 'Read', toolInput: undefined }).target).toBe('');
    });

    it('collapses a command too long to headline', () => {
        const long = `echo ${'x'.repeat(400)}`;
        const copy = resolvePermissionRequestCopy({ toolName: 'Bash', toolInput: { command: long } });
        expect(copy.target.length).toBeLessThanOrEqual(240);
        expect(copy.target.endsWith('…')).toBe(true);
    });

    it('matches the tool name case-insensitively, as the engines spell it differently', () => {
        expect(resolvePermissionRequestCopy({ toolName: 'ExitPlanMode', toolInput: {} }).categoryKey).toBe('startChanges');
        expect(resolvePermissionRequestCopy({ toolName: 'exit_plan_mode', toolInput: {} }).categoryKey).toBe('startChanges');
    });
});
