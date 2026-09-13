import fastify from "fastify";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { describe, expect, it, vi } from "vitest";
import { type Fastify } from "../types";

vi.mock("@/storage/db", () => ({ db: {} }));
vi.mock("@/app/auth/auth", () => ({ auth: {} }));
vi.mock("@/utils/log", () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

import { authRoutes } from "./authRoutes";

/**
 * Adding a second computer runs entirely through these routes: the new machine files a
 * one-time login request, an already-logged-in machine approves it, and the new machine polls
 * for the response. The pruning pass must not take them with it.
 */
describe("DEV-02 — the login-request approve flow stays on the relay", () => {
    it("DEV-02: challenge-response login and the login-request routes are all registered", async () => {
        const app = fastify();
        app.setValidatorCompiler(validatorCompiler);
        app.setSerializerCompiler(serializerCompiler);
        const typed = app.withTypeProvider<ZodTypeProvider>() as unknown as Fastify;
        const registered = new Set<string>();
        app.addHook("onRoute", (route) => registered.add(`${route.method} ${route.url}`));
        authRoutes(typed);
        await typed.ready();

        try {
            expect([...registered].sort()).toEqual([
                "POST /v1/auth",
                "POST /v1/auth/account/request",
                "POST /v1/auth/account/response",
                "POST /v1/auth/request",
                "POST /v1/auth/response",
                ...["GET /v1/auth/request/status", "HEAD /v1/auth/request/status"],
            ].sort());
        } finally {
            await app.close();
        }
    });
});
