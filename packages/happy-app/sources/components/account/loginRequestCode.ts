/**
 * DESK-06, DEV-02: the code a computer shows while it waits to be let onto the account.
 *
 * The new computer publishes a one-time public key and displays it; a computer already signed in
 * approves it. Desktops have no camera, so the code is read as text, and text arrives with whatever
 * the clipboard and the surrounding chat added to it — a whole link, a bare key, a trailing newline.
 *
 * Validation is strict about the one thing that matters: the code must be a plausible one-time key
 * and nothing else. A code that does not parse here is refused before any account secret is
 * encrypted against it.
 */
import { isOneTimeLoginKey } from '@/auth/terminalLoginUrl';

export const LOGIN_REQUEST_URL_PREFIX = 'happy:///account?';

/** The approval URL for a pasted code, or null when the code is not one. */
export function normalizeLoginRequestCode(input: string): string | null {
    const trimmed = input.trim();
    if (trimmed.length === 0) return null;

    const withoutPrefix = trimmed.startsWith(LOGIN_REQUEST_URL_PREFIX)
        ? trimmed.slice(LOGIN_REQUEST_URL_PREFIX.length)
        : trimmed;

    // A pasted URL can still be the QR payload of a different flow; only the account one is taken.
    if (withoutPrefix.includes('://') || withoutPrefix.includes('?') || withoutPrefix.includes('/')) {
        return null;
    }

    const key = withoutPrefix.replace(/=+$/, '');
    if (!isOneTimeLoginKey(key)) return null;

    return `${LOGIN_REQUEST_URL_PREFIX}${key}`;
}
