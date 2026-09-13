import { beforeEach, describe, expect, it, vi } from 'vitest';

const { machineRPC } = vi.hoisted(() => ({ machineRPC: vi.fn() }));

vi.mock('@/sync/apiSocket', () => ({ apiSocket: { machineRPC } }));

describe('DESK-17 permission confirmation switch lives on the computer', () => {
    beforeEach(() => {
        machineRPC.mockReset();
    });

    it('reads the switch from the computer it governs', async () => {
        machineRPC.mockResolvedValue({ enabled: true });
        const { machineGetPermissionConfirmation } = await import('./machinePermissionConfirmation');

        await expect(machineGetPermissionConfirmation('machine-1')).resolves.toBe(true);
        expect(machineRPC).toHaveBeenCalledWith('machine-1', 'get-permission-confirmation', {});
    });

    it('writes the switch to the computer rather than to control-end settings', async () => {
        machineRPC.mockResolvedValue({ enabled: true });
        const { machineSetPermissionConfirmation } = await import('./machinePermissionConfirmation');

        await expect(machineSetPermissionConfirmation('machine-1', true)).resolves.toBe(true);
        expect(machineRPC).toHaveBeenCalledWith('machine-1', 'set-permission-confirmation', { enabled: true });
    });

    it('refuses an unreadable answer instead of reporting the switch as off', async () => {
        const { parsePermissionConfirmationReply } = await import('./machinePermissionConfirmation');

        expect(() => parsePermissionConfirmationReply(undefined)).toThrow();
        expect(() => parsePermissionConfirmationReply({})).toThrow();
        expect(() => parsePermissionConfirmationReply({ enabled: 'yes' })).toThrow();
        expect(parsePermissionConfirmationReply({ enabled: false })).toBe(false);
    });

    it('reads the value the computer published in its metadata', async () => {
        const { readPublishedPermissionConfirmation } = await import('./machinePermissionConfirmation');

        expect(readPublishedPermissionConfirmation({ permissionConfirmationEnabled: true })).toBe(true);
        expect(readPublishedPermissionConfirmation({ permissionConfirmationEnabled: false })).toBe(false);
    });

    it('treats an unpublished or unreadable metadata value as unknown, not as off', async () => {
        const { readPublishedPermissionConfirmation } = await import('./machinePermissionConfirmation');

        expect(readPublishedPermissionConfirmation(null)).toBeNull();
        expect(readPublishedPermissionConfirmation(undefined)).toBeNull();
        expect(readPublishedPermissionConfirmation({})).toBeNull();
        expect(readPublishedPermissionConfirmation({ permissionConfirmationEnabled: 'yes' })).toBeNull();
    });

    it('surfaces a computer that cannot be asked', async () => {
        machineRPC.mockRejectedValue(new Error('Machine encryption not found for machine-1'));
        const { machineGetPermissionConfirmation } = await import('./machinePermissionConfirmation');

        await expect(machineGetPermissionConfirmation('machine-1')).rejects.toThrow('Machine encryption not found');
    });
});
