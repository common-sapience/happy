import * as React from 'react';
import { EditView } from './EditView';
import { BashView } from './BashView';
import { Message, ToolCall } from '@/sync/typesMessage';
import { Metadata } from '@/sync/storageTypes';
import { WriteView } from './WriteView';
import { TodoView } from './TodoView';
import { ExitPlanToolView } from './ExitPlanToolView';
import { MultiEditView } from './MultiEditView';
import { TaskView } from './TaskView';
import { BashViewFull } from './BashViewFull';
import { EditViewFull } from './EditViewFull';
import { MultiEditViewFull } from './MultiEditViewFull';
import { CodexPatchView, CodexPatchViewFull } from './CodexPatchView';
import { CodexDiffView, CodexDiffViewFull } from './CodexDiffView';
import { AskUserQuestionView } from './AskUserQuestionView';
import { RequestUserInputView } from './RequestUserInputView';
import { FileView } from './FileView';
import { isTerminalToolName } from '@/utils/toolDisplay';

export type ToolViewProps = {
    tool: ToolCall;
    metadata: Metadata | null;
    messages: Message[];
    sessionId?: string;
    messageId?: string;
    focusFile?: string;
    permissionFooter?: React.ReactNode;
}

// Type for tool view components
export type ToolViewComponent = React.ComponentType<ToolViewProps>;

// Registry of tool-specific view components
export const toolViewRegistry: Record<string, ToolViewComponent> = {
    Edit: EditView,
    Bash: BashView,
    Write: WriteView,
    write: WriteView,
    search_replace: EditView,
    TodoWrite: TodoView,
    ExitPlanMode: ExitPlanToolView,
    exit_plan_mode: ExitPlanToolView,
    MultiEdit: MultiEditView,
    Task: TaskView,
    Agent: TaskView,
    AskUserQuestion: AskUserQuestionView,
    request_user_input: RequestUserInputView,
    // The engine forwards the model-native tool name with the raw envelope,
    // which getPatchChanges parses into a change map.
    apply_patch: CodexPatchView,
    unified_diff: CodexDiffView,
    // File attachment events
    file: FileView,
};

export const toolFullViewRegistry: Record<string, ToolViewComponent> = {
    Bash: BashViewFull,
    apply_patch: CodexPatchViewFull,
    unified_diff: CodexDiffViewFull,
    Edit: EditViewFull,
    search_replace: EditViewFull,
    Write: WriteView,
    write: WriteView,
    MultiEdit: MultiEditViewFull,
    Task: TaskView,
    Agent: TaskView,
};

// Helper function to get the appropriate view component for a tool
export function getToolViewComponent(toolName: string): ToolViewComponent | null {
    return toolViewRegistry[toolName] || null;
}

// Helper function to get the full view component for a tool
export function getToolFullViewComponent(toolName: string): ToolViewComponent | null {
    return toolFullViewRegistry[toolName] || (isTerminalToolName(toolName) ? BashViewFull : null);
}

// Export individual components
export { EditView } from './EditView';
export { BashView } from './BashView';
export { CodexPatchView } from './CodexPatchView';
export { CodexDiffView } from './CodexDiffView';
export { BashViewFull } from './BashViewFull';
export { EditViewFull } from './EditViewFull';
export { MultiEditViewFull } from './MultiEditViewFull';
export { ExitPlanToolView } from './ExitPlanToolView';
export { MultiEditView } from './MultiEditView';
export { TaskView } from './TaskView';
export { AskUserQuestionView } from './AskUserQuestionView';
export { RequestUserInputView } from './RequestUserInputView';
export { FileView } from './FileView';
