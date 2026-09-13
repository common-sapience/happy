/**
 * What the desktop is allowed to put in the model gateway store (HOST-09, DESK-12).
 *
 * A packaged install reaches a model only once this host holds a gateway address,
 * a platform API key and a model id, so the account page has to be able to set
 * them. The decisions are here and pure; the file work is in
 * `desktopHandoffCommands.ts`, the same split the relay and login handoffs use.
 *
 * Two rules shape the validation. Every field is refused rather than repaired
 * when it carries anything but a single line of printable text: the key never
 * passes through argv or a shell, and a value holding a newline could otherwise
 * end up looking like a second reply line to whatever reads this process's
 * stdout. And the set is a subset, not a record: the account page edits one
 * field at a time, so a request naming only `modelId` must leave the key alone.
 */

export const PLATFORM_CREDENTIAL_FIELDS = ['apiKey', 'baseUrl', 'modelId'] as const;

export type PlatformCredentialField = (typeof PLATFORM_CREDENTIAL_FIELDS)[number];

export type PlatformCredentialInput = Partial<Record<PlatformCredentialField, string>>;

export type PlatformCredentialRefusal =
  | 'not-an-object'
  | 'unknown-field'
  | 'not-a-string'
  | 'empty'
  | 'not-one-line'
  | 'not-an-http-url';

export type PlatformCredentialRequest =
  | { action: 'read'; body: unknown }
  | { action: 'refuse'; reason: 'too-large' | 'not-json' };

/**
 * The bytes the desktop wrote on stdin, as a request. Nothing at all is the
 * state read the account page opens with; `null` is a stream that outgrew what a
 * shell would ever send and was abandoned rather than buffered.
 */
export function readPlatformCredentialRequest(raw: string | null): PlatformCredentialRequest {
  if (raw === null) {
    return { action: 'refuse', reason: 'too-large' };
  }
  if (raw.trim().length === 0) {
    return { action: 'read', body: {} };
  }
  try {
    return { action: 'read', body: JSON.parse(raw) };
  } catch {
    return { action: 'refuse', reason: 'not-json' };
  }
}

export type PlatformCredentialDecision =
  | { action: 'merge'; values: PlatformCredentialInput }
  | { action: 'refuse'; field: PlatformCredentialField | null; reason: PlatformCredentialRefusal };

/**
 * Not a single line of printable text. Whitespace covers the newline that would
 * otherwise let a value look like a second reply line; the C0 range and DEL cover
 * the rest of what no gateway field legitimately carries.
 */
const NOT_ONE_LINE = /[\s\u0000-\u001f\u007f]/;

/** A secret is taken exactly as given: trimming one stores a key nobody typed. */
function checkSecret(raw: string): PlatformCredentialRefusal | null {
  if (raw.length === 0) {
    return 'empty';
  }
  return NOT_ONE_LINE.test(raw) ? 'not-one-line' : null;
}

function checkText(raw: string): PlatformCredentialRefusal | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return 'empty';
  }
  return NOT_ONE_LINE.test(trimmed) ? 'not-one-line' : null;
}

/**
 * The gateway address as it will be stored: an absolute http or https URL with no
 * trailing slash, so the engine config can append a path without doubling it.
 */
export function normalizePlatformBaseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || NOT_ONE_LINE.test(trimmed)) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  if (!parsed.hostname) {
    return null;
  }
  return trimmed.replace(/\/+$/, '');
}

/**
 * Reads a request the desktop sent on stdin. Unparsed JSON, a non-object, an
 * unknown field or one bad value refuses the whole request: a partly applied
 * gateway is the state that makes the engine fail somewhere else.
 */
export function decidePlatformCredentials(request: unknown): PlatformCredentialDecision {
  if (typeof request !== 'object' || request === null || Array.isArray(request)) {
    return { action: 'refuse', field: null, reason: 'not-an-object' };
  }

  const entries = Object.entries(request as Record<string, unknown>);
  for (const [name] of entries) {
    if (!(PLATFORM_CREDENTIAL_FIELDS as readonly string[]).includes(name)) {
      return { action: 'refuse', field: null, reason: 'unknown-field' };
    }
  }

  const values: PlatformCredentialInput = {};
  for (const field of PLATFORM_CREDENTIAL_FIELDS) {
    const raw = (request as Record<string, unknown>)[field];
    if (raw === undefined) {
      continue;
    }
    if (typeof raw !== 'string') {
      return { action: 'refuse', field, reason: 'not-a-string' };
    }
    if (field === 'apiKey') {
      const refusal = checkSecret(raw);
      if (refusal) {
        return { action: 'refuse', field, reason: refusal };
      }
      values.apiKey = raw;
      continue;
    }
    if (field === 'baseUrl') {
      const refusal = checkText(raw);
      if (refusal) {
        return { action: 'refuse', field, reason: refusal };
      }
      const url = normalizePlatformBaseUrl(raw);
      if (!url) {
        return { action: 'refuse', field, reason: 'not-an-http-url' };
      }
      values.baseUrl = url;
      continue;
    }
    const refusal = checkText(raw);
    if (refusal) {
      return { action: 'refuse', field, reason: refusal };
    }
    values.modelId = raw.trim();
  }

  return { action: 'merge', values };
}

/**
 * Merges a validated subset into the store's gateway fields. Fields the request
 * did not name keep whatever the host already had, and the connectors this host
 * authorised are carried through untouched (HOST-11).
 */
export function mergePlatformCredentials<T extends {
  platformApiKey?: string;
  platformBaseUrl?: string;
  modelId?: string;
}>(current: T, values: PlatformCredentialInput): T {
  return {
    ...current,
    ...(values.apiKey === undefined ? {} : { platformApiKey: values.apiKey }),
    ...(values.baseUrl === undefined ? {} : { platformBaseUrl: values.baseUrl }),
    ...(values.modelId === undefined ? {} : { modelId: values.modelId }),
  };
}
