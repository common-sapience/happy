import fastify from "fastify";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Fastify } from "../types";
// Cross-package contract check: the app's real update schema. apiTypes.ts is
// pure zod (no react-native / @/ aliases), so it imports cleanly in node.
import { ApiUpdateContainerSchema } from "../../../../../happy-app/sources/sync/apiTypes";

const {
    state,
    dbMock,
    resetState,
    allocateUserSeqMock,
    emitUpdateSpy,
    emitEphemeralSpy,
    disconnectMachineSpy,
} = vi.hoisted(() => {
    const emitUpdateSpy = vi.fn();
    const emitEphemeralSpy = vi.fn();
    const disconnectMachineSpy = vi.fn();
    const state = {
        existingMachine: null as any,
        created: [] as any[],
        seq: 0,
    };

    const resetState = () => {
        state.existingMachine = null;
        state.created = [];
        state.seq = 0;
    };

    const machineFindFirst = vi.fn(async () => state.existingMachine);
    const machineCreate = vi.fn(async (args: any) => {
        // Mirror a Prisma Machine row: server defaults active=false on create
        // ("Default to offline - in case the user does not start daemon").
        const now = new Date("2026-01-01T00:00:00.000Z");
        const row = {
            id: args.data.id,
            accountId: args.data.accountId,
            seq: 7,
            metadata: args.data.metadata,
            metadataVersion: args.data.metadataVersion ?? 1,
            daemonState: args.data.daemonState ?? null,
            daemonStateVersion: args.data.daemonStateVersion ?? 0,
            dataEncryptionKey: args.data.dataEncryptionKey ?? null,
            active: false,
            lastActiveAt: now,
            createdAt: now,
            updatedAt: now,
        };
        state.created.push(row);
        return row;
    });

    const machineDelete = vi.fn(async (args: any) => ({ id: args.where.id }));
    const dbMock = { machine: { findFirst: machineFindFirst, create: machineCreate, delete: machineDelete } };
    const allocateUserSeqMock = vi.fn(async () => ++state.seq);

    return {
        state,
        dbMock,
        resetState,
        allocateUserSeqMock,
        emitUpdateSpy,
        emitEphemeralSpy,
        disconnectMachineSpy,
    };
});

// Keep the REAL event-builder functions (buildNewMachineUpdate etc.), but
// replace the eventRouter singleton with a spy so we can capture exactly what
// the create handler emits.
vi.mock("@/app/events/eventRouter", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/app/events/eventRouter")>();
    return {
        ...actual,
        eventRouter: {
            emitUpdate: emitUpdateSpy,
            emitEphemeral: emitEphemeralSpy,
            disconnectMachine: disconnectMachineSpy,
        },
    };
});
vi.mock("@/storage/db", () => ({ db: dbMock }));
vi.mock("@/storage/seq", () => ({ allocateUserSeq: allocateUserSeqMock }));
vi.mock("@/storage/inTx", () => ({ inTx: async (fn: any) => fn(dbMock), afterTx: (_tx: any, cb: () => void) => cb() }));
vi.mock("@/utils/log", () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() }));

import { machinesRoutes } from "./machinesRoutes";

async function createApp() {
    const app = fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    const typed = app.withTypeProvider<ZodTypeProvider>() as unknown as Fastify;
    typed.decorate("authenticate", async (request: any, reply: any) => {
        const userId = request.headers["x-user-id"];
        if (typeof userId !== "string") {
            return reply.code(401).send({ error: "Unauthorized" });
        }
        request.userId = userId;
    });
    machinesRoutes(typed);
    await typed.ready();
    return typed;
}

function findEmit(t: string) {
    return emitUpdateSpy.mock.calls.find(([p]) => p?.payload?.body?.t === t)?.[0];
}

