# Happy

Control an AI agent on your computer from your phone, browser, or terminal.

Free. Open source.

## Installation

```bash
npm install -g happy
```

> Migrated from the `happy-coder` package. Thanks to [@franciscop](https://github.com/franciscop) for donating the `happy` package name!

## Usage

```bash
happy
```

This will:
1. Start an agent session backed by the engine (`opencode` over ACP)
2. Display a QR code to connect from your mobile device or browser
3. Allow real-time session control — all communication is end-to-end encrypted
4. Start new sessions directly from your phone or web while your computer is online

### Agent profiles

An agent's tools, skills, prompt and model are defined by an engine agent
profile. Pick one per session:

```bash
happy --agent-profile research
```

### Pointing at a specific engine build

```bash
happy acp -- /opt/engine/opencode acp
```

## Daemon

The daemon is a background service that stays running on your machine. It lets you spawn and manage sessions remotely — from your phone or the web app — without needing an open terminal.

```bash
happy daemon start
happy daemon stop
happy daemon status
happy daemon list
```

The daemon starts automatically when you run `happy`, so you usually don't need to manage it manually.

### Keeping the daemon running across reboots

If you want the daemon to come back automatically after a reboot — without opening a `happy` session first — start it from your shell profile so it inherits your normal user session context (PATH, keychain access, credentials):

```bash
# ~/.zshrc or ~/.bashrc
if [[ -o interactive ]] && [[ -z "$HAPPY_DAEMON_CHECKED" ]]; then
    export HAPPY_DAEMON_CHECKED=1
    () {
        local state=$HOME/.happy/daemon.state.json
        local pid=$(grep -oE '"pid"[[:space:]]*:[[:space:]]*[0-9]+' "$state" 2>/dev/null | grep -oE '[0-9]+')
        if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
            happy daemon start >/dev/null 2>&1
        fi
    } &!
fi
```

The first interactive shell after a reboot triggers the start; subsequent shells short-circuit because the daemon is already running.

> **macOS users:** prefer this shell-init approach over a `launchd` LaunchAgent. A LaunchAgent runs in an agent domain detached from your GUI/Aqua login session, so the daemon cannot reach the macOS keychain.

## Authentication

```bash
happy auth login
happy auth logout
```

Happy uses cryptographic key pairs for authentication — your private key stays on your machine. All session data is end-to-end encrypted before leaving your device.

## Permission confirmation

Off by default: the engine runs on an allow baseline and a multi-step task needs
zero confirmations. Turn it on per host by setting
`permissionConfirmationEnabled` to `true` in `$HAPPY_HOME_DIR/settings.json`, and
every confirm-worthy tool call then waits for an answer from a paired control
end.

## Engine credentials

`$HAPPY_HOME_DIR/engine-credentials.json` (mode 0600) is the only place the
engine's secrets live on this machine:

```json
{
  "platformApiKey": "...",
  "connectors": {
    "gmail": { "command": "gmail-mcp", "args": ["--stdio"], "env": { "GMAIL_TOKEN": "..." } }
  }
}
```

The platform key reaches the engine process as `MODEL_API_KEY`; each connector
becomes an MCP server carrying its own secret. Nothing is written out as a
plaintext engine config.

## Commands

| Command | Description |
|---------|-------------|
| `happy` | Start an agent session |
| `happy acp` | Same, with explicit ACP options |
| `happy auth` | Manage authentication |
| `happy server` | Manage the self-hosted relay |
| `happy daemon` | Manage the background service |
| `happy notify` | Send push notification to your devices |
| `happy doctor` | Diagnostics & troubleshooting |

---

## Advanced

### Environment Variables

| Variable | Description |
|----------|-------------|
| `HAPPY_SERVER_URL` | Relay address. Required: no address is built in, and the daemon refuses to start without one |
| `HAPPY_WEBAPP_URL` | Controller address the terminal auth flow opens. Without it, terminal auth reports that there is no page to open |
| `HAPPY_HOME_DIR` | Custom home directory for Happy data (default: `~/.happy`) |
| `HAPPY_DISABLE_CAFFEINATE` | Disable macOS sleep prevention |
| `HAPPY_EXPERIMENTAL` | Enable experimental features |

### Building from source

```bash
git clone https://github.com/common-sapience/happy
cd happy/packages/happy-cli
pnpm install
pnpm build
```

## Requirements

- Node.js >= 20.0.0
- The engine (`opencode`) available on PATH, or started through `happy acp -- <path> acp`

## License

MIT
