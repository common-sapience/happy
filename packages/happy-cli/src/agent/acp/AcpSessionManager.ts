import { createId } from '@paralleldrive/cuid2';
import {
  createEnvelope,
  summarizeToolCallResult,
  type CreateEnvelopeOptions,
  type SessionEnvelope,
} from '@slopus/happy-wire';
import type { AgentMessage } from '@/agent/core';

function turnOptions(turnId: string | null, time: number): CreateEnvelopeOptions {
  return turnId ? { turn: turnId, time } : { time };
}

function parseThinkingPayload(payload: unknown): { text: string; streaming: boolean } {
  if (typeof payload === 'string') {
    return { text: payload, streaming: false };
  }
  if (!payload || typeof payload !== 'object') {
    return { text: '', streaming: false };
  }
  const text = typeof (payload as { text?: unknown }).text === 'string'
    ? (payload as { text: string }).text
    : '';
  const streaming = (payload as { streaming?: unknown }).streaming === true;
  return { text, streaming };
}

/**
 * Turns the backend's messages into session envelopes.
 *
 * A step keeps the identifier the engine gave it: the permission request for
 * the same step is stored under that id too, so the control end can show one
 * step as one row. Minting an id here would split the row in two.
 */
export class AcpSessionManager {
  private currentTurnId: string | null = null;

  /** Monotonic clock: max(lastTime + 1, Date.now()) */
  private lastTime = 0;

  /** Pending text waiting to be flushed when the stream type changes */
  private pendingText = '';
  private pendingType: 'thinking' | 'output' | null = null;

  private nextTime(): number {
    this.lastTime = Math.max(this.lastTime + 1, Date.now());
    return this.lastTime;
  }

  private flush(): SessionEnvelope[] {
    if (!this.pendingText || !this.pendingType) {
      return [];
    }
    const text = this.pendingText.replace(/^\n+|\n+$/g, '');
    const type = this.pendingType;
    this.pendingText = '';
    this.pendingType = null;

    if (!text) {
      return [];
    }
    if (type === 'thinking') {
      return [createEnvelope('agent', { t: 'text', text, thinking: true }, turnOptions(this.currentTurnId, this.nextTime()))];
    }
    return [createEnvelope('agent', { t: 'text', text }, turnOptions(this.currentTurnId, this.nextTime()))];
  }

  startTurn(): SessionEnvelope[] {
    if (this.currentTurnId) {
      return [];
    }

    this.currentTurnId = createId();
    return [
      createEnvelope('agent', { t: 'turn-start' }, { turn: this.currentTurnId, time: this.nextTime() }),
    ];
  }

  endTurn(status: 'completed' | 'failed' | 'cancelled'): SessionEnvelope[] {
    const flushed = this.flush();
    if (!this.currentTurnId) {
      return flushed;
    }

    const turnId = this.currentTurnId;
    this.currentTurnId = null;
    return [
      ...flushed,
      createEnvelope('agent', { t: 'turn-end', status }, { turn: turnId, time: this.nextTime() }),
    ];
  }

  mapMessage(msg: AgentMessage): SessionEnvelope[] {
    if (msg.type === 'event' && msg.name === 'thinking') {
      const { text, streaming } = parseThinkingPayload(msg.payload);
      if (!text) {
        return [];
      }

      if (streaming) {
        // Streaming thinking: accumulate, flush if switching from a different type
        const flushed = this.pendingType !== 'thinking' ? this.flush() : [];
        this.pendingType = 'thinking';
        this.pendingText += text;
        return flushed;
      }

      // Non-streaming thinking: flush pending, emit immediately
      const trimmed = text.replace(/^\n+|\n+$/g, '');
      if (!trimmed) {
        return this.flush();
      }
      return [
        ...this.flush(),
        createEnvelope('agent', { t: 'text', text: trimmed, thinking: true }, turnOptions(this.currentTurnId, this.nextTime())),
      ];
    }

    if (msg.type === 'status') {
      if (msg.status === 'error' && this.currentTurnId) {
        const detail = msg.detail?.trim() || 'The agent stopped because of an unknown error.';
        return [
          ...this.flush(),
          createEnvelope(
            'agent',
            { t: 'service', text: `Error: ${detail}` },
            { turn: this.currentTurnId, time: this.nextTime() },
          ),
        ];
      }
      return [];
    }

    if (msg.type === 'model-output') {
      const text = msg.textDelta ?? '';
      if (!text) {
        return [];
      }
      // Accumulate output, flush if switching from a different type
      const flushed = this.pendingType !== 'output' ? this.flush() : [];
      this.pendingType = 'output';
      this.pendingText += text;
      return flushed;
    }

    if (msg.type === 'tool-call') {
      const flushed = this.flush();
      return [
        ...flushed,
        // The name is the engine's tool category and the title its own one-line
        // description of this call. Neither is restated as a description: the
        // controller writes the words a reader sees (DESK-01).
        createEnvelope('agent', {
          t: 'tool-call-start',
          call: msg.callId,
          name: msg.toolName,
          title: msg.title ?? '',
          description: '',
          args: msg.args,
        }, turnOptions(this.currentTurnId, this.nextTime())),
      ];
    }

    if (msg.type === 'tool-result') {
      const flushed = this.flush();
      const summary = summarizeToolCallResult(msg.result);
      return [
        ...flushed,
        createEnvelope('agent', {
          t: 'tool-call-end',
          call: msg.callId,
          ...(summary === undefined ? {} : { result: summary }),
          ...(msg.isError ? { isError: true } : {}),
        }, turnOptions(this.currentTurnId, this.nextTime())),
      ];
    }

    return [];
  }
}
