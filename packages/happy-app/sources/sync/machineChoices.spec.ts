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

const CLI = 'cli-machine';
const RIG = 'rig-machine';

function cli(id = CLI, options?: { active?: boolean; activeAt?: number }) {
    return machine(id, {
        host: 'laptop.local',
        cliAvailability: { claude: true, codex: true, gemini: false, openclaw: false },
    }, options);
}

function rig(id = RIG, sibling = CLI, options?: { active?: boolean; activeAt?: number }) {
    return machine(id, {
        host: 'laptop.local',
        displayName: 'laptop.local — Happy Agent',
        machineKind: 'rig',
        rigOnly: true,
        siblingMachineId: sibling,
        capabilities: { newSession: true },
    }, options);
}

describe('offering one computer rather than one daemon', () => {
    it('collapses a Happy CLI and Happy Agent pair into a single choice', () => {
        const choices = collectMachineChoices([cli(), rig()]);
        expect(choices).toHaveLength(1);
        expect(choices[0].machineIds.sort()).toEqual([CLI, RIG].sort());
    });

    it('names the computer by its host, dropping the Happy Agent suffix', () => {
        expect(collectMachineChoices([cli(), rig()])[0].name).toBe('laptop.local');
    });

    it('stores the Happy CLI machine id, which is what older drafts already hold', () => {
        expect(collectMachineChoices([cli(), rig()])[0].id).toBe(CLI);
    });

    it('leaves two unpaired computers apart even when they share a host name', () => {
        const choices = collectMachineChoices([cli('one'), cli('two')]);
        expect(choices).toHaveLength(2);
    });

    it('offers a Happy Agent with no Happy CLI beside it, under its own host name', () => {
        const choices = collectMachineChoices([rig(RIG, 'missing-sibling')]);
        expect(choices).toHaveLength(1);
        expect(choices[0].name).toBe('laptop.local');
        expect(choices[0].id).toBe(RIG);
    });

    it('finds the computer from either of its machine ids', () => {
        const choices = collectMachineChoices([cli(), rig()]);
        expect(findMachineChoice(choices, RIG)?.id).toBe(CLI);
        expect(findMachineChoice(choices, CLI)?.id).toBe(CLI);
    });
});

describe('choosing between several Happy Agent registrations on one computer', () => {
    // A daemon started from another data directory mints a new machine and claims the same
    // sibling, so one computer can carry a live registration and several dead ones.
    const stale = rig('stale-rig', CLI, { active: false, activeAt: 500 });
    const live = rig('live-rig', CLI, { active: true, activeAt: 100 });
    const recent = rig('recent-rig', CLI, { active: false, activeAt: 900 });

    it('talks to the one that is reachable', () => {
        const choice = collectMachineChoices([cli(), stale, live, recent])[0];
        expect(choice.rigMachine?.id).toBe('live-rig');
    });

    it('falls back to the most recently seen when none are reachable', () => {
        const choice = collectMachineChoices([cli(), stale, recent])[0];
        expect(choice.rigMachine?.id).toBe('recent-rig');
    });

    // Machines arrive newest first, and a Happy Agent registration is younger than the Happy CLI
    // it points at, so in practice every agent is seen before the computer they have in common.
    it('is one computer even when the agents are seen before what they point at', () => {
        const choices = collectMachineChoices([recent, stale, cli()]);

        expect(choices).toHaveLength(1);
        expect(choices[0].machineIds).toHaveLength(3);
        expect(choices[0].happyMachine?.id).toBe(CLI);
    });

    it('never lets one machine belong to two computers', () => {
        const seen = new Set<string>();
        for (const choice of collectMachineChoices([recent, stale, cli()])) {
            for (const id of choice.machineIds) {
                expect(seen.has(id)).toBe(false);
                seen.add(id);
            }
        }
    });
});

describe('what a computer can actually run', () => {
    it('offers the engine wherever a daemon is registered', () => {
        const choice = collectMachineChoices([cli()])[0];
        expect(machineChoiceAgentAvailable(choice, ENGINE_AGENT)).toBe(true);
    });

    it('refuses the engine on a computer that registers no daemon', () => {
        const choice = collectMachineChoices([rig(RIG, 'missing-sibling')])[0];
        expect(machineChoiceAgentAvailable(choice, ENGINE_AGENT)).toBe(false);
    });

    it('believes a daemon that reports no capability list', () => {
        const choice = collectMachineChoices([machine('bare', { host: 'old.local' })])[0];
        expect(machineChoiceAgentAvailable(choice, ENGINE_AGENT)).toBe(true);
    });

    it('keeps a stale draft pointed at the one agent there is', () => {
        const choice = collectMachineChoices([cli()])[0];
        expect(resolveChoiceAgent(choice, ENGINE_AGENT)).toBe(ENGINE_AGENT);
    });

    it('sends the engine to the daemon that runs it', () => {
        const choice = collectMachineChoices([cli(), rig()])[0];
        expect(resolveAgentMachine(choice, ENGINE_AGENT)?.id).toBe(CLI);
    });

    it('reports no daemon rather than handing the request to the wrong one', () => {
        const rigOnly = collectMachineChoices([rig(RIG, 'missing-sibling')])[0];
        expect(resolveAgentMachine(rigOnly, ENGINE_AGENT)).toBeNull();
    });
});

describe('choosing where to create a worktree', () => {
    it('uses the daemon machine when the agent supports worktrees', () => {
        const choice = collectMachineChoices([cli()])[0];
        expect(resolveWorktreeCreationMachine(choice, ENGINE_AGENT, true)?.id).toBe(CLI);
    });

    it('refuses when the agent does not support worktrees', () => {
        const choice = collectMachineChoices([cli()])[0];
        expect(resolveWorktreeCreationMachine(choice, ENGINE_AGENT, false)).toBeNull();
    });

    it('does not offer an offline daemon', () => {
        const choice = collectMachineChoices([cli(CLI, { active: false })])[0];
        expect(resolveWorktreeCreationMachine(choice, ENGINE_AGENT, true)).toBeNull();
    });
});

describe('a computer that is asleep', () => {
    // Its projects have not moved, so it stays pickable.
    const offline = collectMachineChoices([
        cli(CLI, { active: false, activeAt: 10 }),
        rig(RIG, CLI, { active: false, activeAt: 20 }),
    ])[0];

    it('is still offered, marked by when it was last seen', () => {
        expect(offline.online).toBe(false);
        expect(offline.activeAt).toBe(20);
    });

    it('still offers the engine, which the send path refuses later with a reason', () => {
        expect(machineChoiceAgentAvailable(offline, ENGINE_AGENT)).toBe(true);
        expect(resolveAgentMachine(offline, ENGINE_AGENT)?.id).toBe(CLI);
    });
});
