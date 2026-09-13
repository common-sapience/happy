import { describe, expect, it } from 'vitest';
import {
    collectMachineChoices,
    findMachineChoice,
    machineChoiceAgentAvailable,
    resolveAgentMachine,
    resolveChoiceAgent,
    resolveWorktreeCreationMachine,
} from './machineChoices';
import { ENGINE_AGENT } from '@/utils/harnessCatalog';
import type { Machine } from './storageTypes';

function machine(
    id: string,
    metadata: Record<string, unknown>,
    options: { active?: boolean; activeAt?: number } = {},
): Machine {
    return {
        id,
        metadata,
        active: options.active ?? true,
        activeAt: options.activeAt ?? 0,
    } as unknown as Machine;
}

const PRIMARY = 'primary-machine';

function daemon(id = PRIMARY, options?: { active?: boolean; activeAt?: number }) {
    return machine(id, {
        host: 'laptop.local',
        cliAvailability: { opencode: true },
    }, options);
}

/** A second registration of the same computer, pointing at the first. */
function sibling(id: string, siblingMachineId = PRIMARY, options?: { active?: boolean; activeAt?: number }) {
    return machine(id, {
        host: 'laptop.local',
        siblingMachineId,
    }, options);
}

describe('offering one computer rather than one daemon', () => {
    it('collapses paired registrations into a single choice', () => {
        const choices = collectMachineChoices([daemon(), sibling('second')]);
        expect(choices).toHaveLength(1);
        expect(choices[0].machineIds.sort()).toEqual([PRIMARY, 'second'].sort());
    });

    it('names the computer by what the daemon publishes', () => {
        expect(collectMachineChoices([daemon()])[0].name).toBe('laptop.local');
    });

    it('leaves two unpaired computers apart even when they share a host name', () => {
        const choices = collectMachineChoices([daemon('one'), daemon('two')]);
        expect(choices).toHaveLength(2);
    });

    it('finds the computer from any of its machine ids', () => {
        const choices = collectMachineChoices([daemon(), sibling('second')]);
        expect(findMachineChoice(choices, 'second')?.machineIds).toContain(PRIMARY);
        expect(findMachineChoice(choices, PRIMARY)?.machineIds).toContain('second');
    });
});

describe('choosing between several registrations on one computer', () => {
    // A daemon started from another data directory mints a new machine and claims the same
    // sibling, so one computer can carry a live registration and several dead ones.
    const stale = sibling('stale', PRIMARY, { active: false, activeAt: 500 });
    const live = sibling('live', PRIMARY, { active: true, activeAt: 100 });
    const recent = sibling('recent', PRIMARY, { active: false, activeAt: 900 });

    it('talks to the one that is reachable', () => {
        const choice = collectMachineChoices([daemon(PRIMARY, { active: false, activeAt: 1 }), stale, live, recent])[0];
        expect(choice.happyMachine?.id).toBe('live');
    });

    it('falls back to the most recently seen when none are reachable', () => {
        const choice = collectMachineChoices([daemon(PRIMARY, { active: false, activeAt: 1 }), stale, recent])[0];
        expect(choice.happyMachine?.id).toBe('recent');
    });

    it('never lets one machine belong to two computers', () => {
        const seen = new Set<string>();
        for (const choice of collectMachineChoices([recent, stale, daemon()])) {
            for (const id of choice.machineIds) {
                expect(seen.has(id)).toBe(false);
                seen.add(id);
            }
        }
    });
});

describe('what a computer can actually run', () => {
    it('offers the engine wherever a daemon is registered', () => {
        const choice = collectMachineChoices([daemon()])[0];
        expect(machineChoiceAgentAvailable(choice, ENGINE_AGENT)).toBe(true);
    });

    it('believes a daemon that reports no capability list', () => {
        const choice = collectMachineChoices([machine('bare', { host: 'old.local' })])[0];
        expect(machineChoiceAgentAvailable(choice, ENGINE_AGENT)).toBe(true);
    });

    it('keeps a stale draft pointed at the one agent there is', () => {
        const choice = collectMachineChoices([daemon()])[0];
        expect(resolveChoiceAgent(choice, ENGINE_AGENT)).toBe(ENGINE_AGENT);
    });

    it('sends the engine to the daemon that runs it', () => {
        const choice = collectMachineChoices([daemon()])[0];
        expect(resolveAgentMachine(choice, ENGINE_AGENT)?.id).toBe(PRIMARY);
    });
});

describe('choosing where to create a worktree', () => {
    it('uses the daemon machine when worktrees are supported', () => {
        const choice = collectMachineChoices([daemon()])[0];
        expect(resolveWorktreeCreationMachine(choice, ENGINE_AGENT, true)?.id).toBe(PRIMARY);
    });

    it('refuses when worktrees are not supported', () => {
        const choice = collectMachineChoices([daemon()])[0];
        expect(resolveWorktreeCreationMachine(choice, ENGINE_AGENT, false)).toBeNull();
    });

    it('does not offer an offline daemon', () => {
        const choice = collectMachineChoices([daemon(PRIMARY, { active: false })])[0];
        expect(resolveWorktreeCreationMachine(choice, ENGINE_AGENT, true)).toBeNull();
    });
});

describe('a computer that is asleep', () => {
    // Its projects have not moved, so it stays pickable.
    const offline = collectMachineChoices([
        daemon(PRIMARY, { active: false, activeAt: 10 }),
        sibling('second', PRIMARY, { active: false, activeAt: 20 }),
    ])[0];

    it('is still offered, marked by when it was last seen', () => {
        expect(offline.online).toBe(false);
        expect(offline.activeAt).toBe(20);
    });

    it('still offers the engine, which the send path refuses later with a reason', () => {
        expect(machineChoiceAgentAvailable(offline, ENGINE_AGENT)).toBe(true);
        expect(resolveAgentMachine(offline, ENGINE_AGENT)).not.toBeNull();
    });
});
