# Happy CLI Codebase Overview

## Project Overview

Happy CLI is the daemon that runs on the user's computer: it starts the agent
engine, translates the engine's ACP traffic into the control-plane protocol, and
keeps an outbound connection to the relay. It is part of a three-component
system:

1. **happy-cli** (this package) - daemon and session runner
2. **happy-app** - control end (mobile, web, Tauri desktop shell)
3. **happy-server** - relay

The engine (`opencode`, driven over ACP) is the only agent. There is no other
agent backend, no provider login, and no agent-type branching anywhere in this
package (HOST-10).

## Code Style Preferences

### TypeScript Conventions
- **Strict typing**: No untyped code ("I despise untyped code")
- **Clean function signatures**: Explicit parameter and return types
- **As little as possible classes**
- **Comprehensive JSDoc comments**: Each file includes header comments explaining responsibilities.
- **Import style**: Uses `@/` alias for src imports, e.g., `import { logger } from '@/ui/logger'`
- **File extensions**: Uses `.ts` for TypeScript files
- **Export style**: Named exports preferred, with occasional default exports for main functions

### DO NOT

- Create stupid small functions / getters / setters
- Excessive use of `if` statements - especially if you can avoid control flow changes with a better design
- **NEVER import modules mid-code** - ALL imports must be at the top of the file

### Error Handling
- Graceful error handling with proper error messages
- Use of `try-catch` blocks with specific error logging
- Abort controllers for cancellable operations
- Careful handling of process lifecycle and cleanup
- Deny by default on the permission and credential paths: an unreadable or
  malformed credential store injects nothing, and a profile the engine rejects
  fails the session instead of silently running on the default

### Testing
- Unit tests using Vitest
- No mocking - tests make real API calls
- Test files colocated with source files (`.test.ts`)
- Descriptive test names and proper async handling

### Logging
- All debugging through file logs to avoid disturbing the terminal
- Console output only for user-facing messages
- Special handling for large JSON objects with truncation
- Credential values are never logged - only key and connector names

## Architecture & Key Components

### 1. API Module (`/src/api/`)
Handles relay communication and encryption.

- **`api.ts`**: Main API client class for session management
- **`apiSession.ts`**: WebSocket-based real-time session client with RPC support
- **`apiMachine.ts`**: Machine-scoped client: machine RPCs (spawn, stop, shutdown) and the capability report
- **`auth.ts`**: Authentication flow using TweetNaCl for cryptographic signatures
- **`encryption.ts`**: End-to-end encryption utilities using TweetNaCl
- **`types.ts`**: Zod schemas for type-safe API communication

**Key Features:**
- End-to-end encryption for all communications
- Socket.IO for real-time messaging
- Optimistic concurrency control for state updates
- RPC handler registration for remote procedure calls

### 2. Agent Module (`/src/agent/`)
The engine integration layer.

- **`acp/acpAgentConfig.ts`**: The engine's name and ACP invocation - the single source for both
- **`acp/AcpBackend.ts`**: ACP client: engine process, session updates, permission requests, session modes
- **`acp/runAcp.ts`**: The session runner: relay session, envelopes, profile, permission switch, credential injection
- **`acp/AcpSessionManager.ts`**: Turn and tool-call bookkeeping for the session protocol
- **`core/`**, **`transport/`**: Backend interface and stderr/tool-name handling

### 3. Daemon Module (`/src/daemon/`)
Background service that spawns sessions on request.

- **`run.ts`**: Daemon lifecycle, machine registration, session tracking, spawn
- **`engineLaunch.ts`**: The engine session command line and the non-engine spawn refusal
- **`controlServer.ts`** / **`controlClient.ts`**: Local HTTP control surface
- **`sessionEnvironment.ts`**: What a spawned session does and does not inherit

### 4. Host-local modules (`/src/modules/`)

- **`permission/permissionSwitch.ts`**: The per-host permission confirmation switch (PERM-08)
- **`credentials/engineCredentials.ts`**: The single credential source for the engine (HOST-09, HOST-11)
- **`common/`**: Machine-scoped RPCs, the session kill handler, the Happy MCP server

### 5. UI Module (`/src/ui/`)

