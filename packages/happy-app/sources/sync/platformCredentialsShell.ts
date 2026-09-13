import {
    PLATFORM_GATEWAY_FIELDS,
    platformGatewayRequest,
    type PlatformGatewayField,
    type PlatformGatewayState,
} from '@/components/account/platformGateway';
import { shellInvoke } from './daemonHandoffShell';

/**
 * Setting this computer's model gateway from the account page (DESK-12, HOST-09).
 *
 * The app never holds the platform API key: it hands the value to the desktop shell, the shell
 * writes it to the daemon's stdin, and the daemon writes its own credential store. Nothing about
 * the key is kept here — not in app storage, not in a log, not in the reply, which reports only
 * which fields the computer now holds.
 *
 * Without a shell there is no computer to ask, which is the web build: the rows there are
 * read-only and say where the values live instead.
 */

export const SET_PLATFORM_CREDENTIALS_COMMAND = 'set_platform_credentials';

export interface PlatformGatewayReport {
    set: PlatformGatewayState;
    machineId: string | null;
}

/**
 * A reply in any other shape is a refusal, not an empty gateway: reporting "not set" for a computer
 * that did not answer would invite the user to overwrite a key that is already there.
 */
export function parsePlatformGatewayReply(reply: unknown): PlatformGatewayReport {
    if (typeof reply !== 'object' || reply === null) {
        throw new Error('The computer did not report its model gateway.');
    }
    const set = (reply as { set?: unknown }).set;
    if (typeof set !== 'object' || set === null) {
        throw new Error('The computer did not report its model gateway.');
    }
    const record = set as Record<string, unknown>;
    if (PLATFORM_GATEWAY_FIELDS.some((field) => typeof record[field] !== 'boolean')) {
        throw new Error('The computer did not report its model gateway.');
    }
    const machineId = (reply as { machineId?: unknown }).machineId;
    return {
        set: {
            apiKey: record.apiKey as boolean,
            baseUrl: record.baseUrl as boolean,
            modelId: record.modelId as boolean,
        },
        machineId: typeof machineId === 'string' ? machineId : null,
    };
}

export function platformGatewayShellPresent(): boolean {
    return shellInvoke() !== null;
}

/** Asks the computer what it holds. Naming no field is a read: the daemon writes nothing. */
export async function readPlatformGateway(): Promise<PlatformGatewayReport | null> {
    const invoke = shellInvoke();
    if (!invoke) {
        return null;
    }
    return parsePlatformGatewayReply(await invoke(SET_PLATFORM_CREDENTIALS_COMMAND, { request: '{}' }));
}

/** Hands one field's value over to the computer, and reports back what it now holds. */
export async function savePlatformGatewayField(
    field: PlatformGatewayField,
    value: string,
): Promise<PlatformGatewayReport> {
    const invoke = shellInvoke();
    if (!invoke) {
        throw new Error('This computer cannot be reached from here.');
    }
    const reply = await invoke(SET_PLATFORM_CREDENTIALS_COMMAND, {
        request: platformGatewayRequest(field, value),
    });
    return parsePlatformGatewayReply(reply);
}
