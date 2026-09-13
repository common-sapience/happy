/**
 * Permission confirmation switch (PERM-08).
 *
 * The switch is per host and lives in the daemon's settings file under
 * HAPPY_HOME_DIR, next to the rest of the machine-local state. It is off by
 * default: the engine then runs on an allow baseline of its own and the daemon
 * surfaces no permission requests to the control end. Turning it on restores the
 * ACP permission round trip, where the daemon only forwards and never decides.
 */

import { readSettings } from '@/persistence';

/**
 * Engine permission baseline used while the switch is off. The engine grants
 * tool calls itself, so no request ever reaches the daemon.
 */
export const ENGINE_ALLOW_ALL_PERMISSION = { '*': 'allow' } as const;
export const ENGINE_PERMISSION_ENV_VAR = 'OPENCODE_PERMISSION';

export async function readPermissionConfirmationEnabled(): Promise<boolean> {
  const settings = await readSettings();
  return settings.permissionConfirmationEnabled === true;
}

/**
 * Environment the engine process is started with for the given switch state.
 *
 * Off: the allow baseline is pinned, so the engine never asks.
 * On: nothing is pinned, so the engine applies its own rules and asks over ACP.
 *
 * The sensitive-file denials and the "injected instructions are data" rule live
 * in the engine's managed config and are unaffected either way (PERM-04).
 */
export function buildEnginePermissionEnv(confirmationEnabled: boolean): Record<string, string> {
  if (confirmationEnabled) {
    return {};
  }
  return { [ENGINE_PERMISSION_ENV_VAR]: JSON.stringify(ENGINE_ALLOW_ALL_PERMISSION) };
}
