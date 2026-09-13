import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, RELAY_NOT_CONFIGURED_MESSAGE } from './config';

describe('config', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        delete process.env.HAPPY_SERVER_URL;
        delete process.env.HAPPY_HOME_DIR;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('defaults', () => {
        it('refuses to run without a relay address instead of picking one', () => {
            expect(() => loadConfig()).toThrow(RELAY_NOT_CONFIGURED_MESSAGE);
        });

        it('uses default home directory', () => {
            process.env.HAPPY_SERVER_URL = 'https://relay.example.test';
            const config = loadConfig();
            expect(config.homeDir).toBe(join(homedir(), '.happy'));
        });

        it('derives credential path from home directory', () => {
            process.env.HAPPY_SERVER_URL = 'https://relay.example.test';
            const config = loadConfig();
            expect(config.credentialPath).toBe(join(homedir(), '.happy', 'agent.key'));
        });
    });

    describe('env var overrides', () => {
        it('overrides server URL with HAPPY_SERVER_URL', () => {
            process.env.HAPPY_SERVER_URL = 'https://custom-server.example.com';
            const config = loadConfig();
            expect(config.serverUrl).toBe('https://custom-server.example.com');
        });

        it('overrides home directory with HAPPY_HOME_DIR', () => {
            process.env.HAPPY_SERVER_URL = 'https://relay.example.test';
            process.env.HAPPY_HOME_DIR = '/tmp/custom-happy';
            const config = loadConfig();
            expect(config.homeDir).toBe('/tmp/custom-happy');
        });

        it('derives credential path from overridden home directory', () => {
            process.env.HAPPY_SERVER_URL = 'https://relay.example.test';
            process.env.HAPPY_HOME_DIR = '/tmp/custom-happy';
            const config = loadConfig();
            expect(config.credentialPath).toBe('/tmp/custom-happy/agent.key');
        });

        it('allows both overrides simultaneously', () => {
            process.env.HAPPY_SERVER_URL = 'https://other.example.com';
            process.env.HAPPY_HOME_DIR = '/opt/happy';
            const config = loadConfig();
            expect(config.serverUrl).toBe('https://other.example.com');
            expect(config.homeDir).toBe('/opt/happy');
            expect(config.credentialPath).toBe('/opt/happy/agent.key');
        });
    });
});
