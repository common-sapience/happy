/**
 * Permission requests and their answers.
 *
 * A request travels inside the session's encrypted agent state rather than as
 * its own envelope, but its shape is part of the protocol all the same: the
 * host writes it and the control end reads it, so it is defined once, here.
 *
 * Both maps are keyed by the identifier the engine gave the tool call — the
 * same value the step's `tool-call-start` and `tool-call-end` events carry in
 * `call`. That shared key is what lets a control end show one step as one row
 * instead of a permission card beside an unrelated activity line.
 */

import * as z from 'zod';

/** What the user answered. `abort` ends the turn rather than the step. */
export const permissionDecisionSchema = z.enum(['approved', 'approved_for_session', 'denied', 'abort']);
export type PermissionDecision = z.infer<typeof permissionDecisionSchema>;

/** Where a request ended up once it is no longer waiting. */
export const permissionStatusSchema = z.enum(['approved', 'denied', 'canceled']);
export type PermissionStatus = z.infer<typeof permissionStatusSchema>;

/**
 * A step waiting for an answer. `tool` and `arguments` are what the control end
 * writes the card from; it never sends the tool's own name to the reader.
 */
export const permissionRequestSchema = z.object({
  tool: z.string(),
  arguments: z.unknown(),
  createdAt: z.number().nullish(),
  /**
   * Set only when the request id is scoped by an agent (`agentID:toolUseID`):
   * then this is the bare tool call id the step's events carry, and the request
   * id stays the key the answer is sent back under.
   */
  toolUseId: z.string().nullish(),
});
export type PermissionRequest = z.infer<typeof permissionRequestSchema>;

/** An answered request. The host keeps it so a reload still shows the answer. */
export const completedPermissionRequestSchema = permissionRequestSchema.extend({
  completedAt: z.number().nullish(),
  status: permissionStatusSchema,
  reason: z.string().nullish(),
  mode: z.string().nullish(),
  allowedTools: z.array(z.string()).nullish(),
  /**
   * The same grant under the field name the answer RPC uses. Deployed hosts
   * write this spelling; a reader folds it into `allowedTools`.
   */
  allowTools: z.array(z.string()).nullish(),
  decision: permissionDecisionSchema.nullish(),
});
export type CompletedPermissionRequest = z.infer<typeof completedPermissionRequestSchema>;

/**
 * The answer, sent to the host over the session's `permission` RPC. `id` is the
 * key of the request being answered, so it is the tool call id as well.
 */
export const permissionAnswerSchema = z.object({
  id: z.string(),
  approved: z.boolean(),
  decision: permissionDecisionSchema.optional(),
  allowTools: z.array(z.string()).optional(),
});
export type PermissionAnswer = z.infer<typeof permissionAnswerSchema>;
