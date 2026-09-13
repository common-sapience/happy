import { z } from 'zod';

/**
 * DESK-13, DESK-07, RULE-03: usage and balance belong to the platform.
 *
 * The control end never counts anything itself and never asks the relay, so this module has exactly
 * two ways to answer "how much have I used": read the platform's own usage endpoint, or hand the
 * user a link to the platform console. Which of the two is live is a configuration question, not a
 * product question, because whether the platform exposes a client-callable query is still open
 * (P-03) — so both paths ship and the endpoint is configured, not hardcoded.
 *
 * Configuration:
 * - `EXPO_PUBLIC_PLATFORM_USAGE_URL` — the full usage endpoint, when it is not under the gateway.
 * - `EXPO_PUBLIC_PLATFORM_GATEWAY_URL` — the gateway base; the usage endpoint is then
 *   `<base>/v1/usage`.
 * - `EXPO_PUBLIC_PLATFORM_CONSOLE_URL` — where the user reads usage when no endpoint answers.
 *
 * With no endpoint configured, or with one that fails or answers in a shape this cannot read, the
 * board degrades to the console link rather than showing a number it cannot stand behind.
 */

export const PLATFORM_USAGE_PATH = '/v1/usage';

export interface PlatformUsageConfig {
    usageUrl: string | null;
    consoleUrl: string | null;
}

function trimmed(value: string | undefined): string | null {
    const result = value?.trim();
    return result ? result : null;
}

function stripTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

export function resolvePlatformUsageConfig(
    env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): PlatformUsageConfig {
    const explicitUsageUrl = trimmed(env.EXPO_PUBLIC_PLATFORM_USAGE_URL);
    const gatewayUrl = trimmed(env.EXPO_PUBLIC_PLATFORM_GATEWAY_URL);
    return {
        usageUrl: explicitUsageUrl
            ?? (gatewayUrl ? `${stripTrailingSlash(gatewayUrl)}${PLATFORM_USAGE_PATH}` : null),
        consoleUrl: trimmed(env.EXPO_PUBLIC_PLATFORM_CONSOLE_URL),
    };
}

/**
 * What the account page can show from the platform's answer.
 *
 * Every field is optional on purpose: the platform owns the shape, and a platform that reports only
 * a balance is still worth showing. A response that carries nothing readable counts as no answer.
 */
const PlatformUsageSchema = z.object({
    balance: z.object({
        amount: z.number(),
        currency: z.string().min(1),
    }).nullish(),
    period: z.object({
        start: z.string().min(1),
        end: z.string().min(1),
    }).nullish(),
    items: z.array(z.object({
        label: z.string().min(1),
        amount: z.number(),
        unit: z.string().min(1).nullish(),
    })).nullish(),
});

export interface PlatformUsage {
    balance: { amount: number; currency: string } | null;
    period: { start: string; end: string } | null;
    items: { label: string; amount: number; unit: string | null }[];
}

/** The platform's answer, or null when there is nothing in it the board could show. */
export function parsePlatformUsage(payload: unknown): PlatformUsage | null {
    const parsed = PlatformUsageSchema.safeParse(payload);
    if (!parsed.success) return null;

    const usage: PlatformUsage = {
        balance: parsed.data.balance ?? null,
        period: parsed.data.period ?? null,
        items: (parsed.data.items ?? []).map((item) => ({
            label: item.label,
            amount: item.amount,
            unit: item.unit ?? null,
        })),
    };

    if (!usage.balance && usage.items.length === 0) return null;
    return usage;
}

export type PlatformUsageResult =
    | { state: 'usage'; usage: PlatformUsage }
    | { state: 'unavailable'; reason: 'not-configured' | 'unreadable' };

/**
 * Ask the platform for usage.
 *
 * Defensive by default: a missing endpoint, a refused request, a network failure and an
 * unrecognized body all end in the same place, because the board behaves identically for all four
 * — it shows the console link. No relay call is made on any path (RULE-03).
 */
export async function fetchPlatformUsage(
    config: PlatformUsageConfig,
    fetchImpl: typeof fetch = fetch,
): Promise<PlatformUsageResult> {
    if (!config.usageUrl) {
        return { state: 'unavailable', reason: 'not-configured' };
    }

    try {
        const response = await fetchImpl(config.usageUrl, {
            headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) {
            return { state: 'unavailable', reason: 'unreadable' };
        }
        const usage = parsePlatformUsage(await response.json());
        return usage
            ? { state: 'usage', usage }
            : { state: 'unavailable', reason: 'unreadable' };
    } catch {
        return { state: 'unavailable', reason: 'unreadable' };
    }
}
