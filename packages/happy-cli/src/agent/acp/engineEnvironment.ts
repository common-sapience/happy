/**
 * Everything the host names in the engine process's environment, in one place.
 *
 * A session's engine is started with the platform API key (HOST-09), the
 * permission baseline for the confirmation switch (PERM-08), the shared memory
 * directory (ENG-19), and the two browser switches when this host set them
 * (ENG-04). Composing them here rather than at the spawn site is what keeps the
 * set the same for every session the host starts.
 */

import type { EngineCredentials } from '@/modules/credentials/engineCredentials';
import { buildEngineCredentialEnv } from '@/modules/credentials/engineCredentials';
import { buildEnginePermissionEnv } from '@/modules/permission/permissionSwitch';
import { buildMemoryEnv } from '@/modules/memory/memoryDirectory';
import type { BrowserSettings } from '@/modules/browser/browserSettings';
import { buildEngineBrowserEnv } from '@/modules/browser/browserSettings';

export interface EngineEnvironmentInputs {
  credentials: EngineCredentials;
  permissionConfirmationEnabled: boolean;
  /** Already created by the caller, so the engine never has to create it. */
  memoryDirectory: string;
  browserSettings: BrowserSettings;
}

export function buildEngineProcessEnv(inputs: EngineEnvironmentInputs): Record<string, string> {
  return {
    ...buildEngineCredentialEnv(inputs.credentials),
    ...buildEnginePermissionEnv(inputs.permissionConfirmationEnabled),
    ...buildMemoryEnv(inputs.memoryDirectory),
    ...buildEngineBrowserEnv(inputs.browserSettings),
  };
}
