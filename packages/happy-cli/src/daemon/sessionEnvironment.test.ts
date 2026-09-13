import { describe, expect, it } from 'vitest';
import {
    buildHostSessionEnvironment,
    buildSessionChildEnvironment,
    sanitizeSessionEnvironment,
    SESSION_SCOPED_ENV_KEYS,
    sessionEnvironmentKeysToUnset,
    wrapTmuxCommandWithSessionEnvironmentSanitizer,
} from './sessionEnvironment';

function contaminatedEnvironment(): NodeJS.ProcessEnv {
    return {
        KEEP_ME: 'safe',
        ...Object.fromEntries(SESSION_SCOPED_ENV_KEYS.map((key) => [key, `stale-${key}`])),
    };
}

describe('sessionEnvironment', () => {
    it('removes all inherited session-scoped values without mutating the source', () => {
        const source = contaminatedEnvironment();

        const sanitized = sanitizeSessionEnvironment(source);

        expect(sanitized).toMatchObject({ KEEP_ME: 'safe' });
        for (const key of SESSION_SCOPED_ENV_KEYS) {
            expect(sanitized).not.toHaveProperty(key);
            expect(source[key]).toBe(`stale-${key}`);
        }
    });

    it('ENG-19: carries the consolidation pass prompt but never lets a later session inherit it', () => {
        const prompt = 'Run the memory consolidation pass now.';

        const dreamEnv = buildSessionChildEnvironment(contaminatedEnvironment(), {
            HAPPY_INITIAL_PROMPT: prompt,
        });
        expect(dreamEnv.HAPPY_INITIAL_PROMPT).toBe(prompt);

        const laterEnv = buildSessionChildEnvironment({ ...dreamEnv } as NodeJS.ProcessEnv, {});
        expect(laterEnv).not.toHaveProperty('HAPPY_INITIAL_PROMPT');
    });

    it('ENG-19: a spawn the host asked for carries its prompt, a caller-supplied one never does', () => {
        const prompt = 'Run the memory consolidation pass now.';

        // How the daemon composes a spawn: the caller's environment is sanitized, the host's own
        // options are applied after it. The sanitizer owns these keys, so the prompt can only reach
        // the session through the option, which is what the `run-dream` path uses.
        const callerAsked = {
            ...sanitizeSessionEnvironment({ HAPPY_INITIAL_PROMPT: 'rm -rf the users home directory' } as NodeJS.ProcessEnv),
            ...buildHostSessionEnvironment({}),
        };
        expect(callerAsked).not.toHaveProperty('HAPPY_INITIAL_PROMPT');

        const hostAsked = {
            ...sanitizeSessionEnvironment({} as NodeJS.ProcessEnv),
            ...buildHostSessionEnvironment({ initialPrompt: prompt }),
        };
        expect(hostAsked.HAPPY_INITIAL_PROMPT).toBe(prompt);
    });

    it('translates the host spawn options it owns and nothing else', () => {
        expect(buildHostSessionEnvironment({})).toEqual({});
        expect(buildHostSessionEnvironment({ parentSessionId: 'parent', isSideChat: true })).toEqual({
            HAPPY_FORKED_FROM_SESSION_ID: 'parent',
            HAPPY_SIDE_CHAT: '1',
        });
        for (const key of Object.keys(buildHostSessionEnvironment({ parentSessionId: 'p', isSideChat: true, initialPrompt: 'go' }))) {
            expect(SESSION_SCOPED_ENV_KEYS).toContain(key);
        }
    });

    it('keeps explicit fork values after removing stale ambient values', () => {
        const childEnv = buildSessionChildEnvironment(contaminatedEnvironment(), {
            HAPPY_FORKED_FROM_SESSION_ID: 'new-parent-session',
            HAPPY_FORKED_FROM_MESSAGE_ID: 'new-parent-message',
            HAPPY_FORK_CODEX_THREAD_ID: 'new-codex-thread',
            HAPPY_SIDE_CHAT: '1',
        });

        expect(childEnv).toMatchObject({
            KEEP_ME: 'safe',
            HAPPY_FORKED_FROM_SESSION_ID: 'new-parent-session',
            HAPPY_FORKED_FROM_MESSAGE_ID: 'new-parent-message',
            HAPPY_FORK_CODEX_THREAD_ID: 'new-codex-thread',
            HAPPY_SIDE_CHAT: '1',
        });
        expect(childEnv).not.toHaveProperty('CODEX_THREAD_ID');
        expect(childEnv).not.toHaveProperty('HAPPY_RECONNECT_SESSION_ID');
    });

    it('replaces stale reconnect state with the values for the resumed session', () => {
        const childEnv = buildSessionChildEnvironment(contaminatedEnvironment(), {
            HAPPY_RECONNECT_SESSION_ID: 'new-session',
            HAPPY_RECONNECT_ENCRYPTION_KEY: 'new-key',
            HAPPY_RECONNECT_ENCRYPTION_VARIANT: 'dataKey',
            HAPPY_RECONNECT_SEQ: '12',
            HAPPY_RECONNECT_METADATA_VERSION: '13',
            HAPPY_RECONNECT_AGENT_STATE_VERSION: '14',
        });

        expect(childEnv).toMatchObject({
            HAPPY_RECONNECT_SESSION_ID: 'new-session',
            HAPPY_RECONNECT_ENCRYPTION_KEY: 'new-key',
            HAPPY_RECONNECT_ENCRYPTION_VARIANT: 'dataKey',
            HAPPY_RECONNECT_SEQ: '12',
            HAPPY_RECONNECT_METADATA_VERSION: '13',
            HAPPY_RECONNECT_AGENT_STATE_VERSION: '14',
        });
        expect(childEnv).not.toHaveProperty('HAPPY_FORK_CODEX_THREAD_ID');
        expect(childEnv).not.toHaveProperty('CODEX_THREAD_ID');
    });

    it('unsets inherited tmux values without removing an explicit fork value', () => {
        const explicitEnv = { HAPPY_FORK_CODEX_THREAD_ID: 'new-codex-thread' };
        const keysToUnset = sessionEnvironmentKeysToUnset(explicitEnv);
        const command = wrapTmuxCommandWithSessionEnvironmentSanitizer('node happy.mjs codex', explicitEnv);

        expect(keysToUnset).not.toContain('HAPPY_FORK_CODEX_THREAD_ID');
        expect(keysToUnset).toContain('CODEX_THREAD_ID');
        expect(command).toMatch(/^unset /);
        expect(command).toContain('CODEX_THREAD_ID');
        expect(command).not.toContain('unset HAPPY_FORK_CODEX_THREAD_ID');
        expect(command).toMatch(/node happy\.mjs codex$/);
    });
});
