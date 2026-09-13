import { describe, expect, it } from 'vitest';
import { resolveMessageModeMeta } from './messageMeta';
import { rigMetadataFixture } from './__testdata__/rigMetadata';

describe('resolveMessageModeMeta', () => {
    // Nothing chosen means nothing asserted on the wire: the host keeps the
    // session on whatever the agent profile already gave it.
    it('omits every field a session has not chosen', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: null,
            modelMode: null,
            effortLevel: null,
            metadata: { flavor: 'opencode' },
        } as any);

        expect(meta).toEqual({});
    });

    it('keeps an explicit Codex YOLO override on an old CLI', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: null,
            modelMode: null,
            effortLevel: null,
            metadata: { flavor: 'opencode', version: '1.2.0' },
        } as any, {
            agentDefaultOverrides: { opencode: { permissionMode: 'yolo' } },
        } as any);

        expect(meta.permissionMode).toBe('yolo');
    });

    it('sends auto untouched when the session CLI is new enough', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: 'auto',
            modelMode: null,
            effortLevel: null,
            metadata: { flavor: 'opencode', version: '1.2.1-beta.2' },
        } as any);

        expect(meta.permissionMode).toBe('auto');
    });

    it('sends auto when the session reports no CLI version at all', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: 'auto',
            modelMode: null,
            effortLevel: null,
            metadata: { flavor: 'opencode' },
        } as any);

        expect(meta.permissionMode).toBe('auto');
    });

    it('sends explicit per-session overrides', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: 'read-only',
            modelMode: 'gpt-5.6-terra',
            effortLevel: 'high',
            metadata: { flavor: 'opencode' },
        } as any);

        expect(meta).toEqual({
            permissionMode: 'read-only',
            model: 'gpt-5.6-terra',
            effort: 'high',
        });
    });

    it('sends settings-level overrides when session has no override', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: null,
            modelMode: null,
            effortLevel: null,
            metadata: { flavor: 'opencode' },
        } as any, {
            agentDefaultOverrides: {
                opencode: {
                    permissionMode: 'bypassPermissions',
                    modelMode: 'opus',
                    effortLevel: 'medium',
                },
            },
        } as any);

        expect(meta).toEqual({
            permissionMode: 'bypassPermissions',
            model: 'opus',
            effort: 'medium',
        });
    });

    it('lets session overrides beat settings-level overrides', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: 'default',
            modelMode: 'gpt-5.6-terra',
            effortLevel: 'xhigh',
            metadata: { flavor: 'opencode' },
        } as any, {
            agentDefaultOverrides: {
                opencode: {
                    permissionMode: 'yolo',
                    modelMode: 'gpt-5.6-luna',
                    effortLevel: 'medium',
                },
            },
        } as any);

        expect(meta).toEqual({
            permissionMode: 'default',
            model: 'gpt-5.6-terra',
            effort: 'xhigh',
        });
    });

    it('passes a custom model through unchanged', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: null,
            modelMode: 'my-workspace-model',
            effortLevel: null,
            metadata: { flavor: 'opencode' },
        } as any);

        expect(meta).toEqual({ model: 'my-workspace-model' });
    });

    it('uses a custom model saved in agent settings', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: null,
            modelMode: null,
            effortLevel: null,
            metadata: { flavor: 'opencode' },
        } as any, {
            agentDefaultOverrides: {
                opencode: { modelMode: 'my-workspace-model' },
            },
        } as any);

        expect(meta).toEqual({ model: 'my-workspace-model' });
    });

    it('fills unset codex fields from settings while preserving session picks', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: 'read-only',
            modelMode: null,
            effortLevel: null,
            metadata: { flavor: 'opencode' },
        } as any, {
            agentDefaultOverrides: {
                opencode: {
                    permissionMode: 'auto',
                    modelMode: 'gpt-5.6-terra',
                    effortLevel: 'high',
                },
            },
        } as any);

        expect(meta).toEqual({
            permissionMode: 'read-only',
            model: 'gpt-5.6-terra',
            effort: 'high',
        });
    });

    it('treats an explicit claude default model as a reset override', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: null,
            modelMode: 'default',
            effortLevel: null,
            metadata: { flavor: 'opencode' },
        } as any);

        expect(meta).toEqual({ model: null });
    });

    it('sends the picked profile and model through untouched', () => {
        const meta = resolveMessageModeMeta({
            permissionMode: 'plan',
            modelMode: 'gateway/model-a',
            effortLevel: null,
            metadata: { flavor: 'opencode' },
        } as any);

        expect(meta).toEqual({
            permissionMode: 'plan',
            model: 'gateway/model-a',
        });
    });
});
