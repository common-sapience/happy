/**
 * UNDER REVIEW - NEEDS MORE CAREFUL DESIGN
 *
 * This session protocol is currently emitted by multiple CLI runtimes and
 * normalized by the app, but the format is still evolving. Treat this as a
 * compatibility contract for current producers/consumers, not as a final
 * cross-agent standard.
 *
 * Before investing more here, look at how pi.dev standardizes their agent
 * protocol — we may want to align with or build on that approach instead of
 * rolling our own envelope format.
 *
 * Types are kept here for reference but are frozen. Do not add new consumers.
 */

import { createId, isCuid } from '@paralleldrive/cuid2';
import * as z from 'zod';

export const sessionRoleSchema = z.enum(['user', 'agent']);
export type SessionRole = z.infer<typeof sessionRoleSchema>;

export const sessionTextEventSchema = z.object({
  t: z.literal('text'),
  text: z.string(),
  thinking: z.boolean().optional(),
});

export const sessionUsageSchema = z
  .object({
    input_tokens: z.number().int().nonnegative(),
    cache_creation_input_tokens: z.number().int().nonnegative().optional(),
    cache_read_input_tokens: z.number().int().nonnegative().optional(),
    output_tokens: z.number().int().nonnegative(),
    context_window: z.number().int().positive().optional(),
    service_tier: z.string().optional(),
  })
  .passthrough();
export type SessionUsage = z.infer<typeof sessionUsageSchema>;

export const sessionServiceMessageEventSchema = z.object({
  t: z.literal('service'),
  text: z.string(),
});

/**
 * One step of a turn is one `call`: the identifier the engine gave the tool
 * call. The permission request for the same step is keyed by that same value
 * (see `permissionProtocol.ts`), so a producer must not mint an identifier of
 * its own — a step that asks, is allowed and then ends is one row, not three.
 */
export const sessionToolCallStartEventSchema = z.object({
  t: z.literal('tool-call-start'),
  call: z.string(),
  name: z.string(),
  title: z.string(),
  description: z.string(),
  args: z.record(z.string(), z.unknown()),
});

/**
 * How much of a tool result travels in the envelope. The end event carries a
 * summary so a reader can see what a step produced and whether it failed; the
 * full output and the file changes are fetched separately rather than pushed
 * through every session envelope.
 */
export const TOOL_CALL_RESULT_SUMMARY_MAX_CHARS = 2000;

export const sessionToolCallEndEventSchema = z.object({
  t: z.literal('tool-call-end'),
  call: z.string(),
  /** Summary of what the call produced, truncated to the cap above. */
  result: z.string().optional(),
  /** True when the call failed or was cancelled; absent reads as success. */
  isError: z.boolean().optional(),
});

/**
 * A tool result as the engine hands it over — a string, a content block, an
 * error object — reduced to the summary the end event carries. Both ends read
 * the same value, so the reduction belongs to the protocol rather than to one
 * producer.
 */
export function summarizeToolCallResult(result: unknown): string | undefined {
  if (result === undefined || result === null) {
    return undefined;
  }
  const text = typeof result === 'string' ? result : safeStringify(result);
  if (text === undefined) {
    return undefined;
  }
  return text.length > TOOL_CALL_RESULT_SUMMARY_MAX_CHARS
    ? `${text.slice(0, TOOL_CALL_RESULT_SUMMARY_MAX_CHARS)}\u2026`
    : text;
}

function safeStringify(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

export const sessionFileEventSchema = z.object({
  t: z.literal('file'),
  ref: z.string(),
  name: z.string(),
  size: z.number(),
  mimeType: z.string().optional(),
  image: z
    .object({
      width: z.number(),
      height: z.number(),
      thumbhash: z.string(),
    })
    .optional(),
});

export const sessionTurnStartEventSchema = z.object({
  t: z.literal('turn-start'),
});

export const sessionStartEventSchema = z.object({
  t: z.literal('start'),
  title: z.string().optional(),
});

export const sessionTurnEndStatusSchema = z.enum(['completed', 'failed', 'cancelled']);
export type SessionTurnEndStatus = z.infer<typeof sessionTurnEndStatusSchema>;

export const sessionTurnEndEventSchema = z.object({
  t: z.literal('turn-end'),
  status: sessionTurnEndStatusSchema,
});

export const sessionStopEventSchema = z.object({
  t: z.literal('stop'),
});

export const sessionEventSchema = z.discriminatedUnion('t', [
  sessionTextEventSchema,
  sessionServiceMessageEventSchema,
  sessionToolCallStartEventSchema,
  sessionToolCallEndEventSchema,
  sessionFileEventSchema,
  sessionTurnStartEventSchema,
  sessionStartEventSchema,
  sessionTurnEndEventSchema,
  sessionStopEventSchema,
]);

export type SessionEvent = z.infer<typeof sessionEventSchema>;

export const sessionEnvelopeSchema = z
  .object({
    id: z.string(),
    time: z.number(),
    role: sessionRoleSchema,
    turn: z.string().optional(),
    subagent: z
      .string()
      .refine((value) => isCuid(value), {
        message: 'subagent must be a cuid2 value',
      })
      .optional(),
    // Underlying agent-protocol message id (e.g. Claude's `uuid` in the
    // session JSONL). Set on text-bearing envelopes so the app can let
    // users pick a precise rewind point for session fork / duplicate.
    claudeUuid: z.string().min(1).optional(),
    // Codex app-server item id for this envelope. Used as the precise
    // rollback point for Codex thread duplicate/fork-from-message.
    codexItemId: z.string().min(1).optional(),
    // Optional model usage carried by the source agent message. Consumers use
    // this to update session context meters without rendering a separate row.
    usage: sessionUsageSchema.optional(),
    ev: sessionEventSchema,
  })
  .superRefine((envelope, ctx) => {
    if (envelope.ev.t === 'service' && envelope.role !== 'agent') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'service events must use role "agent"',
        path: ['role'],
      });
    }
    if ((envelope.ev.t === 'start' || envelope.ev.t === 'stop') && envelope.role !== 'agent') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${envelope.ev.t} events must use role "agent"`,
        path: ['role'],
      });
    }
  });

export type SessionEnvelope = z.infer<typeof sessionEnvelopeSchema>;

export type CreateEnvelopeOptions = {
  id?: string;
  time?: number;
  turn?: string;
  subagent?: string;
  claudeUuid?: string;
  codexItemId?: string;
  usage?: SessionUsage;
};

export function createEnvelope(role: SessionRole, ev: SessionEvent, opts: CreateEnvelopeOptions = {}): SessionEnvelope {
  return sessionEnvelopeSchema.parse({
    id: opts.id ?? createId(),
    time: opts.time ?? Date.now(),
    role,
    ...(opts.turn ? { turn: opts.turn } : {}),
    ...(opts.subagent ? { subagent: opts.subagent } : {}),
    ...(opts.claudeUuid ? { claudeUuid: opts.claudeUuid } : {}),
    ...(opts.codexItemId ? { codexItemId: opts.codexItemId } : {}),
    ...(opts.usage ? { usage: opts.usage } : {}),
    ev,
  });
}