describe("machinesRoutes — POST /v1/machines creation emits", () => {
    let app: Fastify;
    beforeEach(() => { resetState(); emitUpdateSpy.mockClear(); emitEphemeralSpy.mockClear(); });
    afterEach(async () => { if (app) await app.close(); });

    it("emits new-machine to the user's app AND a key-less update-machine companion", async () => {
        app = await createApp();

        const res = await app.inject({
            method: "POST",
            url: "/v1/machines",
            headers: { "x-user-id": "user-1" },
            payload: {
                id: "machine-1",
                metadata: "encrypted-metadata-blob",
                dataEncryptionKey: Buffer.from("the-data-key").toString("base64"),
            },
        });
        expect(res.statusCode).toBe(200);

        const newMachine = findEmit("new-machine");
        const updateMachine = findEmit("update-machine");

        // Both updates are emitted on creation.
        expect(newMachine).toBeDefined();
        expect(updateMachine).toBeDefined();

        // new-machine is the signal the user's app gets to LEARN about the
        // machine, and it carries the per-machine data encryption key.
        expect(newMachine.recipientFilter).toEqual({ type: "user-scoped-only" });
        expect(newMachine.payload.body.dataEncryptionKey).toBeTruthy();

        // The update-machine companion ALSO reaches the app (machine-scoped-only
        // resolves to a union that includes the user-scoped room), but it carries
        // NO data encryption key — so pre-fix the app could not initialize this
        // brand-new machine's encryption from it and dropped it at the
        // getMachineEncryption() guard. That's why new-machine handling is required.
        expect(updateMachine.recipientFilter).toEqual({ type: "machine-scoped-only", machineId: "machine-1" });
        expect(updateMachine.payload.body).not.toHaveProperty("dataEncryptionKey");
    });

    it("emits a new-machine update that validates against the app's update schema (the fix accepts the real payload)", async () => {
        app = await createApp();

        await app.inject({
            method: "POST",
            url: "/v1/machines",
            headers: { "x-user-id": "user-1" },
            payload: {
                id: "machine-2",
                metadata: "encrypted-metadata-blob",
                dataEncryptionKey: Buffer.from("the-data-key").toString("base64"),
            },
        });

        const newMachine = findEmit("new-machine");
        expect(newMachine).toBeDefined();

        // The exact container the server pushes over the 'update' socket event —
        // this is what Sync.handleUpdate runs ApiUpdateContainerSchema.safeParse()
        // on. Pre-fix it failed (no new-machine member) and the machine was
        // dropped; post-fix it must validate.
        const parsed = ApiUpdateContainerSchema.safeParse(newMachine.payload);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.body.t).toBe("new-machine");
        }
    });

    it("emits a new-machine update that also validates when there is no data encryption key", async () => {
        app = await createApp();

        await app.inject({
            method: "POST",
            url: "/v1/machines",
            headers: { "x-user-id": "user-1" },
            payload: { id: "machine-3", metadata: "encrypted-metadata-blob" },
        });

        const newMachine = findEmit("new-machine");
        expect(newMachine).toBeDefined();
        expect(newMachine.payload.body.dataEncryptionKey).toBeNull();
        expect(ApiUpdateContainerSchema.safeParse(newMachine.payload).success).toBe(true);
    });
});

/**
 * DEV-04: removing a computer has to end its reach, not just its row. Its daemon holds a
 * machine-scoped socket that is also the member of every RPC room it registered, so the delete
 * disconnects that socket — after which a caller holding the machine id has nothing to be
 * forwarded to.
 */
describe("DEV-04 — DELETE /v1/machines/:id cuts the removed computer off", () => {
    let app: Fastify;
    beforeEach(() => {
        resetState();
        emitUpdateSpy.mockClear();
        emitEphemeralSpy.mockClear();
        disconnectMachineSpy.mockClear();
    });
    afterEach(async () => { if (app) await app.close(); });

    it("disconnects the removed computer's sockets and announces the removal", async () => {
        state.existingMachine = { id: "machine-1", accountId: "user-1" };
        app = await createApp();

        const res = await app.inject({
            method: "DELETE",
            url: "/v1/machines/machine-1",
            headers: { "x-user-id": "user-1" },
        });

        expect(res.statusCode).toBe(200);
        expect(disconnectMachineSpy).toHaveBeenCalledWith("user-1", "machine-1");
        expect(findEmit("delete-machine")).toBeDefined();
    });

    it("disconnects nothing when the computer is not on this account", async () => {
        state.existingMachine = null;
        app = await createApp();

        const res = await app.inject({
            method: "DELETE",
            url: "/v1/machines/machine-1",
            headers: { "x-user-id": "user-1" },
        });

        expect(res.statusCode).toBe(404);
        expect(disconnectMachineSpy).not.toHaveBeenCalled();
    });
});
