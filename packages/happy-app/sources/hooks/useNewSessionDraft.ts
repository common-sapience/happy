/**
 * Zustand store for new agent draft state, backed by MMKV.
 * Persists the user's last-used configuration (computer, folder, profile, extra
 * instructions) so the new agent screen restores the same defaults on next visit.
 */
import { create } from 'zustand';
import {
    loadNewSessionDraft,
    saveNewSessionDraft,
    type NewSessionAgentType,
    type NewSessionSessionType,
} from '@/sync/persistence';
import type { PermissionModeKey } from '@/components/PermissionModeSelector';
import type { AttachmentPreview } from '@/sync/attachmentTypes';
import { ENGINE_AGENT } from '@/utils/harnessCatalog';

interface NewSessionDraftState {
    input: string;
    attachments: AttachmentPreview[];
    selectedMachineId: string | null;
    selectedPath: string | null;
    agentType: NewSessionAgentType;
    /** The agent profile, under the wire name the daemon reads it as. */
    permissionMode: PermissionModeKey | null;
    systemPromptAddition: string | null;
    sessionType: NewSessionSessionType;
    worktreeKey: string | null;

    setInput: (input: string) => void;
    setAttachments: (attachments: AttachmentPreview[]) => void;
    setMachineId: (id: string | null) => void;
    /**
     * Renames the machine this draft already points at, keeping everything chosen on it.
     *
     * Picking a different computer throws the directory away, because a path on one laptop means
     * nothing on another. Discovering that two machine ids were one computer all along is the
     * opposite: the same folder, under the name it should have had.
     */
    renameMachineId: (id: string | null) => void;
    setPath: (path: string | null) => void;
    setAgentType: (agent: NewSessionAgentType) => void;
    setPermissionMode: (mode: PermissionModeKey) => void;
    setSystemPromptAddition: (text: string | null) => void;
    setSessionType: (type: NewSessionSessionType) => void;
    setWorktreeKey: (key: string | null) => void;
}

function persist(state: NewSessionDraftState) {
    saveNewSessionDraft({
        input: state.input,
        selectedMachineId: state.selectedMachineId,
        selectedPath: state.selectedPath,
        agentType: state.agentType,
        permissionMode: state.permissionMode,
        systemPromptAddition: state.systemPromptAddition,
        sessionType: state.sessionType,
        worktreeKey: state.worktreeKey,
        updatedAt: Date.now(),
    });
}

const initial = loadNewSessionDraft();

export const useNewSessionDraft = create<NewSessionDraftState>()((set, get) => ({
    input: initial?.input ?? '',
    // Image picker URIs are temporary, so attachments intentionally stay out
    // of MMKV persistence and only bridge Home -> New session in memory.
    attachments: [],
    selectedMachineId: initial?.selectedMachineId ?? null,
    selectedPath: initial?.selectedPath ?? null,
    agentType: initial?.agentType ?? ENGINE_AGENT,
    permissionMode: initial?.permissionMode ?? null,
    systemPromptAddition: initial?.systemPromptAddition ?? null,
    sessionType: initial?.sessionType ?? 'simple',
    worktreeKey: initial?.worktreeKey ?? null,

    setInput: (input) => { set({ input }); persist(get()); },
    setAttachments: (attachments) => { set({ attachments }); },
    setMachineId: (id) => { set({ selectedMachineId: id, selectedPath: null, worktreeKey: null }); persist(get()); },
    renameMachineId: (id) => { set({ selectedMachineId: id }); persist(get()); },
    setPath: (path) => { set({ selectedPath: path, worktreeKey: null }); persist(get()); },
    setAgentType: (agent) => { set({ agentType: agent }); persist(get()); },
    setPermissionMode: (mode) => { set({ permissionMode: mode }); persist(get()); },
    setSystemPromptAddition: (text) => { set({ systemPromptAddition: text }); persist(get()); },
    setSessionType: (type) => { set({ sessionType: type }); persist(get()); },
    setWorktreeKey: (key) => { set({ worktreeKey: key }); persist(get()); },
}));
