import { db } from "@/storage/db";

/**
 * DEV-04: a computer removed from the account may not come back on its own. Its daemon still
 * holds a valid account token and retries the connection on a timer, so a machine-scoped
 * connection is admitted only while the account still has that machine. Deny by default: the
 * row has to be found, an unreadable database is a refusal, not an admission.
 */
export async function isMachineOnAccount(userId: string, machineId: string): Promise<boolean> {
    if (!userId || !machineId) {
        return false;
    }
    const machine = await db.machine.findFirst({
        where: { accountId: userId, id: machineId },
        select: { id: true },
    });
    return machine !== null && machine !== undefined;
}
