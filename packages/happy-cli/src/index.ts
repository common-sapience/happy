#!/usr/bin/env node

/**
 * CLI entry point for happy command
 *
 * Simple argument parsing without any CLI framework dependencies.
 * The engine is the only agent (HOST-10): `happy` and `happy acp` both start an
 * engine session over ACP, and no other agent has an entry point here.
 */


import chalk from 'chalk'
import { logger } from './ui/logger'
import { readCredentials } from './persistence'
import { authAndSetupMachineIfNeeded } from './ui/auth'
import packageJson from '../package.json'
import { startDaemon } from './daemon/run'
import { checkIfDaemonRunningAndCleanupStaleState, stopDaemon } from './daemon/controlClient'
import { getLatestDaemonLog } from './ui/logger'
import { killRunawayHappyProcesses } from './daemon/doctor'
import { install } from './daemon/install'
import { uninstall } from './daemon/uninstall'
import { ApiClient } from './api/api'
import { runDoctorCommand, runDoctorDaemon } from './ui/doctor'
import { listDaemonSessions, stopDaemonSession } from './daemon/controlClient'
import { handleAuthCommand } from './commands/auth'
import { handleServerCommand } from './commands/server'
import { spawnHappyCLI } from './utils/spawnHappyCLI'
import { ensureDaemonRunning } from './daemon/ensureDaemonRunning'
import { sanitizeSessionEnvironment } from './daemon/sessionEnvironment'
import { AGENT_PROFILE_FLAG } from './daemon/engineLaunch'

/**
 * Starts an engine session over ACP. Shared by `happy acp ...` and the
 * no-subcommand entry point.
 */
async function startEngineSession(engineArgs: string[]): Promise<void> {
  const { runAcp, resolveAcpAgentConfig } = await import('@/agent/acp');

  let startedBy: 'daemon' | 'terminal' | undefined = undefined;
  let verbose = false;
  let agentProfile: string | undefined = undefined;
  const acpArgs: string[] = [];
  let customCommandMode = false;
  for (let i = 0; i < engineArgs.length; i++) {
    if (!customCommandMode && engineArgs[i] === '--started-by') {
      startedBy = engineArgs[++i] as 'daemon' | 'terminal';
      continue;
    }
    if (!customCommandMode && engineArgs[i] === '--verbose') {
      verbose = true;
      continue;
    }
    if (!customCommandMode && engineArgs[i] === AGENT_PROFILE_FLAG) {
      agentProfile = engineArgs[++i];
      continue;
    }
    if (engineArgs[i] === '--') {
      customCommandMode = true;
    }
    acpArgs.push(engineArgs[i]);
  }

  const resolved = resolveAcpAgentConfig(acpArgs);
  const { credentials } = await authAndSetupMachineIfNeeded();
  await ensureDaemonRunning()

  await runAcp({
    credentials,
    startedBy,
    verbose,
    agentProfile,
    agentName: resolved.agentName,
    command: resolved.command,
    args: resolved.args,
  });
}

function reportCommandError(error: unknown): never {
  console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
  if (process.env.DEBUG) {
    console.error(error)
  }
  process.exit(1)
}

const HELP_TEXT = `
${chalk.bold('happy')} - your agents, wherever you are

${chalk.bold('Usage:')}
  happy [options]         Start an agent session on this computer
  happy acp [options]     Same, with explicit ACP options
  happy auth              Manage authentication
  happy server            Manage the self-hosted relay
  happy notify            Send push notification
  happy daemon            Manage the background service that spawns sessions
                            away from your computer
  happy doctor            System diagnostics & troubleshooting

${chalk.bold('Session options:')}
  ${AGENT_PROFILE_FLAG} <name>  Run the session under this engine agent profile
  --verbose               Print raw ACP backend/envelope events
  --started-by <who>      daemon or terminal (set by the daemon)
  -- <command> [args]     Start a specific engine build instead of the one on PATH

${chalk.bold('Examples:')}
  happy                            Start a session
  happy ${AGENT_PROFILE_FLAG} research    Start a session under the 'research' profile
  happy acp --verbose              Start a session with raw ACP logging
  happy auth login --force         Authenticate
  happy doctor                     Run diagnostics
`

