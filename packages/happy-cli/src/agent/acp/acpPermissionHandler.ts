/**
 * The permission handler for engine sessions driven over ACP.
 *
 * A request is stored under the identifier the engine gave the tool call, and
 * the step's `tool-call-start` and `tool-call-end` events carry that same value
 * in `call`. The shared key is the whole point: it is what lets a control end
 * draw the card and the activity line as one step instead of two.
 */

import type { ApiSessionClient } from '@/api/apiSession';
import { logger } from '@/ui/logger';
import { BasePermissionHandler, type PermissionResult } from '@/utils/BasePermissionHandler';
import type { AcpPermissionHandler } from './AcpBackend';

export class GenericAcpPermissionHandler extends BasePermissionHandler implements AcpPermissionHandler {
  private readonly logPrefix: string;

  constructor(session: ApiSessionClient, agentName: string) {
    super(session);
    this.logPrefix = `[${agentName}]`;
  }

  protected getLogPrefix(): string {
    return this.logPrefix;
  }

  async handleToolCall(toolCallId: string, toolName: string, input: unknown): Promise<PermissionResult> {
    return new Promise<PermissionResult>((resolve, reject) => {
      this.pendingRequests.set(toolCallId, {
        resolve,
        reject,
        toolName,
        input,
      });
      this.addPendingRequestToState(toolCallId, toolName, input);
      logger.debug(`${this.logPrefix} Permission request sent for tool: ${toolName} (${toolCallId})`);
    });
  }
}
