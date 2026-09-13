/**
 * What this app tells the daemon on the same computer (DESK-08, DESK-21, RULE-12).
 *
 * On the desktop the app and the daemon are two processes on one machine, and each
 * kept its own idea of the world: the app knew the relay address the user entered
 * and the account it had logged into, the daemon knew neither. So a package built
 * with no relay baked in opened on the address screen while its own daemon refused
 * to start for want of an address, and this computer never appeared in the list of
 * computers the account can use.
 *
 * The app is the authority on both facts, so it hands them over: the address the
 * daemon should record, and a login request for the account. Deciding *whether* to
 * hand anything over is what lives here; the handing over is in
 * `daemonHandoffShell.ts`, which only talks to the shell.
 *
 * On the web there is no shell and no daemon beside the app, so there is nothing
 * to tell and nothing changes.
 */

import { checkTerminalLoginUrl } from '@/auth/terminalLoginUrl';
import { normalizeRelayAddress, type RelayEndpoint } from './relayEndpoint';

export type RelayHandoffDecision =
    | { tell: true; url: string }
    | { tell: false; reason: 'no-shell' | 'no-address' };

export function decideRelayHandoff(options: {
    shellPresent: boolean;
    endpoint: RelayEndpoint;
}): RelayHandoffDecision {
    if (!options.shellPresent) {
        return { tell: false, reason: 'no-shell' };
    }
    if (!options.endpoint.configured) {
        return { tell: false, reason: 'no-address' };
    }
    // What is handed over has to survive the daemon reading it back, and the daemon
    // reads it with the same rules this resolver applies.
    const url = normalizeRelayAddress(options.endpoint.url);
    if (!url) {
        return { tell: false, reason: 'no-address' };
    }
    return { tell: true, url };
}

export type LoginHandoffDecision =
    | { ask: true }
    | { ask: false; reason: 'no-shell' | 'not-logged-in' | 'already-asked' };

export function decideLoginHandoff(options: {
    shellPresent: boolean;
    loggedIn: boolean;
    alreadyAsked: boolean;
}): LoginHandoffDecision {
    if (!options.shellPresent) {
        return { ask: false, reason: 'no-shell' };
    }
    // The account key is what approval seals; without it there is nothing to approve with.
    if (!options.loggedIn) {
        return { ask: false, reason: 'not-logged-in' };
    }
    if (options.alreadyAsked) {
        return { ask: false, reason: 'already-asked' };
    }
    return { ask: true };
}

export type DaemonLoginReplyCheck =
    | { approve: true; url: string }
    | { approve: false; reason: 'nothing-to-approve' | 'wrong-token' | 'not-a-login-request' };

/**
 * Whether a login request may be approved without asking the user.
 *
 * Approving seals this account's key against whatever key the request names, so
 * the only request this app approves by itself is the one it caused: the shell was
 * given a one-time token, the daemon echoes it back, and a reply that does not
 * carry that exact token is somebody else's request.
 */
export function checkDaemonLoginReply(expectedToken: string, reply: unknown): DaemonLoginReplyCheck {
    if (typeof reply !== 'object' || reply === null) {
        return { approve: false, reason: 'nothing-to-approve' };
    }
    const { status, token, url } = reply as { status?: unknown; token?: unknown; url?: unknown };
    if (expectedToken.length === 0 || typeof token !== 'string' || token !== expectedToken) {
        return { approve: false, reason: 'wrong-token' };
    }
    if (status !== 'awaiting-approval') {
        return { approve: false, reason: 'nothing-to-approve' };
    }
    const checked = checkTerminalLoginUrl(typeof url === 'string' ? url : null);
    if (!checked.valid) {
        return { approve: false, reason: 'not-a-login-request' };
    }
    return { approve: true, url: url as string };
}
