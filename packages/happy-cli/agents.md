# Happy CLI Agent Tests

The engine (`opencode` over ACP) is the only agent (HOST-10).

## Layer 1 Rules

- one primary integration test file for the engine
- keep that file next to the agent code
- use 2-3 long integration tests
- mocked tests do not count as acceptance
- do not build a generic layer-1 framework directory
- test the real agent surface directly

## Primary Files

- `packages/happy-cli/src/daemon/daemon.integration.test.ts` — daemon lifecycle
- the harness `e2e/run.sh` — control end through relay, daemon, engine and gateway

## What The Primary Test Must Cover

1. basic turn + multi-turn context
2. agent profile + permission confirmation switch + model switching
3. interrupt + stop + failure handling

If the engine does not support part of that surface, the test should assert the
real limitation directly.

## Test Shape

Keep it simple:

- a few long tests
- real CLI
- real auth
- real permission flow
- real interruption

No mocks as the main proof.
