/**
 * The URL a computer publishes while it waits to be let onto an account.
 *
 * One shape, three readers: the computer that shows it, the controller that reads
 * it off a QR code or a paste, and the desktop shell that asks its own daemon for
 * one. The tail is a one-time public key and nothing else — an account key is
 * about to be sealed against it, so a tail that is not one is refused before any
 * encryption happens.
 */

export const TERMINAL_LOGIN_URL_PREFIX = 'happy://terminal?';

const ONE_TIME_KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export function isOneTimeLoginKey(key: string): boolean {
    return ONE_TIME_KEY_PATTERN.test(key);
}

export type TerminalLoginUrlCheck =
    | { valid: true; key: string }
    | { valid: false };

export function checkTerminalLoginUrl(url: string | null | undefined): TerminalLoginUrlCheck {
    if (typeof url !== 'string' || !url.startsWith(TERMINAL_LOGIN_URL_PREFIX)) {
        return { valid: false };
    }
    const key = url.slice(TERMINAL_LOGIN_URL_PREFIX.length).replace(/=+$/, '');
    if (!isOneTimeLoginKey(key)) {
        return { valid: false };
    }
    return { valid: true, key };
}
