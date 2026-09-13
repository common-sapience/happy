/**
 * What the desktop shell hands the daemon (DESK-08, DESK-21, RULE-12).
 *
 * The shell and the daemon are two processes with two notions of state: the app
 * keeps the relay address and the account in its own storage, the daemon reads
 * `~/.happy/`. Nothing crossed that gap, so a package with no relay baked in
 * opened on the address screen while the daemon kept refusing to start for want
 * of an address, and the user's own computer never joined their account.
 *
 * These two subcommands are that gap closed, and they are deliberately the
 * daemon's own code: the settings file is written by the same locked
 * read-modify-write every other writer uses, and credentials are written by the
 * same writer `happy auth login` uses. The shell names an address and asks for a
 * login; it never edits either file itself.
 *
 * Both print one machine-readable line so the shell can tell what happened
 * without scraping prose.
 */

import tweetnacl from 'tweetnacl';

import { encodeBase64Url } from '@/api/encryption';
import { normalizeRelayAddress } from '@/utils/relayEndpoint';

export const SET_RELAY_SUBCOMMAND = 'set-relay';
export const LOGIN_REQUEST_SUBCOMMAND = 'login-request';

/**
 * The shell mints a token, passes it here, and the reply echoes it back. The
 * controller approves only a request whose reply carries the token it minted,
 * so it can never auto-approve a login request some other process published.
 */
export const LOGIN_TOKEN_ENVIRONMENT_VARIABLE = 'HAPPY_DAEMON_LOGIN_TOKEN';

export const HANDOFF_LINE_PREFIX = 'happy-handoff ';

export const LOGIN_REQUEST_URL_PREFIX = 'happy://terminal?';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export type RelayHandoffDecision =
  | { action: 'write'; url: string }
  | { action: 'keep'; url: string }
  | { action: 'refuse'; reason: 'missing' | 'invalid' };

/**
 * Whether the settings file has to change. Validity is decided by the same
 * resolver the daemon uses to read the address back, so an address that is
 * written here is an address that will resolve on the next start.
 */
export function decideRelayHandoff(
  argument: string | null | undefined,
  stored: string | null | undefined,
): RelayHandoffDecision {
  if (!argument || argument.trim().length === 0) {
    return { action: 'refuse', reason: 'missing' };
  }
  const url = normalizeRelayAddress(argument);
  if (!url) {
    return { action: 'refuse', reason: 'invalid' };
  }
  if (normalizeRelayAddress(stored) === url) {
    return { action: 'keep', url };
  }
  return { action: 'write', url };
}

export type LoginTokenCheck =
  | { ok: true; token: string }
  | { ok: false; reason: 'missing' | 'malformed' };

export function checkLoginToken(raw: string | null | undefined): LoginTokenCheck {
  if (raw === undefined || raw === null || raw.length === 0) {
    return { ok: false, reason: 'missing' };
  }
  if (!TOKEN_PATTERN.test(raw)) {
    return { ok: false, reason: 'malformed' };
  }
  return { ok: true, token: raw };
}

export function handoffLine(payload: Record<string, unknown>): string {
  return `${HANDOFF_LINE_PREFIX}${JSON.stringify(payload)}`;
}

export function parseHandoffLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith(HANDOFF_LINE_PREFIX)) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed.slice(HANDOFF_LINE_PREFIX.length));
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function loginRequestUrl(publicKey: Uint8Array): string {
  if (publicKey.length !== tweetnacl.box.publicKeyLength) {
    throw new Error(`A login request key is ${tweetnacl.box.publicKeyLength} bytes, got ${publicKey.length}`);
  }
  return `${LOGIN_REQUEST_URL_PREFIX}${encodeBase64Url(publicKey)}`;
}

export type AuthRequestState =
  | { state: 'requested' }
  | { state: 'authorized'; token: string; response: string };

export type LoginApproval =
  | { status: 'authorized'; token: string; response: string }
  | { status: 'timeout' }
  | { status: 'unreachable' };

/** A relay that fails this many times in a row is not coming back during this attempt. */
const CONSECUTIVE_FAILURES_ALLOWED = 3;

export async function awaitLoginApproval(options: {
  publicKey: Uint8Array;
  request: (publicKey: Uint8Array) => Promise<AuthRequestState>;
  attempts: number;
  sleep: (ms: number) => Promise<void>;
  intervalMs?: number;
}): Promise<LoginApproval> {
  const intervalMs = options.intervalMs ?? 1000;
  let consecutiveFailures = 0;
  for (let attempt = 0; attempt < options.attempts; attempt++) {
    try {
      const state = await options.request(options.publicKey);
      consecutiveFailures = 0;
      if (state.state === 'authorized') {
        return { status: 'authorized', token: state.token, response: state.response };
      }
    } catch {
      consecutiveFailures++;
      if (consecutiveFailures >= CONSECUTIVE_FAILURES_ALLOWED) {
        return { status: 'unreachable' };
      }
    }
    if (attempt + 1 < options.attempts) {
      await options.sleep(intervalMs);
    }
  }
  return { status: 'timeout' };
}
