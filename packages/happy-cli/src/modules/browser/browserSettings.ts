/**
 * Host-local browser-use switches (ENG-04).
 *
 * browser use is zero-config by default: the engine ships the MCP entry in its
 * own managed config and runs the browser headed, attaching to whatever profile
 * it resolves. These two switches are the exceptions a host may need — a headless
 * machine, or an already-running browser to attach to — so they live in the
 * daemon's settings file and are injected only when set. Unset means the daemon
 * names nothing and the engine keeps its own default.
 */

import { readSettings } from '@/persistence';

export const BROWSER_HEADLESS_ENV_VAR = 'HARNESS_BROWSER_HEADLESS';
export const BROWSER_AUTO_CONNECT_ENV_VAR = 'HARNESS_BROWSER_AUTO_CONNECT';

export interface BrowserSettings {
  headless?: boolean;
  autoConnect?: boolean;
}

/**
 * Reads the two switches. Anything that is not a boolean is ignored rather than
 * coerced, so a hand-edited settings file cannot silently turn a switch on.
 */
export async function readBrowserSettings(): Promise<BrowserSettings> {
  const settings = await readSettings();
  const browserSettings: BrowserSettings = {};
  if (typeof settings.browserHeadless === 'boolean') {
    browserSettings.headless = settings.browserHeadless;
  }
  if (typeof settings.browserAutoConnect === 'boolean') {
    browserSettings.autoConnect = settings.browserAutoConnect;
  }
  return browserSettings;
}

/**
 * Environment the engine process is started with for the given switches. A
 * switch the host never set contributes no variable at all.
 */
export function buildEngineBrowserEnv(settings: BrowserSettings): Record<string, string> {
  const env: Record<string, string> = {};
  if (settings.headless !== undefined) {
    env[BROWSER_HEADLESS_ENV_VAR] = String(settings.headless);
  }
  if (settings.autoConnect !== undefined) {
    env[BROWSER_AUTO_CONNECT_ENV_VAR] = String(settings.autoConnect);
  }
  return env;
}
