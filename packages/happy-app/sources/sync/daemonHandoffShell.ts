import { getRandomBytesAsync } from 'expo-crypto';

import { approveTerminalLogin } from '@/auth/approveTerminalLogin';
import { getCurrentAuth } from '@/auth/AuthContext';
import { encodeBase64 } from '@/encryption/base64';
import { isTauri } from '@/utils/isTauri';
import { checkDaemonLoginReply, decideLoginHandoff, decideRelayHandoff } from './daemonHandoff';
import { getRelayEndpoint } from './serverConfig';

/**
 * Handing the relay address and the account over to the daemon on this computer
 * (DESK-08, DESK-21).
 *
 * Only the shell can reach the daemon, so everything here is a no-op without one —
 * which is what the web build gets. The shell runs the daemon's own subcommands, so
 * the daemon writes its own files; the only thing this side hands over about the
 * account is an approval the relay carries, never a key and never a file.
 */

type ShellInvoke = (command: string, args: Record<string, unknown>) => Promise<unknown>;

function shellInvoke(): ShellInvoke | null {
    if (!isTauri()) {
        return null;
    }
    const internals = (window as any).__TAURI_INTERNALS__;
    return typeof internals?.invoke === 'function'
        ? (command, args) => internals.invoke(command, args)
        : null;
}

export function desktopShellPresent(): boolean {
    return shellInvoke() !== null;
}

/** Records the address this install resolved, so the daemon connects where the app does. */
export async function tellDaemonTheRelayAddress(): Promise<void> {
    const invoke = shellInvoke();
    const decision = decideRelayHandoff({
        shellPresent: invoke !== null,
        endpoint: getRelayEndpoint(),
    });
    if (!decision.tell || !invoke) {
        return;
    }
    try {
        await invoke('set_daemon_relay', { url: decision.url });
    } catch (error) {
        console.warn('Could not tell the daemon which relay to use', error);
    }
}

let loginAsked = false;

/**
 * Puts this computer on the account without the user pairing their own machine by
 * hand: the shell asks its daemon to publish a login request, and this app approves
 * the one carrying the token it minted for that request.
 */
export async function letDaemonJoinTheAccount(): Promise<void> {
    const invoke = shellInvoke();
    const auth = getCurrentAuth();
    const decision = decideLoginHandoff({
        shellPresent: invoke !== null,
        loggedIn: auth?.isAuthenticated === true && auth.credentials !== null,
        alreadyAsked: loginAsked,
    });
    if (!decision.ask || !invoke || !auth?.credentials) {
        return;
    }
    loginAsked = true;
    try {
        const token = encodeBase64(await getRandomBytesAsync(32), 'base64url');
        const reply = await invoke('request_daemon_login', { token });
        const checked = checkDaemonLoginReply(token, reply);
        if (!checked.approve) {
            if (checked.reason !== 'nothing-to-approve') {
                console.warn(`Refused the daemon's login request: ${checked.reason}`);
            }
            return;
        }
        await approveTerminalLogin(auth.credentials, checked.url);
    } catch (error) {
        loginAsked = false;
        console.warn('Could not put this computer on the account', error);
    }
}
