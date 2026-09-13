import { decodeBase64 } from '@/encryption/base64';
import { encryptBox } from '@/encryption/libsodium';
import { authApprove } from '@/auth/authApprove';
import { checkTerminalLoginUrl } from '@/auth/terminalLoginUrl';
import { sync } from '@/sync/sync';

/**
 * Letting a computer onto this account.
 *
 * The waiting computer published a one-time public key; this seals the account key
 * against it and hands the result to the relay, which is the only way the other
 * side can ever read it. Two callers reach here — a code the user pasted or
 * scanned, and the daemon the desktop shell started — and they must seal it the
 * same way, so the sealing lives here.
 */
export async function approveTerminalLogin(
    credentials: { token: string; secret: string },
    url: string,
): Promise<void> {
    const checked = checkTerminalLoginUrl(url);
    if (!checked.valid) {
        throw new Error('That is not a login request');
    }
    const publicKey = decodeBase64(checked.key, 'base64url');
    const responseV1 = encryptBox(decodeBase64(credentials.secret, 'base64url'), publicKey);
    const responseV2Bundle = new Uint8Array(sync.encryption.contentDataKey.length + 1);
    responseV2Bundle[0] = 0;
    responseV2Bundle.set(sync.encryption.contentDataKey, 1);
    const responseV2 = encryptBox(responseV2Bundle, publicKey);
    await authApprove(credentials.token, publicKey, responseV1, responseV2);
}