- **`logger.ts`**: Centralized logging system with file output
- **`qrcode.ts`**: QR code generation for mobile authentication
- **`auth.ts`**: Login and machine setup
- **`doctor.ts`**: Diagnostics

### 6. Core Files

- **`index.ts`**: CLI entry point with argument parsing
- **`persistence.ts`**: Local storage for settings and keys
- **`happyMcpStdioBridge.ts`**: STDIO bridge so the engine can reach the session's HTTP MCP server
- **`utils/time.ts`**: Exponential backoff utilities

## Data Flow

1. **Authentication**:
   - Generate/load secret key → Create signature challenge → Get auth token

2. **Session Creation**:
   - Create encrypted session with the relay → Establish WebSocket connection
   - Start the engine over ACP, select the agent profile as the session mode

3. **Message Flow**:
   - Control end → relay → daemon → engine (ACP prompt)
   - Engine updates → session envelopes → relay → control end

4. **Permission Handling**:
   - Switch off (default): the engine runs on an allow baseline and decides itself
   - Switch on: engine permission request → session envelope → control end answers → ACP outcome

## Key Design Decisions

1. **File-based logging**: Prevents interference with the terminal UI
2. **One agent**: the engine over ACP; differences between agents live in engine profiles, not here
3. **End-to-end encryption**: All data encrypted before leaving the device
4. **Session persistence**: Sessions live in the engine; the relay holds the ciphertext copy
5. **Optimistic concurrency**: Handles distributed state updates gracefully

## Security Considerations

- Private keys stored in `$HAPPY_HOME_DIR/access.key` with restricted permissions
- Engine credentials stored in `$HAPPY_HOME_DIR/engine-credentials.json` at 0600,
  injected into the engine process at spawn time and never written out as a
  plaintext engine config
- All communications encrypted using TweetNaCl
- Challenge-response authentication prevents replay attacks
- Session isolation through unique session IDs

## Dependencies

- Core: Node.js, TypeScript
- Engine: `@agentclientprotocol/sdk` (ACP), `@modelcontextprotocol/sdk` (MCP)
- Networking: Socket.IO client, Axios, Fastify (local control server)
- Crypto: TweetNaCl
- Terminal: ink, chalk, qrcode-terminal
- Validation: Zod
- Testing: Vitest

# Running the Daemon

## Starting the Daemon
```bash
# From the happy-cli directory:
./bin/happy.mjs daemon start

# With custom server URL (for local development):
HAPPY_SERVER_URL=http://localhost:3005 ./bin/happy.mjs daemon start

# Stop the daemon:
./bin/happy.mjs daemon stop

# Check daemon status:
./bin/happy.mjs daemon status
```

## Daemon Logs
- Daemon logs are stored in `$HAPPY_HOME_DIR/logs/` (default `~/.happy/logs/`)
- Named with format: `YYYY-MM-DD-HH-MM-SS-daemon.log`

# Starting a Session by Hand

```bash
# Start an engine session in the current directory
./bin/happy.mjs

# Under a named engine agent profile
./bin/happy.mjs --agent-profile research

# Against a specific engine build instead of the one on PATH
./bin/happy.mjs acp -- /opt/engine/opencode acp
```

# Permission Confirmation Switch

The switch is per host, stored as `permissionConfirmationEnabled` in
`$HAPPY_HOME_DIR/settings.json`, and off by default.

- Off: the engine starts with `OPENCODE_PERMISSION={"*":"allow"}` and the daemon
  surfaces no permission request, so a multi-step task needs zero confirmations.
- On: the engine applies its own rules and asks over ACP; the daemon forwards the
  request to the control end and relays the answer back. It never decides itself.

The engine's sensitive-file denials are in its managed config and apply either
way.

# Engine Credentials

`$HAPPY_HOME_DIR/engine-credentials.json`, mode 0600:

```json
{
  "platformApiKey": "...",
  "connectors": {
    "gmail": { "command": "gmail-mcp", "args": ["--stdio"], "env": { "GMAIL_TOKEN": "..." } }
  }
}
```

At session start the platform key becomes `MODEL_API_KEY` in the engine process
environment, and every connector becomes an MCP server entry carrying its own
secret. A missing store is normal; a malformed one injects nothing.
