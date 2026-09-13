import { apiSocket } from '@/sync/apiSocket';

/**
 * DESK-17, PERM-08, RULE-10: the permission confirmation switch, per computer.
 *
 * The switch is host state, not control-end state: it lives in the daemon's settings on the
 * computer it governs, and any paired control end may read or change it. The daemon's settings file
 * is not reachable from the app, so both directions go over the machine RPC channel — the same path
 * archiving uses (RL-07) — and the daemon remains the only writer of its own state.
 *
 * The daemon must answer these two methods:
 * - `get-permission-confirmation`, no parameters, replying `{ enabled: boolean }`
 * - `set-permission-confirmation`, `{ enabled: boolean }`, replying the state it settled on
 *
 * A reply in any other shape is a refusal, not a "no": treating an unreadable answer as "off" would
 * tell the user no confirmations are coming when the computer may well be asking for them.
 */
export const GET_PERMISSION_CONFIRMATION_RPC = 'get-permission-confirmation';
export const SET_PERMISSION_CONFIRMATION_RPC = 'set-permission-confirmation';

export function parsePermissionConfirmationReply(reply: unknown): boolean {
    if (typeof reply !== 'object' || reply === null) {
        throw new Error('The computer did not report its permission confirmation setting.');
    }
    const enabled = (reply as { enabled?: unknown }).enabled;
    if (typeof enabled !== 'boolean') {
        throw new Error('The computer did not report its permission confirmation setting.');
    }
    return enabled;
}

export async function machineGetPermissionConfirmation(machineId: string): Promise<boolean> {
    const reply = await apiSocket.machineRPC<unknown, Record<string, never>>(
        machineId,
        GET_PERMISSION_CONFIRMATION_RPC,
        {},
    );
    return parsePermissionConfirmationReply(reply);
}

export async function machineSetPermissionConfirmation(machineId: string, enabled: boolean): Promise<boolean> {
    const reply = await apiSocket.machineRPC<unknown, { enabled: boolean }>(
        machineId,
        SET_PERMISSION_CONFIRMATION_RPC,
        { enabled },
    );
    return parsePermissionConfirmationReply(reply);
}
