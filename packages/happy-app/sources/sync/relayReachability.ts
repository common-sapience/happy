/**
 * What the agent list shows when its first load never comes back (DESK-08, DESK-21).
 *
 * A relay address is entered once and then kept, and so is the account token, so
 * both outlive the thing they name: the server behind the address is taken down,
 * or the account on it is gone. The first load then fails behind a retry that
 * never gives up, nothing ever marks the data ready, and the list sits on its
 * spinner with nothing on screen saying why or offering a way out.
 *
 * So the wait is bounded. Past it the list says which of the two happened and
 * offers the only two things that change it — name another relay, or sign out.
 * Nothing here decides how long to wait on its own: the caller reports the stall,
 * and a load that arrives late still wins, so a relay that comes back clears the
 * message without a restart.
 */

/** `rejected`: the relay answered and would not serve this account. `unreachable`: nothing answered. */
export type RelayFailure = 'unreachable' | 'rejected';

export type AgentListBoot =
    | { state: 'loading' }
    | { state: 'ready' }
    | { state: 'stalled'; failure: RelayFailure };

/**
 * Long enough for a slow relay on a slow link to finish the first load, short
 * enough that nobody reads the spinner as a hang.
 */
export const RELAY_FIRST_LOAD_PATIENCE_MS = 15_000;

/** The status the relay answered with, as the sessions fetch reports it, or null if it never answered. */
function answeredStatus(error: unknown): number | null {
    if (!(error instanceof Error)) {
        return null;
    }
    const match = /:\s*(\d{3})\s*$/.exec(error.message);
    if (!match) {
        return null;
    }
    const status = Number(match[1]);
    return status >= 100 && status <= 599 ? status : null;
}

/**
 * An answer of any kind means the address reaches a relay and the account is the
 * problem; silence means the address is. Both states offer both ways out, so the
 * split only decides which one is named first.
 */
export function classifyRelayFailure(error: unknown): RelayFailure {
    return answeredStatus(error) === null ? 'unreachable' : 'rejected';
}

export function resolveAgentListBoot({ dataReady, stalledOn }: {
    dataReady: boolean;
    stalledOn: RelayFailure | null;
}): AgentListBoot {
    if (dataReady) {
        return { state: 'ready' };
    }
    if (stalledOn) {
        return { state: 'stalled', failure: stalledOn };
    }
    return { state: 'loading' };
}
