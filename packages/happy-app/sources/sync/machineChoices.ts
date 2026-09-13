import type { NewSessionAgentType } from './persistence';
import type { Machine } from './storageTypes';
import { pairedMachineIds } from './agentSessionPlaces';
import { isMachineOnline } from '@/utils/machineUtils';
import { isHarnessAvailable } from '@/utils/harnessCatalog';
import { resolveMachineAgent } from '@/utils/newSessionAgentSelection';

/**
 * One computer, as a person picks it.
 *
 * A computer can have registered itself more than once — a daemon started from a different data
 * directory mints a new machine identity and points at its sibling. Nobody thinks of their laptop
 * that way, so the pairing is followed and the computer is offered once.
 */
export interface MachineChoice {
    /** What a draft stores: the daemon this computer is talked to through. */
    id: string;
    name: string;
    /** Every machine on this computer, for reading the places on it. */
    machineIds: string[];
    /** The daemon to talk to, which is the reachable one when several registered. */
    happyMachine: Machine | null;
    /** True when any daemon on this computer is reachable. */
    online: boolean;
    activeAt: number;
}

export function getMachineName(machine: Machine): string {
    return machine.metadata?.displayName || machine.metadata?.host || 'Unknown machine';
}

/** Whichever of these is reachable, and failing that whichever was seen most recently. */
function preferLiveliest(machines: readonly Machine[]): Machine | null {
    return [...machines].sort((left, right) => (
        Number(isMachineOnline(right)) - Number(isMachineOnline(left))
        || (right.activeAt ?? 0) - (left.activeAt ?? 0)
    ))[0] ?? null;
}

/**
 * Every machine reachable from this one by following the pairing pointer, in either direction.
 *
 * Pairing has to be followed all the way out rather than one hop, because the daemons of one
 * computer are only ever connected through the machine they have in common: two Happy Agent
 * registrations naming the same Happy CLI are the same laptop, but neither names the other. Asking
 * one hop from whichever machine was seen first splits that laptop in two and puts the Happy CLI
 * machine in both halves — and since machines arrive newest first, the agents really are seen
 * before the computer they point at.
 */
function connectedMachineIds(
    start: Machine,
    machines: readonly Machine[],
    byId: ReadonlyMap<string, Machine>,
): string[] {
    const found = new Set<string>([start.id]);
    const pending = [start];
    for (let machine = pending.pop(); machine !== undefined; machine = pending.pop()) {
        for (const id of pairedMachineIds(machine, machines)) {
            const paired = byId.get(id);
            if (paired === undefined || found.has(id)) continue;
            found.add(id);
            pending.push(paired);
        }
    }
    return [...found];
}

/**
 * The computers behind the machines, each offered once.
 *
 * A pairing is only ever the pointer Happy Agent publishes, read in both directions. Two daemons
 * that merely share a host name are left apart: they may be different accounts, different
 * containers, or the same folder opened twice, and merging them would start work in the wrong one.
 */
export function collectMachineChoices(machines: readonly Machine[]): MachineChoice[] {
    const byId = new Map(machines.map((machine) => [machine.id, machine]));
    const grouped = new Set<string>();
    const choices: MachineChoice[] = [];

    for (const machine of machines) {
        if (grouped.has(machine.id)) continue;
        const ids = connectedMachineIds(machine, machines, byId);
        for (const id of ids) grouped.add(id);
        const group = ids.map((id) => byId.get(id)!);
        // The live registration is the one to talk to, so reachability decides first and recency
        // breaks the tie; the stale ones are history and simply go unused.
        const happyMachine = preferLiveliest(group);
        choices.push({
            id: (happyMachine ?? machine).id,
            name: happyMachine ? getMachineName(happyMachine) : 'Unknown machine',
            machineIds: ids,
            happyMachine,
            online: group.some(isMachineOnline),
            activeAt: Math.max(...group.map((member) => member.activeAt ?? 0)),
        });
    }

    return choices;
}

/** The computer a stored machine id belongs to, whichever of its daemons was stored. */
export function findMachineChoice(
    choices: readonly MachineChoice[],
    machineId: string | null | undefined,
): MachineChoice | null {
    if (!machineId) return null;
    return choices.find((choice) => choice.machineIds.includes(machineId)) ?? null;
}

/**
 * Whether this computer can run the agent right now.
 *
 * A computer with no daemon cannot run the engine however much the picker would
 * like to offer it, so a missing daemon is a refusal rather than an optimistic
 * "everything is installed".
 */
export function machineChoiceAgentAvailable(
    choice: MachineChoice | null,
    agent: NewSessionAgentType,
): boolean {
    if (!choice) return false;
    const happy = choice.happyMachine;
    if (!happy) return false;
    return isHarnessAvailable({
        availability: happy.metadata?.cliAvailability,
        key: agent,
    });
}

/** Whether the Home picker should contain this harness at all. */
export function machineChoiceAgentVisible(
    _choice: MachineChoice | null,
    _agent: NewSessionAgentType,
): boolean {
    return true;
}

/**
 * The agent this computer can really run, given what the draft asked for.
 *
 * There is one agent, so this only ever resolves to it; the call sites keep
 * going through here so the picker and the send button cannot disagree.
 */
export function resolveChoiceAgent(
    _choice: MachineChoice | null,
    agent: NewSessionAgentType,
): NewSessionAgentType {
    return resolveMachineAgent(agent, null);
}

/**
 * The daemon that runs this agent on this computer.
 *
 * Null is a refusal: a computer without the daemon the agent needs is told so.
 */
export function resolveAgentMachine(
    choice: MachineChoice | null,
    _agent: NewSessionAgentType,
): Machine | null {
    if (!choice) return null;
    return choice.happyMachine;
}

/** The daemon that can create a git worktree for a new session. */
export function resolveWorktreeCreationMachine(
    choice: MachineChoice | null,
    agent: NewSessionAgentType,
    agentSupportsWorktrees: boolean,
): Machine | null {
    if (!choice) return null;
    if (!agentSupportsWorktrees) return null;
    const agentMachine = resolveAgentMachine(choice, agent);
    return agentMachine && isMachineOnline(agentMachine) ? agentMachine : null;
}
