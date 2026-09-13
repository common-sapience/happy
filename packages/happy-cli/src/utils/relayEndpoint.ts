/**
 * Where this install is allowed to reach a relay.
 *
 * No address is built in: the daemon connects only to a relay the operator
 * named, either baked into the release through HAPPY_SERVER_URL or written into
 * this computer's settings. With neither, it refuses to start rather than
 * registering the computer with a server nobody chose.
 */

export type RelayEndpoint =
  | { configured: true; url: string }
  | { configured: false }

export type RelayAddressSources = {
  /** HAPPY_SERVER_URL / HAPPY_WEBAPP_URL in this process's environment. */
  environment?: string | null
  /** What this computer's settings file records. */
  settings?: string | null
}

export function normalizeRelayAddress(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) {
    return null
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null
  }
  if (!parsed.hostname) {
    return null
  }
  return trimmed.replace(/\/+$/, '')
}

export function resolveRelayEndpoint(sources: RelayAddressSources): RelayEndpoint {
  const environment = normalizeRelayAddress(sources.environment)
  if (environment) {
    return { configured: true, url: environment }
  }
  const settings = normalizeRelayAddress(sources.settings)
  if (settings) {
    return { configured: true, url: settings }
  }
  return { configured: false }
}

export const RELAY_NOT_CONFIGURED_MESSAGE =
  'No relay is configured, and this build has no address of its own. Set HAPPY_SERVER_URL, write "serverUrl" into this computer\'s settings file, or run `happy server` to host one here.'

export class RelayNotConfiguredError extends Error {
  constructor() {
    super(RELAY_NOT_CONFIGURED_MESSAGE)
    this.name = 'RelayNotConfiguredError'
  }
}
