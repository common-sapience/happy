import { describe, expect, it } from "vitest";

import { MASTER_SECRET_ENV_VAR, MASTER_SECRET_MIN_LENGTH, requireMasterSecret } from "./masterSecret";

const VALID = "0123456789abcdef0123456789abcdef";

describe("RULE-01 — the relay refuses to start without a usable master secret", () => {
    it("returns the secret when it is long enough", () => {
        expect(requireMasterSecret({ [MASTER_SECRET_ENV_VAR]: VALID })).toBe(VALID);
    });

    it("refuses a missing secret", () => {
        expect(() => requireMasterSecret({})).toThrow(MASTER_SECRET_ENV_VAR);
    });

    it("refuses an empty secret", () => {
        expect(() => requireMasterSecret({ [MASTER_SECRET_ENV_VAR]: "" })).toThrow(MASTER_SECRET_ENV_VAR);
    });

    it("refuses a secret that is only whitespace", () => {
        expect(() => requireMasterSecret({ [MASTER_SECRET_ENV_VAR]: "   \t  \n   \t   " })).toThrow(
            MASTER_SECRET_ENV_VAR,
        );
    });

    it("refuses a secret shorter than the minimum", () => {
        const short = "a".repeat(MASTER_SECRET_MIN_LENGTH - 1);

        expect(() => requireMasterSecret({ [MASTER_SECRET_ENV_VAR]: short })).toThrow(
            String(MASTER_SECRET_MIN_LENGTH),
        );
    });

    it("never puts the secret itself in the message it throws", () => {
        try {
            requireMasterSecret({ [MASTER_SECRET_ENV_VAR]: "short-secret" });
            expect.unreachable("a short secret has to be refused");
        } catch (error) {
            expect((error as Error).message).not.toContain("short-secret");
        }
    });
});