;(async () => {
  const args = process.argv.slice(2)

  // If --version is passed - do not log, its likely daemon inquiring about our version
  if (!args.includes('--version')) {
    logger.debug('Starting happy CLI with args: ', process.argv)
  }

  // Check if first argument is a subcommand
  const subcommand = args[0]

  if (subcommand === 'doctor') {
    // Check for clean subcommand
    if (args[1] === 'clean') {
      if (args.slice(2).some(a => a === '--help' || a === '-h')) {
        console.log(`
${chalk.bold('happy doctor clean')} - Kill all happy-related processes (daemon + sessions)

${chalk.bold('Usage:')}
  happy doctor clean

${chalk.bold('Warning:')} This is destructive — it terminates the daemon and every running session.
Conversation history is preserved on the server, but in-flight tool calls are interrupted.
`)
        process.exit(0)
      }
      const result = await killRunawayHappyProcesses()
      console.log(`Cleaned up ${result.killed} runaway processes`)
      if (result.errors.length > 0) {
        console.log('Errors:', result.errors)
      }
      process.exit(0)
    }
    await runDoctorCommand();
    return;
  } else if (subcommand === 'auth') {
    try {
      await handleAuthCommand(args.slice(1));
    } catch (error) {
      reportCommandError(error)
    }
    return;
  } else if (subcommand === 'server') {
    try {
      await handleServerCommand(args.slice(1));
    } catch (error) {
      reportCommandError(error)
    }
    return;
  } else if (subcommand === 'bye') {
    console.log('Bye!');
    process.exit(0);
  } else if (subcommand === 'acp') {
    try {
      await startEngineSession(args.slice(1));
    } catch (error) {
      reportCommandError(error)
    }
    return;
  } else if (subcommand === 'logout') {
    // Keep for backward compatibility - redirect to auth logout
    console.log(chalk.yellow('Note: "happy logout" is deprecated. Use "happy auth logout" instead.\n'));
    try {
      await handleAuthCommand(['logout']);
    } catch (error) {
      reportCommandError(error)
    }
    return;
  } else if (subcommand === 'notify') {
    try {
      await handleNotifyCommand(args.slice(1));
    } catch (error) {
      reportCommandError(error)
    }
    return;
  } else if (subcommand === 'daemon') {
    // Show daemon management help
    const daemonSubcommand = args[1]

    if (daemonSubcommand === 'list') {
      try {
        const sessions = await listDaemonSessions()

        if (sessions.length === 0) {
          console.log('No active sessions this daemon is aware of (they might have been started by a previous version of the daemon)')
        } else {
          console.log('Active sessions:')
          console.log(JSON.stringify(sessions, null, 2))
        }
      } catch (error) {
        console.log('No daemon running')
      }
      return

    } else if (daemonSubcommand === 'stop-session') {
      const sessionId = args[2]
      if (!sessionId) {
        console.error('Session ID required')
        process.exit(1)
      }

      try {
        const success = await stopDaemonSession(sessionId)
        console.log(success ? 'Session stopped' : 'Failed to stop session')
      } catch (error) {
        console.log('No daemon running')
      }
      return

    } else if (daemonSubcommand === 'start') {
      // Spawn detached daemon process
      const child = spawnHappyCLI(['daemon', 'start-sync'], {
        detached: true,
        stdio: 'ignore',
        env: sanitizeSessionEnvironment(process.env)
      });
      child.unref();

      // Wait for daemon to write state file (up to 5 seconds)
      let started = false;
      for (let i = 0; i < 50; i++) {
        if (await checkIfDaemonRunningAndCleanupStaleState()) {
          started = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (started) {
        console.log('Daemon started successfully');
      } else {
        console.error('Failed to start daemon');
        process.exit(1);
      }
      process.exit(0);
    } else if (daemonSubcommand === 'start-sync') {
      await startDaemon()
      process.exit(0)
    } else if (daemonSubcommand === 'stop') {
      await stopDaemon()
      process.exit(0)
    } else if (daemonSubcommand === 'status') {
      await runDoctorDaemon()
      process.exit(0)
    } else if (daemonSubcommand === 'logs') {
      // Simply print the path to the latest daemon log file
      const latest = await getLatestDaemonLog()
      if (!latest) {
        console.log('No daemon logs found')
      } else {
        console.log(latest.path)
      }
      process.exit(0)
    } else if (daemonSubcommand === 'install') {
      try {
        await install()
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
        process.exit(1)
      }
    } else if (daemonSubcommand === 'uninstall') {
      try {
        await uninstall()
      } catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
        process.exit(1)
      }
    } else {
      console.log(`
${chalk.bold('happy daemon')} - Daemon management

${chalk.bold('Usage:')}
  happy daemon start              Start the daemon (detached)
  happy daemon stop               Stop the daemon (sessions stay alive)
  happy daemon status             Show daemon status
  happy daemon list               List active sessions

  If you want to kill all happy related processes run
  ${chalk.cyan('happy doctor clean')}

${chalk.bold('Note:')} The daemon runs in the background and manages agent sessions.

${chalk.bold('To clean up runaway processes:')} Use ${chalk.cyan('happy doctor clean')}
`)
    }
    return;
  } else {
    // No subcommand: start an engine session.
    if (args.some(arg => arg === '-h' || arg === '--help')) {
      console.log(HELP_TEXT)
      process.exit(0)
    }
    if (args.some(arg => arg === '-v' || arg === '--version')) {
      console.log(`happy version: ${packageJson.version}`)
      process.exit(0)
    }

    try {
      await startEngineSession(args);
    } catch (error) {
      reportCommandError(error)
    }
  }
})();


/**
 * Handle notification command
 */
async function handleNotifyCommand(args: string[]): Promise<void> {
  let message = ''
  let title = ''
  let showHelp = false

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '-p' && i + 1 < args.length) {
      message = args[++i]
    } else if (arg === '-t' && i + 1 < args.length) {
      title = args[++i]
    } else if (arg === '-h' || arg === '--help') {
      showHelp = true
    } else {
      console.error(chalk.red(`Unknown argument for notify command: ${arg}`))
      process.exit(1)
    }
  }

  if (showHelp) {
    console.log(`
${chalk.bold('happy notify')} - Send notification

${chalk.bold('Usage:')}
  happy notify -p <message> [-t <title>]    Send notification with custom message and optional title
  happy notify -h, --help                   Show this help

${chalk.bold('Options:')}
  -p <message>    Notification message (required)
  -t <title>      Notification title (optional, defaults to "Happy")

${chalk.bold('Examples:')}
  happy notify -p "Deployment complete!"
  happy notify -p "System update complete" -t "Server Status"
  happy notify -t "Alert" -p "Database connection restored"
`)
    return
  }

  if (!message) {
    console.error(chalk.red('Error: Message is required. Use -p "your message" to specify the notification text.'))
    console.log(chalk.gray('Run "happy notify --help" for usage information.'))
    process.exit(1)
  }

  // Load credentials
  let credentials = await readCredentials()
  if (!credentials) {
    console.error(chalk.red('Error: Not authenticated. Please run "happy auth login" first.'))
    process.exit(1)
  }

  console.log(chalk.blue('📱 Sending push notification...'))

  try {
    // Create API client and send push notification
    const api = await ApiClient.create(credentials);

    // Use custom title or default to "Happy"
    const notificationTitle = title || 'Happy'

    // Send the push notification
    api.push().sendToAllDevices(
      notificationTitle,
      message,
      {
        source: 'cli',
        timestamp: Date.now()
      }
    )

    console.log(chalk.green('✓ Push notification sent successfully!'))
    console.log(chalk.gray(`  Title: ${notificationTitle}`))
    console.log(chalk.gray(`  Message: ${message}`))
    console.log(chalk.gray('  Check your mobile device for the notification.'))

    // Give a moment for the async operation to start
    await new Promise(resolve => setTimeout(resolve, 1000))

  } catch (error) {
    console.error(chalk.red('✗ Failed to send push notification'))
    throw error
  }
}
