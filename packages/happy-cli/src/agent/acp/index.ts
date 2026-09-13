/**
 * ACP Module - Agent Client Protocol implementations
 *
 * This module exports all ACP-related functionality including
 * the base AcpBackend and factory helpers.
 *
 * Uses the official @agentclientprotocol/sdk from Zed Industries.
 *
 * For agent-specific backends, use the factories in src/agent/factories/.
 */

// Core ACP backend
export { AcpBackend, type AcpBackendOptions, type AcpPermissionHandler } from './AcpBackend';

// Session update handlers (for testing and extension)
export {
  type SessionUpdate,
  type HandlerContext,
  type HandlerResult,
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_TOOL_CALL_TIMEOUT_MS,
  parseArgsFromContent,
  extractErrorDetail,
  formatDuration,
  formatDurationMinutes,
  handleAgentMessageChunk,
  handleAgentThoughtChunk,
  handleToolCallUpdate,
  handleToolCall,
  handleLegacyMessageChunk,
  handlePlanUpdate,
  handleThinkingUpdate,
} from './sessionUpdateHandlers';

export { AcpSessionManager } from './AcpSessionManager';
export { runAcp } from './runAcp';
export {
  ENGINE_AGENT_NAME,
  ENGINE_ACP_COMMAND,
  ENGINE_ACP_ARGS,
  isEngineAgentName,
  resolveAcpAgentConfig,
  type AcpAgentConfig,
  type EngineAgentName,
  type ResolvedAcpAgentConfig,
} from './acpAgentConfig';

// Legacy aliases for backwards compatibility
export { AcpBackend as AcpSdkBackend } from './AcpBackend';
export type { AcpBackendOptions as AcpSdkBackendOptions } from './AcpBackend';
