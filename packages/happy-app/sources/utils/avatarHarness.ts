/**
 * Resolve the harness identity used by a session avatar badge. There is one
 * agent and it carries no badge of its own, so nothing is badged today.
 */
export type AvatarHarnessIcon = never;

export function resolveAvatarHarness(
    _flavor?: string | null,
    _clientId?: string | null,
): AvatarHarnessIcon | null {
    return null;
}
