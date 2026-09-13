import * as fs from "fs";
import * as path from "path";
import fastify from "fastify";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Fastify } from "../types";

const { state, dbMock, resetState } = vi.hoisted(() => {
    const state = {
        machines: ["machine-1"] as string[],
        connections: [] as any[],
    };
    const resetState = () => {
        state.machines = ["machine-1"];
        state.connections = [];
    };

    const now = new Date("2026-01-01T00:00:00.000Z");
    const dbMock = {
        machine: {
            findFirst: vi.fn(async (args: any) => (state.machines.includes(args.where.id) ? { id: args.where.id } : null)),
        },
        serviceConnection: {
            upsert: vi.fn(async (args: any) => {
                const { accountId, machineId, vendor } = args.where.accountId_machineId_vendor;
                const existing = state.connections.find(
                    (c) => c.accountId === accountId && c.machineId === machineId && c.vendor === vendor,
                );
                if (existing) {
                    Object.assign(existing, args.update);
                    return existing;
                }
                const row = { id: `conn-${state.connections.length + 1}`, createdAt: now, updatedAt: now, ...args.create };
                state.connections.push(row);
                return row;
            }),
            findMany: vi.fn(async () => state.connections),
            deleteMany: vi.fn(async (args: any) => {
                const before = state.connections.length;
                state.connections = state.connections.filter(
                    (c) =>
                        !(
                            c.accountId === args.where.accountId &&
                            c.machineId === args.where.machineId &&
                            c.vendor === args.where.vendor
                        ),
                );
                return { count: before - state.connections.length };
            }),
        },
    };

    return { state, dbMock, resetState };
});

vi.mock("@/storage/db", () => ({ db: dbMock }));
vi.mock("@/utils/log", () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

import { connectRoutes } from "./connectRoutes";

async function createApp() {
    const app = fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    const typed = app.withTypeProvider<ZodTypeProvider>() as unknown as Fastify;
    typed.decorate("authenticate", async (request: any) => {
        request.userId = "user-1";
    });
    connectRoutes(typed);
    await typed.ready();
    return typed;
}

const serverRoot = path.resolve(__dirname, "../../../..");

describe("DEV-08 — a connector is a record, never a credential", () => {
    beforeEach(() => resetState());

    it("DEV-08: registering a connector stores only the service, the machine and the status", async () => {
        const app = await createApp();
        try {
            const res = await app.inject({
                method: "POST",
                url: "/v1/connect/calendar/register",
                payload: { machineId: "machine-1" },
            });
            expect(res.statusCode).toBe(200);
            expect(res.json().connection).toMatchObject({
                vendor: "calendar",
                machineId: "machine-1",
                status: "connected",
            });
            expect(Object.keys(state.connections[0]).sort()).toEqual(
                ["accountId", "createdAt", "id", "machineId", "status", "updatedAt", "vendor"].sort(),
            );
        } finally {
            await app.close();
        }
    });

    it("DEV-08: a registration that still carries a credential is rejected, not silently stripped", async () => {
        const app = await createApp();
        try {
            const res = await app.inject({
                method: "POST",
                url: "/v1/connect/calendar/register",
                payload: { machineId: "machine-1", token: "sk-live-should-never-reach-the-relay" },
            });
            expect(res.statusCode).toBe(400);
            expect(state.connections).toEqual([]);
        } finally {
            await app.close();
        }
    });

    it("DEV-08: a connector can only be attached to a machine of the caller's own account", async () => {
        const app = await createApp();
        try {
            const res = await app.inject({
                method: "POST",
                url: "/v1/connect/calendar/register",
                payload: { machineId: "machine-of-another-account" },
            });
            expect(res.statusCode).toBe(404);
            expect(state.connections).toEqual([]);
        } finally {
            await app.close();
        }
    });

    it("DEV-08: the account page lists every connection with the machine that owns it", async () => {
        const app = await createApp();
        try {
            await app.inject({ method: "POST", url: "/v1/connect/calendar/register", payload: { machineId: "machine-1" } });
            const res = await app.inject({ method: "GET", url: "/v1/connect" });
            expect(res.statusCode).toBe(200);
            expect(res.json().connections).toEqual([
                expect.objectContaining({ vendor: "calendar", machineId: "machine-1", status: "connected" }),
            ]);
            expect(JSON.stringify(res.json())).not.toMatch(/token|secret|credential/i);
        } finally {
            await app.close();
        }
    });

    it("DEV-08: the record disappears when the host disconnects the service", async () => {
        const app = await createApp();
        try {
            await app.inject({ method: "POST", url: "/v1/connect/calendar/register", payload: { machineId: "machine-1" } });
            const res = await app.inject({ method: "DELETE", url: "/v1/connect/calendar?machineId=machine-1" });
            expect(res.statusCode).toBe(200);
            expect(state.connections).toEqual([]);
            expect((await app.inject({ method: "DELETE", url: "/v1/connect/calendar?machineId=machine-1" })).statusCode).toBe(404);
        } finally {
            await app.close();
        }
    });

    it("DEV-08: the credential-returning routes are gone", async () => {
        const app = await createApp();
        try {
            for (const url of ["/v1/connect/calendar/token", "/v1/connect/tokens"]) {
                expect((await app.inject({ method: "GET", url })).statusCode).toBe(404);
            }
        } finally {
            await app.close();
        }
    });

    it("DEV-08: no credential column survives in the data model", () => {
        const schema = fs.readFileSync(path.join(serverRoot, "prisma/schema.prisma"), "utf8");
        expect(schema).not.toMatch(/model ServiceAccountToken\b/);
        const model = schema.match(/model ServiceConnection \{[^}]*\}/)?.[0];
        expect(model).toBeTruthy();
        expect(model).not.toMatch(/\btoken\b|\bsecret\b|\bcredential\b|\baccessToken\b|\brefreshToken\b/i);
        expect(model).toMatch(/\bvendor\b/);
        expect(model).toMatch(/\bmachineId\b/);
        expect(model).toMatch(/\bstatus\b/);
    });

    it("DEV-08: the migration drops the table that used to hold the credential", () => {
        const migrations = path.join(serverRoot, "prisma/migrations");
        const statements = fs
            .readdirSync(migrations)
            .filter((d) => fs.existsSync(path.join(migrations, d, "migration.sql")))
            .map((d) => fs.readFileSync(path.join(migrations, d, "migration.sql"), "utf8"))
            .join("\n");
        expect(statements).toMatch(/DROP TABLE IF EXISTS "ServiceAccountToken";/);
        expect(statements).toMatch(/CREATE TABLE "ServiceConnection"/);
    });
});
