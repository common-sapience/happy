import { execSync } from 'child_process';
import os from 'os';
import { ENGINE_AGENT_NAME, ENGINE_ACP_COMMAND } from '@/agent/acp/acpAgentConfig';

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
 * Cross-platform: uses `command -v` on POSIX, `Get-Command` on Windows.
 */
export function detectCLIAvailability(): CLIAvailability {
  const available = os.platform() === 'win32'
    ? windowsCommandExists(ENGINE_ACP_COMMAND)
    : posixCommandExists(ENGINE_ACP_COMMAND);

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
