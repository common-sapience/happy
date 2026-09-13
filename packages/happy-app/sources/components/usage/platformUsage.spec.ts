import { describe, expect, it } from 'vitest';
import {
    fetchPlatformUsage,
    parsePlatformUsage,
    resolvePlatformUsageConfig,
} from './platformUsage';

describe('DESK-13 usage comes from the platform or from a link to it', () => {
    it('uses the configured usage endpoint as given', () => {
        const config = resolvePlatformUsageConfig({
            EXPO_PUBLIC_PLATFORM_USAGE_URL: 'https://platform.example/usage',
            EXPO_PUBLIC_PLATFORM_GATEWAY_URL: 'https://gateway.example',
        });

        expect(config.usageUrl).toBe('https://platform.example/usage');
    });

    it('derives the endpoint from the gateway base when no explicit endpoint is set', () => {
        const config = resolvePlatformUsageConfig({
            EXPO_PUBLIC_PLATFORM_GATEWAY_URL: 'https://gateway.example/',
        });

        expect(config.usageUrl).toBe('https://gateway.example/v1/usage');
    });

    it('has no endpoint at all when nothing is configured', () => {
        expect(resolvePlatformUsageConfig({})).toEqual({ usageUrl: null, consoleUrl: null });
    });

    it('reads a balance and the reported items', () => {
        const usage = parsePlatformUsage({
            balance: { amount: 12.5, currency: 'USD' },
            period: { start: '2026-09-01', end: '2026-09-30' },
            items: [{ label: 'Requests', amount: 420 }],
        });

        expect(usage).toEqual({
            balance: { amount: 12.5, currency: 'USD' },
            period: { start: '2026-09-01', end: '2026-09-30' },
            items: [{ label: 'Requests', amount: 420, unit: null }],
        });
    });

    it('treats an answer with nothing showable as no answer', () => {
        expect(parsePlatformUsage({ items: [] })).toBeNull();
        expect(parsePlatformUsage({ balance: { amount: 'free' } })).toBeNull();
        expect(parsePlatformUsage(null)).toBeNull();
    });

    it('falls back to the console link when no endpoint is configured', async () => {
        const result = await fetchPlatformUsage(
            { usageUrl: null, consoleUrl: 'https://console.example' },
            async () => { throw new Error('must not be called'); },
        );

        expect(result).toEqual({ state: 'unavailable', reason: 'not-configured' });
    });

    it('falls back to the console link when the platform refuses or cannot be read', async () => {
        const refused = await fetchPlatformUsage(
            { usageUrl: 'https://platform.example/v1/usage', consoleUrl: 'https://console.example' },
            async () => new Response('nope', { status: 403 }),
        );
        expect(refused).toEqual({ state: 'unavailable', reason: 'unreadable' });

        const unreachable = await fetchPlatformUsage(
            { usageUrl: 'https://platform.example/v1/usage', consoleUrl: null },
            async () => { throw new Error('offline'); },
        );
        expect(unreachable).toEqual({ state: 'unavailable', reason: 'unreadable' });

        const gibberish = await fetchPlatformUsage(
            { usageUrl: 'https://platform.example/v1/usage', consoleUrl: null },
            async () => new Response(JSON.stringify({ spent: 'a lot' }), { status: 200 }),
        );
        expect(gibberish).toEqual({ state: 'unavailable', reason: 'unreadable' });
    });

    it('asks only the platform, never the relay', async () => {
        const asked: string[] = [];
        await fetchPlatformUsage(
            { usageUrl: 'https://platform.example/v1/usage', consoleUrl: null },
            async (input) => {
                asked.push(String(input));
                return new Response(JSON.stringify({ balance: { amount: 1, currency: 'USD' } }), { status: 200 });
            },
        );

        expect(asked).toEqual(['https://platform.example/v1/usage']);
    });
});
