import { encodeBase64 } from './encryption';
import { configuration } from '@/configuration';

/**
 * The browser URL that completes terminal authentication, or null while no
 * controller address is configured — nothing here points at a hosted app this
 * project does not run.
 */
export function generateWebAuthUrl(publicKey: Uint8Array): string | null {
    if (!configuration.webappUrl) {
        return null;
    }
    const publicKeyBase64 = encodeBase64(publicKey, 'base64url');
    return `${configuration.webappUrl}/terminal/connect#key=${publicKeyBase64}`;
}