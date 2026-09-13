import { homedir } from 'node:os';
import { join } from 'node:path';

export type Config = {
    serverUrl: string;
    homeDir: string;
    credentialPath: string;
};

export const RELAY_NOT_CONFIGURED_MESSAGE =
    'No relay is configured, and this build has no address of its own. Set HAPPY_SERVER_URL to the relay you run.';

/**
 * No relay address is built in, so an install that names none has nowhere it is
 * allowed to connect and stops here instead of reaching a server nobody chose.
 */
export function loadConfig(): Config {
    const configured = process.env.HAPPY_SERVER_URL?.trim();
    if (!configured) {
        throw new Error(RELAY_NOT_CONFIGURED_MESSAGE);
    }
    const serverUrl = configured.replace(/\/+$/, '');
    const homeDir = process.env.HAPPY_HOME_DIR ?? join(homedir(), '.happy');
    const credentialPath = join(homeDir, 'agent.key');
    return { serverUrl, homeDir, credentialPath };
}
