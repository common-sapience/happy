import { execSync } from 'child_process';
import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import os from 'os';
import { ENGINE_AGENT_NAME, resolveEngineCommand } from '@/agent/acp/acpAgentConfig';

/**
 * The engine is the only agent this daemon can start (HOST-10), so the machine
 * capability report carries exactly one flag.
 */
export interface CLIAvailability {
  opencode: boolean;
  detectedAt: number;
}

/**
 * Detects whether the engine is available on this machine.
 *
 * A resolved absolute path comes from the desktop install or an explicit
 * override, so its existence is the answer; a bare name has to be looked up the
 * way a shell would. Cross-platform: `command -v` on POSIX, `Get-Command` on
 * Windows.
 */
export function detectCLIAvailability(): CLIAvailability {
  const command = resolveEngineCommand();
  const available = isAbsolute(command)
    ? existsSync(command)
    : os.platform() === 'win32'
      ? windowsCommandExists(command)
      : posixCommandExists(command);

  return { [ENGINE_AGENT_NAME]: available, detectedAt: Date.now() };
}

function posixCommandExists(command: string): boolean {
  try {
    execSync(`command -v ${command} >/dev/null 2>&1`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function windowsCommandExists(command: string): boolean {
  try {
    execSync(`powershell -NoProfile -Command "Get-Command ${command} -ErrorAction SilentlyContinue"`, { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}
