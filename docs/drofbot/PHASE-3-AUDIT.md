# Phase 3 Infrastructure Audit

## Gateway Protocol

- **Server**: `src/gateway/server.impl.ts` → port 18789 (default)
- **Connection handler**: `src/gateway/server/ws-connection.ts` → `attachGatewayWsConnectionHandler()`
- **Message handler**: `src/gateway/server/ws-connection/message-handler.ts`
- **Client tracking**: `Set<GatewayWsClient>` (plain Set, not Map)
- **Frame format**: JSON discriminated union `{ type: "req"|"res"|"event", ... }` (TypeBox schemas in `src/gateway/protocol/schema/frames.ts`)
- **Auth**: token or password (timing-safe compare), optional Tailscale whois. Resolved via `resolveGatewayAuth()` in `src/gateway/auth.ts`
- **Handshake**: Server sends `connect.challenge` → Client replies `req { method: "connect", params: ConnectParams }` within 10s
- **Client IDs**: `webchat-ui`, `cli`, `openclaw-macos`, `node-host`, etc. in `src/gateway/protocol/client-info.ts`
- **Client modes**: `webchat`, `cli`, `ui`, `backend`, `node`, `probe`, `test`
- **Constants**: MAX_PAYLOAD=512KB, MAX_BUFFERED=1.5MB, TICK=30s, HEALTH=60s, HANDSHAKE_TIMEOUT=10s

## Tool Execution Pipeline

1. `createOpenClawCodingTools()` in `pi-tools.ts` assembles all tools
2. `createOpenClawTools()` in `openclaw-tools.ts` creates platform-level tools
3. Tool policy pipeline (10-layer filtering) in `pi-tools.ts`
4. `tool-split.ts` currently passes all tools as `customTools` (no-op seam for Brain/Hands)
5. LLM produces `tool_use` → pi-agent-core dispatches → handler executes → `tool_result` returned

### Registered Tools

**SDK/Coding (LOCAL)**: `read`, `write`, `edit`, `exec`, `process`, `apply_patch`
**Cloud-capable**: `memory_store`, `memory_search_structured`, `web_search`, `web_fetch`, `message`, `sessions_*`, `agents_list`, `session_status`, `gateway`, `cron`, `nodes`, `canvas`
**Mixed/Local-pref**: `browser`, `image`, `tts`
**Dynamic**: channel tools, plugin tools

## Heartbeat / Health Patterns

- **HeartbeatRunner** (`src/infra/heartbeat-runner.ts`): setTimeout-based per-agent recurring runner, configurable interval/prompt/channels/active hours
- **Health maintenance** (`src/gateway/server-maintenance.ts`): 30s tick + 60s health refresh
- **Events**: `heartbeat`, `health`, `tick` broadcast to all WS clients

## Lane Queue

- `CommandLane` enum: Main, Cron, Subagent, Nested (`src/process/lanes.ts`)
- `enqueueCommandInLane(lane, task, opts)` → FIFO with configurable `maxConcurrent` (default 1)
- In-process only (no persistence)

## Task Queue (Supabase)

- Table `task_queue` already exists (migration 002): `id UUID, type TEXT, status TEXT, payload JSONB, result JSONB, priority INT, timestamps, error TEXT`
- Status lifecycle: queued → running → completed/failed

## Consolidation Runner Pattern

- `startConsolidationRunner({ cfg })` → returns `{ stop() }` (ConsolidationRunner)
- setTimeout chain (not setInterval), `timer.unref()` for clean shutdown
- Graceful degradation when Supabase not configured

## Existing Stubs

- `src/hands/worker.ts` — empty `HandsWorker` class
- `src/hands/heartbeat.ts` — empty `HandsHeartbeat` class
- `src/hands/skills/{filesystem,shell,browser,code,app-control}.ts` — empty skill classes
- `src/hands/mcp/gutters.ts` — empty `GuttersBridge` (Phase 5)
- `src/brain/router/classifier.ts` — empty `TaskClassifier` class
- `src/brain/router/queue.ts` — empty `TaskQueue` class

## Key Integration Points

1. **`tool-split.ts`** is the existing seam for Brain/Hands routing (currently a no-op)
2. **Gateway client-info.ts** needs a new `HANDS_WORKER` client ID and `worker` mode
3. **Gateway auth** already supports token-based auth — workers can auth via the same mechanism (or a new `DROFBOT_WORKER_SECRET`)
4. **Config types.ts** needs a new `types.hands.ts` module for hands configuration
5. **server-close.ts** already has a cleanup pattern for consolidation/heartbeat — add worker cleanup
