import * as React from 'react';
// @ts-expect-error react-test-renderer has no declarations in this workspace.
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ops = vi.hoisted(() => ({
    sessionAllow: vi.fn(async () => undefined),
    sessionDeny: vi.fn(async () => undefined),
    sessionSetAgentModes: vi.fn(),
}));

vi.mock('react-native', async () => {
    const ReactModule = await import('react');
    const host = (name: string) => (props: any) => ReactModule.createElement(name, props, props.children);
    return { Platform: { OS: 'web' }, Text: host('Text'), View: host('View') };
});
vi.mock('react-native-unistyles', () => ({
    StyleSheet: {
        create: (factory: any) => typeof factory === 'function' ? factory({
            margins: { xs: 4, sm: 8, md: 12, lg: 16 },
            colors: { textSecondary: 'secondary' },
            typography: { caption: { fontSize: 12, lineHeight: 16 } },
        }) : factory,
        hairlineWidth: 1,
    },
}));
vi.mock('@/constants/Typography', () => ({ Typography: { default: () => ({}) } }));
vi.mock('@/text', () => ({ t: (key: string) => key }));
vi.mock('@/sync/ops', () => ops);
vi.mock('@/components/kit', async () => {
    const ReactModule = await import('react');
    return { PermissionCard: (props: any) => ReactModule.createElement('PermissionCard', props) };
});

import { PermissionFooter } from './PermissionFooter';

function render(props: any) {
    let renderer: ReturnType<typeof create>;
    act(() => {
        renderer = create(React.createElement(PermissionFooter, props));
    });
    return renderer!;
}

const pending = { id: 'p1', status: 'pending' as const };

beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    ops.sessionAllow.mockClear();
    ops.sessionDeny.mockClear();
    ops.sessionSetAgentModes.mockClear();
});

describe('DESK-03 the permission request in the transcript', () => {
    it('offers exactly three answers, in words rather than tool names', () => {
        const card = render({
            permission: pending, sessionId: 's1', toolName: 'Bash', toolInput: { command: 'git status' },
        }).root.findByType('PermissionCard' as any);

        expect(card.props.category).toBe('permissionRequest.runCommand');
        expect(card.props.target).toBe('git status');
        expect(card.props.allowOnceLabel).toBe('permissionRequest.allowOnce');
        expect(card.props.allowAlwaysLabel).toBe('permissionRequest.allowAlways');
        expect(card.props.denyLabel).toBe('permissionRequest.deny');
        expect(card.props.raw).toBeUndefined();
    });

    it('pins "always" to the exact command rather than to the shell', async () => {
        const card = render({
            permission: pending, sessionId: 's1', toolName: 'Bash', toolInput: { command: 'rm -rf build' },
        }).root.findByType('PermissionCard' as any);

        await act(async () => { card.props.onAllowAlways(); });
        expect(ops.sessionAllow).toHaveBeenCalledWith('s1', 'p1', undefined, ['Bash(rm -rf build)']);
    });

    it('turns "always" into the edit mode for a tool that writes files', async () => {
        const card = render({
            permission: pending, sessionId: 's1', toolName: 'Edit', toolInput: { file_path: '/w/a.ts' },
        }).root.findByType('PermissionCard' as any);

        await act(async () => { card.props.onAllowAlways(); });
        expect(ops.sessionAllow).toHaveBeenCalledWith('s1', 'p1', 'acceptEdits');
        expect(ops.sessionSetAgentModes).toHaveBeenCalledWith('s1', { permissionMode: 'acceptEdits' });
    });

    it('shows the raw call for an action no template covers', () => {
        const card = render({
            permission: pending, sessionId: 's1', toolName: 'mcp_thing_do', toolInput: { all: true },
        }).root.findByType('PermissionCard' as any);

        expect(card.props.category).toBe('permissionRequest.useTool');
        expect(card.props.raw).toBe('mcp_thing_do {"all":true}');
    });

    it('collapses to one line once answered, so history carries no live controls', () => {
        for (const status of ['approved', 'denied', 'canceled'] as const) {
            const renderer = render({ permission: { id: 'p1', status }, sessionId: 's1', toolName: 'Bash' });
            expect(renderer.root.findAllByType('PermissionCard' as any)).toHaveLength(0);
        }
    });

    it('ignores a second answer to the same request', async () => {
        const card = render({
            permission: pending, sessionId: 's1', toolName: 'Read', toolInput: { file_path: '/w/a.ts' },
        }).root.findByType('PermissionCard' as any);

        await act(async () => {
            card.props.onDeny();
            card.props.onDeny();
        });
        expect(ops.sessionDeny).toHaveBeenCalledTimes(1);
    });
});
