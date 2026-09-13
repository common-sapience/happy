/**
 * The desktop shell starts the daemon itself (DESK-09), before the user has
 * necessarily logged in. The terminal flow answers that by asking the user to
 * authenticate interactively, which a process started by a GUI cannot do: it has
 * no terminal to draw on and nobody watching it. With this flag the daemon
 * reports that it has nothing to do and exits, leaving the shell to try again.
 */

export const ONLY_IF_AUTHENTICATED_FLAG = '--only-if-authenticated';

export function shouldDeferDaemonStart(args: string[], hasCredentials: boolean): boolean {
  return args.includes(ONLY_IF_AUTHENTICATED_FLAG) && !hasCredentials;
}
