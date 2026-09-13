import { beforeEach, describe, expect, it, vi } from 'vitest';

type Draft = {
    input: string;
    selectedMachineId: string | null;
    selectedPath: string | null;
    agentType: 'opencode';
    permissionMode: string | null;
    systemPromptAddition: string | null;
    sessionType: 'simple' | 'worktree';
    worktreeKey: string | null;
    updatedAt: number;
};

const mockPersistence = vi.hoisted(() => ({
    draft: null as Draft | null,
    saved: [] as Draft[],
}));

vi.mock('@/sync/persistence', () => ({
    loadNewSessionDraft: () => mockPersistence.draft,
    saveNewSessionDraft: (draft: Draft) => {
        mockPersistence.saved.push(draft);
        mockPersistence.draft = draft;
    },
}));

function persistedDraft(overrides: Partial<Draft> = {}): Draft {
    return {
        input: '',
        selectedMachineId: null,
        selectedPath: null,
        agentType: 'opencode',
        permissionMode: null,
        systemPromptAddition: null,
        sessionType: 'simple',
        worktreeKey: null,
        updatedAt: 1,
        ...overrides,
    };
}

describe('useNewSessionDraft', () => {
    beforeEach(() => {
        vi.resetModules();
        mockPersistence.draft = null;
        mockPersistence.saved = [];
    });

    it('DESK-10: leaves the profile unset so the composer lands on the everything-on one', async () => {
        const { useNewSessionDraft } = await import('./useNewSessionDraft');

        expect(useNewSessionDraft.getState().permissionMode).toBeNull();
        expect(useNewSessionDraft.getState().systemPromptAddition).toBeNull();
    });

    it('DESK-10: loads the persisted profile and extra instructions', async () => {
        mockPersistence.draft = persistedDraft({
            permissionMode: 'plan',
            systemPromptAddition: 'Always ask before deleting files',
        });

        const { useNewSessionDraft } = await import('./useNewSessionDraft');

        expect(useNewSessionDraft.getState().permissionMode).toBe('plan');
        expect(useNewSessionDraft.getState().systemPromptAddition).toBe('Always ask before deleting files');
    });

    it('DESK-10: persists a profile change with the rest of the draft', async () => {
        const { useNewSessionDraft } = await import('./useNewSessionDraft');

        useNewSessionDraft.getState().setPermissionMode('build');

        expect(useNewSessionDraft.getState().permissionMode).toBe('build');
        expect(mockPersistence.saved.at(-1)).toMatchObject({ permissionMode: 'build' });
    });

    it('keeps temporary image attachments in memory without persisting their file URIs', async () => {
        const { useNewSessionDraft } = await import('./useNewSessionDraft');
        const attachment = {
            id: 'photo-1',
            uri: 'file:///temporary/photo.jpg',
            width: 100,
            height: 100,
            mimeType: 'image/jpeg',
            size: 1024,
            name: 'photo.jpg',
        };

        useNewSessionDraft.getState().setAttachments([attachment]);

        expect(useNewSessionDraft.getState().attachments).toEqual([attachment]);
        expect(mockPersistence.saved).toHaveLength(0);
    });
});
