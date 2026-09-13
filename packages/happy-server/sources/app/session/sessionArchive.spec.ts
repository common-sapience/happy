import fastify from "fastify";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Fastify } from "@/app/api/types";

const { state, dbMock, resetState } = vi.hoisted(() => {
    const state = {
        session: null as any,
        updates: [] as any[],
    };
    const resetState = () => {
        state.session = {
            id: "session-1",
            accountId: "user-1",
            metadata: "encrypted-metadata-v0",
            metadataVersion: 0,
            agentState: null,
            agentStateVersion: 0,
            dataEncryptionKey: null,
            projectId: null,
            seq: 0,
            active: true,
            archived: false,
            lastActiveAt: new Date("2026-01-01T00:00:00.000Z"),
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        };
        state.updates = [];
    };

    const dbMock = {
        session: {
            findUnique: vi.fn(async () => state.session),
            findFirst: vi.fn(async () => state.session),
            findMany: vi.fn(async () => [state.session]),
            updateMany: vi.fn(async (args: any) => {
                state.updates.push(args.data);
                Object.assign(state.session, args.data);
                return { count: 1 };
            }),
            update: vi.fn(async (args: any) => {
                state.updates.push(args.data);
                Object.assign(state.session, args.data);
                return state.session;
            }),
        },
    };

    return { state, dbMock, resetState };
});

vi.mock("@/storage/db", () => ({ db: dbMock }));
vi.mock("@/storage/seq", () => ({ allocateUserSeq: vi.fn(async () => 1), allocateSessionSeq: vi.fn(async () => 1) }));
vi.mock("@/app/events/eventRouter", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/app/events/eventRouter")>();
    return { ...actual, eventRouter: { emitUpdate: vi.fn(), emitEphemeral: vi.fn() } };
});
vi.mock("@/utils/log", () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

import { sessionRoutes } from "@/app/api/routes/sessionRoutes";
import { sessionUpdateHandler } from "@/app/api/socket/sessionUpdateHandler";
import type { ClientConnection } from "@/app/events/eventRouter";

async function createApp() {
    const app = fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    const typed = app.withTypeProvider<ZodTypeProvider>() as unknown as Fastify;
    typed.decorate("authenticate", async (request: any) => {
        request.userId = "user-1";
    });
    sessionRoutes(typed);
    await typed.ready();
    return typed;
}

type Handlers = Record<string, (...args: any[]) => any>;

function attachHandler(connection: ClientConnection): Handlers {
    const handlers: Handlers = {};
    const socket = {
        on: (event: string, handler: (...args: any[]) => any) => {
            handlers[event] = handler;
        },
        data: {},
    } as any;
    sessionUpdateHandler("user-1", socket, { ...connection, socket });
    return handlers;
}

const hostConnection = {
    connectionType: "session-scoped",
    userId: "user-1",
    sessionId: "session-1",
} as unknown as ClientConnection;

const controlConnection = {
    connectionType: "user-scoped",
    userId: "user-1",
} as unknown as ClientConnection;

describe("RL-07 — the archive state belongs to the host, the relay only mirrors it", () => {
    beforeEach(() => resetState());

    it("RL-07: the relay exposes no route that flips the archive state itself", async () => {
        const app = await createApp();
        try {
            const res = await app.inject({ method: "POST", url: "/v1/sessions/session-1/archive", payload: {} });
            expect(res.statusCode).toBe(404);
            expect(state.updates).toEqual([]);
            expect(state.session.active).toBe(true);
            expect(state.session.archived).toBe(false);
        } finally {
            await app.close();
        }
    });

    it("RL-07: the host's session-metadata write is what sets the plaintext marker", async () => {
        const handlers = attachHandler(hostConnection);
        const callback = vi.fn();

        await handlers["update-metadata"](
            { sid: "session-1", metadata: "encrypted-metadata-v1", expectedVersion: 0, archived: true },
            callback,
        );

        expect(callback).toHaveBeenCalledWith(expect.objectContaining({ result: "success", version: 1 }));
        expect(state.updates[0]).toMatchObject({ metadata: "encrypted-metadata-v1", metadataVersion: 1, archived: true });
        // Liveness stays a separate fact: archiving does not claim the host went offline (RL-04).
        expect(state.updates[0]).not.toHaveProperty("active");
    });

    it("RL-07: the same write restores the marker when the host un-archives", async () => {
        state.session.archived = true;
        const handlers = attachHandler(hostConnection);

        await handlers["update-metadata"](
            { sid: "session-1", metadata: "encrypted-metadata-v1", expectedVersion: 0, archived: false },
            vi.fn(),
        );

        expect(state.session.archived).toBe(false);
    });

    it("RL-07: a control client cannot write the marker back (it is not the owner)", async () => {
        const handlers = attachHandler(controlConnection);
        const callback = vi.fn();

        await handlers["update-metadata"](
            { sid: "session-1", metadata: "encrypted-metadata-v1", expectedVersion: 0, archived: true },
            callback,
        );

        // The metadata update itself still lands — only the archive marker is refused.
        expect(callback).toHaveBeenCalledWith(expect.objectContaining({ result: "success" }));
        expect(state.updates[0]).not.toHaveProperty("archived");
        expect(state.session.archived).toBe(false);
    });

    it("RL-07: a non-boolean marker is rejected instead of coerced", async () => {
        const handlers = attachHandler(hostConnection);
        const callback = vi.fn();

        await handlers["update-metadata"](
            { sid: "session-1", metadata: "encrypted-metadata-v1", expectedVersion: 0, archived: "yes" },
            callback,
        );

        expect(callback).toHaveBeenCalledWith({ result: "error" });
        expect(state.updates).toEqual([]);
    });

    it("RL-07: the marker is readable on the session list so the account page can filter", async () => {
        state.session.archived = true;
        const app = await createApp();
        try {
            const res = await app.inject({ method: "GET", url: "/v1/sessions" });
            expect(res.statusCode).toBe(200);
            expect(res.json().sessions[0]).toMatchObject({ id: "session-1", archived: true, active: true });
        } finally {
            await app.close();
        }
    });
});
