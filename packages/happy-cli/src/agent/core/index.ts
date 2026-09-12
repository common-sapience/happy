/**
 * Core Agent Types and Interfaces
 *
 * Re-exports all core agent abstractions.
 *
 * @module core
 */

// ============================================================================
// AgentBackend - Core interface and types
// ============================================================================

export type {
  SessionId,
  ToolCallId,
  AgentMessage,
  AgentMessageHandler,
  AgentBackend,
  AgentBackendConfig,
  AcpAgentConfig,
  McpServerConfig,
  AgentTransport,
  AgentId,
  StartSessionResult,
} from './AgentBackend';
