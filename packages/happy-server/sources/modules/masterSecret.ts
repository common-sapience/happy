/**
 * The one secret every account on the relay rests on (RULE-01, DEV-07): it seeds token signing
 * and the relay's own encryption. A relay that starts without it builds both on an empty value,
 * so every entry point validates it before anything else runs and refuses to start otherwise.
 * The value itself never reaches a message or a log.
 */

export const MASTER_SECRET_ENV_VAR = "HANDY_MASTER_SECRET";
export const MASTER_SECRET_MIN_LENGTH = 16;

export function requireMasterSecret(env: NodeJS.ProcessEnv = process.env): string {
    const secret = env[MASTER_SECRET_ENV_VAR];
    if (!secret || secret.trim().length === 0) {
        throw new Error(`${MASTER_SECRET_ENV_VAR} is required`);
    }
    if (secret.length < MASTER_SECRET_MIN_LENGTH) {
        throw new Error(`${MASTER_SECRET_ENV_VAR} must be at least ${MASTER_SECRET_MIN_LENGTH} characters`);
    }
    return secret;
}
