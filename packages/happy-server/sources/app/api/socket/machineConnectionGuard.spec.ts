import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({ dbMock: { machine: { findFirst: vi.fn() } } }));

vi.mock("@/storage/db", () => ({ db: dbMock }));

import { isMachineOnAccount } from "./machineConnectionGuard";

describe("DEV-04 — a removed computer cannot connect again", () => {
    beforeEach(() => {
        dbMock.machine.findFirst.mockReset();
    });

    it("admits a machine the account still has", async () => {
        dbMock.machine.findFirst.mockResolvedValue({ id: "machine-1" });

        await expect(isMachineOnAccount("user-1", "machine-1")).resolves.toBe(true);
        expect(dbMock.machine.findFirst).toHaveBeenCalledWith({
            where: { accountId: "user-1", id: "machine-1" },
            select: { id: true },
        });
    });

    it("refuses a machine that was removed from the account", async () => {
        dbMock.machine.findFirst.mockResolvedValue(null);

        await expect(isMachineOnAccount("user-1", "machine-1")).resolves.toBe(false);
    });

    it("refuses a machine that belongs to another account", async () => {
        dbMock.machine.findFirst.mockResolvedValue(null);

        await expect(isMachineOnAccount("user-2", "machine-1")).resolves.toBe(false);
    });

    it("refuses an empty machine id without asking the database", async () => {
        await expect(isMachineOnAccount("user-1", "")).resolves.toBe(false);
        expect(dbMock.machine.findFirst).not.toHaveBeenCalled();
    });
});
