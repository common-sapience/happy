/**
 * The desktop shell starts the daemon itself (DESK-09), before the user has
 * necessarily logged in. The terminal flow answers that by asking the user to
 * authenticate interactively, which a process started by a GUI cannot do: it has
 * no terminal to draw on and nobody watching it. With this flag the daemon
 * reports that it has nothing to do and exits, leaving the shell to try again.
 */

import { RELAY_NOT_CONFIGURED_MESSAGE } from '@/utils/relayEndpoint';

export const ONLY_IF_AUTHENTICATED_FLAG = '--only-if-authenticated';

export function shouldDeferDaemonStart(args: string[], hasCredentials: boolean): boolean {
  return args.includes(ONLY_IF_AUTHENTICATED_FLAG) && !hasCredentials;
}

/**
 * A daemon with no relay address has nothing it is allowed to connect to. No
 * address is built in, so it stops here and says why rather than registering
 * this computer with a server nobody chose.
 */
export function relayRefusalMessage(relayUrl: string | null, settingsFile: string): string | null {
  if (relayUrl) {
    return null;
  }
  return `${RELAY_NOT_CONFIGURED_MESSAGE} Looked at HAPPY_SERVER_URL and "serverUrl" in ${settingsFile}.`;
}
