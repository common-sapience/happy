import fastify from "fastify";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import nacl from "tweetnacl";
import * as privacyKit from "privacy-kit";
import { type Fastify } from "../types";

const { dbMock, authMock } = vi.hoisted(() => ({
    dbMock: {} as Record<string, any>,
    authMock: {} as Record<string, any>,
}));

vi.mock("@/storage/db", () => ({ db: dbMock }));
vi.mock("@/app/auth/auth", () => ({ auth: authMock }));
vi.mock("@/utils/log", () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

import { authRoutes } from "./authRoutes";

async function buildApp() {
    const app = fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    const typed = app.withTypeProvider<ZodTypeProvider>() as unknown as Fastify;
    authRoutes(typed);
    await typed.ready();
    return app;
}

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
        app.addHook("onRoute", (route) => {
            registered.add(`${route.method} ${route.url}`);
        });
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

/**
 * The login route is the only thing between a stranger and every account on the relay
 * (RULE-01, DEV-01). Deny by default: a request whose key or signature is the wrong shape is
 * refused exactly like one whose signature does not verify — never with a server error, which
 * tells the caller it found a way in that the relay did not expect.
 */
describe("RULE-01 / DEV-01 — a forged login is refused with 401", () => {
    beforeEach(() => {
        dbMock.account = { upsert: vi.fn(async () => ({ id: "account-1" })) };
        authMock.createToken = vi.fn(async () => "token-1");
    });

    const challenge = privacyKit.encodeBase64(new Uint8Array(32).fill(7));

    it("refuses a public key that is not base64 at all", async () => {
        const app = await buildApp();
        try {
            const response = await app.inject({
                method: "POST",
                url: "/v1/auth",
                payload: { publicKey: "not base64 !!!", challenge, signature: "also not base64 !!!" },
            });
            expect(response.statusCode).toBe(401);
            expect(response.json()).toEqual({ error: "Invalid signature" });
        } finally {
            await app.close();
        }
    });

    it("refuses a public key of the wrong length", async () => {
        const app = await buildApp();
        try {
            const response = await app.inject({
                method: "POST",
                url: "/v1/auth",
                payload: {
                    publicKey: privacyKit.encodeBase64(new Uint8Array(30).fill(1)),
                    challenge,
                    signature: privacyKit.encodeBase64(new Uint8Array(nacl.sign.signatureLength)),
                },
            });
            expect(response.statusCode).toBe(401);
        } finally {
            await app.close();
        }
    });

    it("refuses a signature of the wrong length", async () => {
        const app = await buildApp();
        try {
            const response = await app.inject({
                method: "POST",
                url: "/v1/auth",
                payload: {
                    publicKey: privacyKit.encodeBase64(new Uint8Array(nacl.sign.publicKeyLength)),
                    challenge,
                    signature: privacyKit.encodeBase64(new Uint8Array(48).fill(3)),
                },
            });
            expect(response.statusCode).toBe(401);
        } finally {
            await app.close();
        }
    });

    it("refuses a well-shaped request whose signature does not verify", async () => {
        const app = await buildApp();
        try {
            const response = await app.inject({
                method: "POST",
                url: "/v1/auth",
                payload: {
                    publicKey: privacyKit.encodeBase64(new Uint8Array(nacl.sign.keyPair().publicKey)),
                    challenge,
                    signature: privacyKit.encodeBase64(new Uint8Array(nacl.sign.signatureLength).fill(9)),
                },
            });
            expect(response.statusCode).toBe(401);
            expect(dbMock.account.upsert).not.toHaveBeenCalled();
        } finally {
            await app.close();
        }
    });

    it("issues a token for a login signed with the matching key", async () => {
        const keyPair = nacl.sign.keyPair();
        const challengeBytes = new Uint8Array(32).fill(7);
        const app = await buildApp();
        try {
            const response = await app.inject({
                method: "POST",
                url: "/v1/auth",
                payload: {
                    publicKey: privacyKit.encodeBase64(new Uint8Array(keyPair.publicKey)),
                    challenge: privacyKit.encodeBase64(challengeBytes),
                    signature: privacyKit.encodeBase64(new Uint8Array(nacl.sign.detached(challengeBytes, keyPair.secretKey))),
                },
            });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ success: true, token: "token-1" });
        } finally {
            await app.close();
        }
    });

    it("refuses a login request whose public key is not base64", async () => {
        const app = await buildApp();
        try {
            const response = await app.inject({
                method: "POST",
                url: "/v1/auth/request",
                payload: { publicKey: "not base64 !!!" },
            });
            expect(response.statusCode).toBe(401);
        } finally {
            await app.close();
        }
    });

    it("reports a login-request status of not_found for a public key that is not base64", async () => {
        const app = await buildApp();
        try {
            const response = await app.inject({
                method: "GET",
                url: "/v1/auth/request/status?publicKey=not%20base64%20!!!",
            });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ status: "not_found", supportsV2: false });
        } finally {
            await app.close();
        }
    });

    it("refuses an account login request whose public key is not base64", async () => {
        const app = await buildApp();
        try {
            const response = await app.inject({
                method: "POST",
                url: "/v1/auth/account/request",
                payload: { publicKey: "not base64 !!!" },
            });
            expect(response.statusCode).toBe(401);
        } finally {
            await app.close();
        }
    });
});
