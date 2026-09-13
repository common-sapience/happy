/**
 * Agent Module - engine backend abstraction
 *
 * The only agent is the engine, driven over ACP. This module keeps the
 * backend abstraction the ACP runner is built on (HOST-10).
 */

// Core types, interfaces, and registry - re-export from core/
export type {
  AgentMessage,
  AgentMessageHandler,
  AgentBackend,
  AgentBackendConfig,
  AcpAgentConfig,
  McpServerConfig,
  AgentTransport,
  AgentId,
  SessionId,
  ToolCallId,
  StartSessionResult,
} from './core';

// ACP backend (low-level)
export * from './acp';

