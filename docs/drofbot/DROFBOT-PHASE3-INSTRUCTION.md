# DROFBOT: Phase 3 — Brain/Hands Split (Surgical Instruction)

> **CONTEXT**: Phases 1-2 are complete. Drofbot is rebranded, restructured, has hierarchical memory (4 banks + classifier + retriever + consolidation), and a clean test suite (83+ tests passing). The task queue table already exists in Supabase (migration 002). This instruction defines Phase 3: splitting the single-machine Gateway into a cloud Brain (always reachable) and a local Hands Worker (system access). Read `DROFBOT-FORK-VISION.md` (specifically the "Brain/Hands Architecture" section and its CRITICAL IMPLEMENTATION NOTE) before starting.

> **PHILOSOPHY**: The Brain/Hands split inserts a **network boundary** between decision-making and execution. It does NOT duplicate anything. The Brain is the existing Gateway + agent runner + memory, deployed to a VPS. The Hands Worker is a lightweight WebSocket client that runs on the local machine and delegates to the EXISTING tool implementations. The Gateway WebSocket server already exists (port 18789) — we extend it, not replace it.

---

## CRITICAL CONSTRAINTS

1. **NOTHING IS REIMPLEMENTED.** The `src/hands/skills/` files are thin routing wrappers. They receive a command from the Brain over WebSocket and call the EXISTING tool functions in `src/shared/tools/` and `src/brain/agent-runner/tools/`. Read the CRITICAL IMPLEMENTATION NOTE in DROFBOT-FORK-VISION.md section 2.

2. **REUSE EVERYTHING THAT EXISTS.** Same rule as Phase 2 — grep before you write. Specifically:
   - **Gateway WebSocket server**: Already exists at `src/gateway/` (port 18789). Extend the existing protocol, do NOT create a second WebSocket server.
   - **Tool implementations**: Already exist in `src/shared/tools/`, `src/brain/agent-runner/tools/`. The Worker calls these. It does not rewrite them.
   - **Task queue table**: Already exists in Supabase (migration 002 from Phase 2). Use it.
   - **Lane Queue**: Already exists in `src/brain/agent-runner/lanes.ts` for serial task execution. Study it.
   - **Heartbeat runner pattern**: Already exists in `src/brain/cron/` (the consolidation runner uses setTimeout chains). Follow the same pattern.
   - **Config/Zod system**: Already exists in `src/shared/config/`. Extend the existing schema.
   - **Session/routing infrastructure**: Already exists in `src/shared/sessions/` and `src/shared/routing/`.

3. **Graceful degradation is non-negotiable.** When no Worker is connected, the Brain must:
   - Continue functioning for all cloud-capable operations (chat, memory, web search, API calls)
   - Queue local-only tasks in the task queue with status `queued`
   - Inform the user: "Your machine is offline. I've queued this task."
   - When the Worker reconnects, drain the queue automatically

4. **The existing single-machine mode must continue to work.** If someone runs Drofbot without configuring Brain/Hands (no VPS, no Worker), everything should work exactly as it does today — a single Gateway process on their machine. The Brain/Hands split is an OPTIONAL deployment mode, not a forced migration.

5. **One commit per logical step. Build must pass after each. Tests for every new component.**

---

## PRE-FLIGHT CHECKLIST

Before beginning, confirm:
- [ ] Phase 2 is complete (all gaps resolved, build passing, 83+ tests green)
- [ ] You have read `DROFBOT-FORK-VISION.md` — specifically sections 2 (Brain/Hands Architecture) and 4 (Prolonged Operation & Checkpoints)
- [ ] You have read and understood these existing systems:
  - [ ] `src/gateway/server.impl.ts` — the existing WebSocket Gateway server
  - [ ] `src/gateway/protocol/` — the existing Gateway protocol schema
  - [ ] `src/brain/agent-runner/lanes.ts` — the Lane Queue system
  - [ ] `src/shared/tools/` — the existing tool implementations
  - [ ] `src/brain/agent-runner/openclaw-tools.ts` — how tools are registered and dispatched
  - [ ] `src/brain/agent-runner/tools/` — individual tool implementations
  - [ ] `src/shared/database/migrations/002_task_queue.sql` — the existing task queue schema
  - [ ] `src/brain/cron/consolidation.ts` — the setTimeout runner pattern
- [ ] You understand: the Worker calls EXISTING tools over a network boundary, it does not reimplement them

---

## STEP 0: AUDIT EXISTING INFRASTRUCTURE

**This step is MANDATORY before writing any code.** Same discipline as Phase 2.

### 0a. Map the Gateway Protocol

The Gateway already has a WebSocket protocol for communication. Understand it completely:

```bash
# How the Gateway WebSocket server works
grep -rn "WebSocket\|wss\|ws://" src/gateway/ --include="*.ts" -l

# The protocol schema (message types, commands, events)
find src/gateway/protocol/ -name "*.ts" -exec echo {} \; -exec head -30 {} \;

# How clients currently connect to the Gateway
grep -rn "connection\|onMessage\|onClose\|onOpen" src/gateway/ --include="*.ts"

# Port configuration
grep -rn "18789\|port\|PORT" src/gateway/ --include="*.ts"
```

Document: What message types exist? How are clients authenticated? What's the message format?

### 0b. Map Tool Execution Flow

Understand exactly how a tool call flows from the agent runner to execution:

```bash
# How the agent decides to call a tool
grep -rn "toolCall\|tool_use\|executeTool\|runTool" src/brain/agent-runner/ --include="*.ts" -l

# How tool results get back to the agent
grep -rn "toolResult\|tool_result" src/brain/agent-runner/ --include="*.ts" -l

# Which tools require local system access (file I/O, shell, browser)
grep -rn "exec\|spawn\|readFile\|writeFile\|fs\." src/shared/tools/ src/brain/agent-runner/tools/ --include="*.ts" -l

# Which tools are purely cloud-capable (memory, web search, APIs)
grep -rn "fetch\|http\|api\|supabase\|memory" src/brain/agent-runner/tools/ --include="*.ts" -l
```

Document: What's the tool call → execution → result pipeline? Which tools touch the local filesystem vs which are cloud-only?

### 0c. Map the Existing Heartbeat System

OpenClaw may already have heartbeat or health-check patterns:

```bash
grep -rn "heartbeat\|health\|alive\|ping\|pong" src/ --include="*.ts" -l
```

Document: Is there an existing heartbeat? How does it work?

### 0d. Document Your Findings

Create a brief `PHASE-3-AUDIT.md` or comment block documenting:
- Gateway protocol: message types, auth, format
- Tool execution pipeline: call → dispatch → execute → result
- Which tools are local-only vs cloud-capable
- Existing heartbeat/health patterns
- Any existing remote execution or worker concepts

**Do NOT proceed to Step 1 until this audit is complete.**

**Commit**: `docs: Phase 3 infrastructure audit`

---

## STEP 1: DEFINE THE BRAIN↔HANDS PROTOCOL

**Goal**: Extend the existing Gateway protocol with message types for Brain↔Worker communication.

### 1a. Design Protocol Messages

The Worker is a new type of client that connects to the Gateway WebSocket. It needs a distinct set of message types. Design these as extensions to the existing protocol schema (in `src/gateway/protocol/`):

**Brain → Worker messages:**

```typescript
// Brain asks Worker to execute a tool
interface TaskDispatch {
  type: 'task:dispatch'
  taskId: string          // UUID from task_queue table
  tool: string            // tool name (e.g., 'read_file', 'exec_shell', 'browser_action')
  params: Record<string, unknown>  // tool parameters
  priority: number        // 1-10
  timeout?: number        // ms, default 300000 (5 min)
}

// Brain asks Worker for status
interface TaskCancel {
  type: 'task:cancel'
  taskId: string
}

// Brain acknowledges Worker connection
interface WorkerAck {
  type: 'worker:ack'
  queuedTasks: number     // how many tasks are waiting
}
```

**Worker → Brain messages:**

```typescript
// Worker announces itself
interface WorkerRegister {
  type: 'worker:register'
  secret: string          // DROFBOT_WORKER_SECRET for auth
  capabilities: string[]  // which tools the worker can execute
  hostname: string
  platform: string        // 'darwin', 'linux', 'win32'
}

// Worker sends heartbeat
interface WorkerHeartbeat {
  type: 'worker:heartbeat'
  uptime: number          // seconds
  load: number            // system load average
  activeTasks: number
}

// Worker reports task progress
interface TaskProgress {
  type: 'task:progress'
  taskId: string
  progress: number        // 0-100
  message?: string        // human-readable progress update
}

// Worker reports task completion
interface TaskResult {
  type: 'task:result'
  taskId: string
  status: 'completed' | 'failed'
  result?: unknown        // tool output
  error?: string          // if failed
  duration: number        // ms
}
```

### 1b. Implement Protocol Types

Add these types to the existing protocol schema. Follow the EXACT patterns used by existing protocol messages:

```bash
# Find how existing protocol messages are defined
ls src/gateway/protocol/
grep -rn "interface\|type\|schema" src/gateway/protocol/ --include="*.ts" | head -30
```

If the protocol uses Zod schemas, define the new messages as Zod schemas. If it uses TypeScript interfaces, use interfaces. Match the existing pattern.

### 1c. Add Worker Authentication

The Worker authenticates with a shared secret (`DROFBOT_WORKER_SECRET`). This is simple but sufficient for a single-user system:

- Worker sends `worker:register` with `secret` field
- Brain validates against `DROFBOT_WORKER_SECRET` env var
- If invalid, disconnect immediately
- If valid, send `worker:ack` with count of queued tasks

Add config:
```bash
# In .env.example
DROFBOT_WORKER_SECRET=your-secret-here

# In drofbot.json schema (extend existing Zod config)
{
  "hands": {
    "enabled": false,          // must be explicitly enabled
    "workerSecret": "...",     // or from env var
    "heartbeatInterval": 30,   // seconds
    "taskTimeout": 300         // seconds, default 5 min
  }
}
```

### 1d. Write Tests

- Protocol message types validate correctly
- Worker registration with correct secret succeeds
- Worker registration with wrong secret fails
- Message serialization/deserialization roundtrips correctly

**Commit**: `feat: define Brain↔Worker protocol messages and worker auth`

---

## STEP 2: IMPLEMENT TASK ROUTER (Brain Side)

**Goal**: The Brain's agent runner can now classify tool calls as "cloud" (execute locally in the Brain process) or "local" (dispatch to the Worker). When no Worker is connected, local tools either queue or fall back to local execution (single-machine mode).

### 2a. Implement Tool Classifier

Replace the stub in `src/brain/router/classifier.ts`:

This is a RULE-BASED classifier (no LLM call needed). It categorizes tools based on what they need:

```typescript
/**
 * Tool Classifier — determines whether a tool call needs local system access.
 *
 * LOCAL tools (need Worker / local machine):
 * - File system operations (read_file, write_file, edit_file, list_dir, etc.)
 * - Shell execution (exec_shell, run_command, etc.)
 * - Browser automation (browser_*, playwright_*, etc.)
 * - Process management (start_process, kill_process, etc.)
 * - App control (screenshot, clipboard, etc.)
 *
 * CLOUD tools (can execute in Brain process):
 * - Memory operations (memory_search, memory_store, memory_search_structured, etc.)
 * - Web search / web fetch
 * - LLM calls
 * - API integrations
 * - Message sending
 * - Cron management
 *
 * HYBRID tools (prefer local, fall back to cloud):
 * - Some tools might work in both contexts with different capabilities
 */

export type ToolLocation = 'cloud' | 'local' | 'hybrid'

export function classifyTool(toolName: string): ToolLocation {
  // Build the classification from actual tool names in the codebase
  // grep src/shared/tools/ and src/brain/agent-runner/tools/ for all registered tool names
}
```

**IMPORTANT**: Build this classification by actually examining every tool registered in the codebase:
```bash
grep -rn "name.*:\|toolName\|tool_name" src/shared/tools/ src/brain/agent-runner/tools/ src/brain/agent-runner/openclaw-tools.ts --include="*.ts" | grep -i "name"
```

### 2b. Implement Task Queue Manager

Replace the stub in `src/brain/router/queue.ts`:

This manages the task queue in Supabase (table already exists from migration 002). It handles:

```typescript
/**
 * Task Queue Manager
 *
 * Uses the existing task_queue table in Supabase.
 * Manages the lifecycle: queued → running → completed/failed
 */

export class TaskQueueManager {
  /** Queue a task for Worker execution */
  async enqueue(task: TaskInput): Promise<string> // returns taskId

  /** Mark a task as running (Worker picked it up) */
  async markRunning(taskId: string): Promise<void>

  /** Mark a task as completed with result */
  async markCompleted(taskId: string, result: unknown): Promise<void>

  /** Mark a task as failed with error */
  async markFailed(taskId: string, error: string): Promise<void>

  /** Get all queued tasks (for draining when Worker connects) */
  async getQueued(): Promise<TaskQueueEntry[]>

  /** Get task by ID */
  async getTask(taskId: string): Promise<TaskQueueEntry | null>

  /** Cancel a queued task */
  async cancel(taskId: string): Promise<void>

  /** Clean up old completed/failed tasks (called by consolidation cron) */
  async cleanup(olderThanDays: number): Promise<number>
}
```

Use the existing Supabase client from `src/shared/database/client.ts`. Graceful degradation: if Supabase is not configured, fall back to an in-memory queue (tasks don't survive restarts, but the system still works).

### 2c. Integrate Router Into Agent Tool Execution

This is the critical integration point. When the agent runner wants to execute a tool:

1. Classify the tool: `classifyTool(toolName)` → cloud | local | hybrid
2. If **cloud**: execute normally (existing code path, no change)
3. If **local**:
   a. Is a Worker connected? → dispatch via WebSocket, await result
   b. Is NO Worker connected AND we're in single-machine mode? → execute locally (existing code path)
   c. Is NO Worker connected AND we're in Brain-only mode (VPS)? → enqueue in task queue, inform user
4. If **hybrid**: try cloud first, fall back to local if needed

Find where tool execution happens in the agent runner:
```bash
grep -rn "executeTool\|runTool\|tool.*execute\|tool.*run" src/brain/agent-runner/ --include="*.ts" -l
```

Insert the routing logic at this decision point. The key requirement: **existing single-machine behavior is the DEFAULT**. The routing only activates when `hands.enabled` is true in config.

```typescript
// Pseudocode for the routing decision
async function executeToolWithRouting(toolName: string, params: Record<string, unknown>) {
  const handsConfig = getConfig().hands

  // If Brain/Hands not enabled, use existing local execution (unchanged behavior)
  if (!handsConfig?.enabled) {
    return existingToolExecution(toolName, params)
  }

  const location = classifyTool(toolName)

  if (location === 'cloud') {
    return existingToolExecution(toolName, params)
  }

  if (location === 'local' || location === 'hybrid') {
    if (isWorkerConnected()) {
      return dispatchToWorker(toolName, params)
    } else {
      // Queue the task and inform the user
      const taskId = await taskQueue.enqueue({ tool: toolName, params, priority: 5 })
      return {
        status: 'queued',
        message: `Your machine is offline. Task queued (${taskId}). It will execute when your machine reconnects.`
      }
    }
  }
}
```

### 2d. Write Tests

- Tool classifier correctly categorizes all registered tools
- Task queue CRUD operations (enqueue, markRunning, markCompleted, markFailed, getQueued, cancel)
- Routing: cloud tool → direct execution (no Worker needed)
- Routing: local tool + Worker connected → dispatch
- Routing: local tool + no Worker + single-machine mode → local execution
- Routing: local tool + no Worker + Brain-only mode → queue + user message
- Graceful degradation: queue works in-memory when Supabase is down

**Commit**: `feat: implement tool classifier, task queue manager, and agent routing`

---

## STEP 3: EXTEND GATEWAY FOR WORKER CONNECTIONS

**Goal**: The existing Gateway WebSocket server can now accept Worker connections alongside regular client connections.

### 3a. Study the Existing Gateway Connection Handling

Before modifying anything:
```bash
# How does the Gateway handle incoming connections?
grep -rn "onConnection\|connection\|upgrade\|handleMessage" src/gateway/server.impl.ts --include="*.ts"

# How does it distinguish between different types of clients?
grep -rn "client\|channel\|source\|type" src/gateway/server.impl.ts --include="*.ts" | head -30
```

### 3b. Add Worker Connection Handling

Extend `src/gateway/server.impl.ts` to handle Worker connections:

1. **Detect Worker connections**: When a new WebSocket connection arrives and sends `worker:register` as its first message, treat it as a Worker (not a regular channel client).

2. **Authenticate**: Validate the `secret` field against `DROFBOT_WORKER_SECRET`.

3. **Track Worker state**: Maintain a reference to the connected Worker (there should only be one at a time for a single-user system, but design for future multi-worker support):

```typescript
interface WorkerConnection {
  ws: WebSocket
  hostname: string
  platform: string
  capabilities: string[]
  connectedAt: Date
  lastHeartbeat: Date
  activeTasks: Map<string, TaskDispatch>  // taskId → task
}
```

4. **Handle Worker disconnect**: When the Worker disconnects:
   - Mark all its active tasks as `failed` (with error "Worker disconnected")
   - Log the disconnection
   - Optionally notify the user via their primary channel: "Your machine went offline. Switching to brain-only mode."

5. **Handle Worker reconnect**: When a Worker connects and there are queued tasks:
   - Send `worker:ack` with the queue count
   - Begin draining the queue (dispatch tasks one at a time or in parallel depending on the Worker's capability)

### 3c. Add Worker Message Routing

Handle incoming messages from the Worker:

- `worker:heartbeat` → update `lastHeartbeat`, log if needed
- `task:progress` → update task in queue, optionally forward progress to user channel
- `task:result` → update task queue (markCompleted/markFailed), return result to the agent runner's pending tool call

**The critical flow for task:result**: When the agent dispatched a tool call to the Worker, it's waiting for a result. The Gateway needs to bridge the WebSocket response back to the agent runner's pending Promise. Study how existing tool execution returns results:

```bash
grep -rn "resolve\|reject\|callback\|promise\|await.*tool" src/brain/agent-runner/ --include="*.ts" | head -20
```

The dispatch-to-Worker flow needs to:
1. Create a Promise for the result
2. Store it keyed by taskId
3. Send the task to the Worker over WebSocket
4. When `task:result` arrives, resolve the Promise
5. The agent runner awaits this Promise just like it would await a local tool execution

### 3d. Implement Heartbeat Monitoring

Add a heartbeat timeout check on the Brain side. Use the same setTimeout pattern as the consolidation runner:

- Worker sends `worker:heartbeat` every N seconds (default 30)
- Brain checks: if no heartbeat received in 2×N seconds, consider Worker offline
- If Worker goes offline mid-task, handle gracefully (see 3b.4)

### 3e. Write Tests

- Worker can connect and authenticate via WebSocket
- Worker with wrong secret is rejected
- Worker heartbeat updates tracked state
- Worker disconnect triggers task failure for active tasks
- Worker reconnect triggers queue drain
- Task dispatch → Worker receives it → sends result → Brain gets result
- Heartbeat timeout detection works
- Regular (non-Worker) Gateway clients still work unchanged

**Commit**: `feat: extend Gateway to handle Worker connections, heartbeat, and task routing`

---

## STEP 4: IMPLEMENT THE WORKER PROCESS (Hands Side)

**Goal**: A standalone process that runs on the local machine, connects to the Brain's Gateway via WebSocket, and executes tool calls using the EXISTING tool implementations.

### 4a. Implement Worker Core

Replace the stub in `src/hands/worker.ts`:

The Worker is a WebSocket client that:

1. Connects to the Brain's Gateway URL (`DROFBOT_BRAIN_URL`)
2. Sends `worker:register` with auth secret and capability list
3. Waits for `worker:ack`
4. Enters a loop: receive `task:dispatch` → execute → send `task:result`
5. Sends periodic `worker:heartbeat`

```typescript
/**
 * Drofbot Hands Worker
 *
 * A lightweight process that runs on the local machine and connects
 * to the Brain's Gateway via WebSocket. When the Brain needs to execute
 * a local tool (file I/O, shell, browser, etc.), it dispatches the task
 * to this Worker, which delegates to the EXISTING tool implementations.
 *
 * This is NOT a reimplementation of any tools. It's a network bridge
 * that receives commands and calls the functions in src/shared/tools/
 * and src/brain/agent-runner/tools/.
 */
```

### 4b. Implement Skill Routing Wrappers

Replace the stubs in `src/hands/skills/`. These are THIN WRAPPERS:

```typescript
// src/hands/skills/filesystem.ts
// WRONG — reimplementing:
import * as fs from 'fs'
export async function readFile(path: string) { return fs.readFileSync(path, 'utf8') }

// RIGHT — delegating to existing:
import { existingReadFileTool } from '../../shared/tools/registry.js'  // or wherever it lives
export async function executeFilesystemTool(toolName: string, params: Record<string, unknown>) {
  // Route to the existing tool implementation
  return existingReadFileTool(params)
}
```

**For each skill file**, find the existing tool implementation and import it:

```bash
# Find file system tool implementations
grep -rn "read_file\|write_file\|edit_file\|list_dir\|search_file" src/shared/tools/ src/brain/agent-runner/tools/ --include="*.ts"

# Find shell tool implementations
grep -rn "exec\|shell\|command\|spawn\|bash" src/shared/tools/ src/brain/agent-runner/tools/ --include="*.ts" -l

# Find browser tool implementations
grep -rn "browser\|playwright\|puppeteer\|navigate\|screenshot" src/shared/tools/ src/brain/agent-runner/tools/ --include="*.ts" -l
```

Each skill wrapper should:
1. Accept a tool name and params from the Worker
2. Map to the existing tool function
3. Call the existing function
4. Return the result

If a tool function requires context objects that aren't available in the Worker process (like agent scope, session state, etc.), you'll need to determine: can the context be serialized and sent with the task dispatch? Or does the tool need to be adapted for context-free execution? Document any such cases.

### 4c. Implement Worker Heartbeat

Replace the stub in `src/hands/heartbeat.ts`:

```typescript
/**
 * Sends periodic heartbeats to the Brain with:
 * - uptime (seconds since worker started)
 * - system load average
 * - number of active tasks
 *
 * Interval configurable via DROFBOT_HEARTBEAT_INTERVAL (default 30s)
 */
```

Use `os.loadavg()` for system load. Follow the same setTimeout chain pattern used by the consolidation runner.

### 4d. Implement Reconnection Logic

The Worker should automatically reconnect if the connection drops:

- On disconnect: wait N seconds (with exponential backoff), try to reconnect
- On reconnect: re-register with the Brain
- Max reconnection attempts before giving up (configurable, default 10)
- Log all connection state changes

### 4e. Create Worker Entry Point

Create a CLI entry point for running the Worker:

```bash
# The user should be able to run:
drofbot worker

# Or with explicit Brain URL:
drofbot worker --brain-url wss://my-vps:18789 --secret my-secret
```

Wire this into the existing CLI system in `src/cli/` and `src/commands/`:
```bash
# How are existing CLI commands registered?
grep -rn "command\|register\|program\|yargs\|commander" src/cli/ src/commands/ --include="*.ts" | head -20
```

### 4f. Write Tests

- Worker connects to mock WebSocket server and registers
- Worker executes a filesystem tool via existing implementation
- Worker executes a shell tool via existing implementation
- Worker sends heartbeats on schedule
- Worker reconnects after disconnect (with backoff)
- Worker handles task:cancel correctly
- Worker reports task:progress for long-running tools
- Worker handles tool execution errors gracefully (sends task:result with status: failed)

**Commit**: `feat: implement Hands Worker process with skill routing and reconnection`

---

## STEP 5: CHECKPOINT UPDATES

**Goal**: When the Brain dispatches a long-running task to the Worker, it can send progress updates to the user via their messaging channel.

### 5a. Implement Checkpoint Messaging

When the Worker sends `task:progress`, the Brain should:

1. Look up which user/session initiated the task
2. Send a progress update via the originating channel (or primary channel if the originating session is gone)
3. Format the message appropriately for the channel

```typescript
// Example progress messages
"[🔄 25%] Reading project files... Found 12 TypeScript files to refactor."
"[🔄 50%] Refactoring auth module. 6 of 12 files updated."
"[🔄 75%] Running tests after refactor... all passing so far."
"[✅ Complete] Auth refactor done. 12 files modified, 0 tests broken."
```

Find how the agent currently sends proactive messages:
```bash
# How does the agent send messages outside of a request-response cycle?
grep -rn "sendMessage\|proactive\|notify\|push\|broadcast" src/ --include="*.ts" -l | head -20
```

### 5b. Implement Queue Status Commands

Add commands that let the user check task status:

- `/tasks` or `/queue` — show pending and running tasks
- `/cancel <taskId>` — cancel a queued task

Find how existing slash commands are registered:
```bash
grep -rn "command\|slash\|handler.*command\|registerCommand" src/channels/ src/brain/ --include="*.ts" | head -20
```

### 5c. Write Tests

- Progress updates are forwarded to the correct channel
- Task completion sends a final update
- Task failure sends an error message
- /tasks command returns formatted queue status
- /cancel command cancels a queued task

**Commit**: `feat: implement checkpoint progress updates and queue status commands`

---

## STEP 6: DOCKER DEPLOYMENT

**Goal**: Docker Compose can deploy the Brain on a VPS and the Worker on a local machine.

### 6a. Update Docker Compose

Update `docker/docker-compose.yml` to include a Brain service:

```yaml
services:
  brain:
    build:
      context: ..
      dockerfile: docker/Dockerfile.brain
    ports:
      - "18789:18789"    # Gateway WebSocket
    environment:
      - DROFBOT_SUPABASE_URL=http://supabase:8000
      - DROFBOT_SUPABASE_KEY=${DROFBOT_SUPABASE_KEY}
      - DROFBOT_WORKER_SECRET=${DROFBOT_WORKER_SECRET}
      - DROFBOT_TELEGRAM_BOT_TOKEN=${DROFBOT_TELEGRAM_BOT_TOKEN}
      # ... other channel configs
    depends_on:
      supabase:
        condition: service_healthy
      redis:
        condition: service_healthy

  # supabase and redis services already exist from Phase 2
```

### 6b. Create Dockerfile.brain

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod
COPY dist/ ./dist/
COPY workspace/ ./workspace/
COPY skills/ ./skills/
EXPOSE 18789
CMD ["node", "dist/gateway/server.js"]
```

Verify the entry point matches the actual build output. Adjust as needed based on how `pnpm build` outputs files.

### 6c. Create Dockerfile.hands

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod
COPY dist/ ./dist/
CMD ["node", "dist/hands/worker.js"]
```

The Hands Dockerfile is minimal — it only needs the Worker process and the tool implementations.

### 6d. Add docker-compose.worker.yml

A separate compose file for the Worker (runs on the local machine, not the VPS):

```yaml
services:
  worker:
    build:
      context: ..
      dockerfile: docker/Dockerfile.hands
    environment:
      - DROFBOT_BRAIN_URL=wss://your-vps:18789
      - DROFBOT_WORKER_SECRET=${DROFBOT_WORKER_SECRET}
    volumes:
      - ${HOME}:/home/user  # access to local files
    network_mode: host       # access to local services
```

### 6e. Document Deployment

Update the README or create a `DEPLOYMENT.md` with:
- Single-machine mode (existing, default, no changes needed)
- Brain/Hands mode: how to deploy Brain on VPS + Worker on local machine
- Environment variables reference
- Docker Compose commands

### 6f. Verify

```bash
pnpm build
docker compose -f docker/docker-compose.yml build
# If Docker is available, test that images build successfully
```

**Commit**: `feat: Docker deployment for Brain (VPS) and Worker (local)`

---

## STEP 7: SMOKE TEST — End-to-End Brain/Hands Verification

### 7a. Single-Machine Mode (Regression)

Verify the existing single-machine mode still works with NO Brain/Hands config:

1. No `hands.enabled` in config (or explicitly `false`)
2. Start gateway normally
3. Send messages via Telegram
4. Execute local tools (file read, shell command)
5. Verify everything works EXACTLY as before Phase 3

### 7b. Brain/Hands Mode (if infrastructure available)

If a VPS or second machine is available:

1. Deploy Brain with Docker Compose
2. Start Worker on local machine: `drofbot worker --brain-url wss://vps:18789`
3. Send message via Telegram: "What files are in my home directory?"
4. Verify: Brain routes to Worker → Worker executes `ls` → result appears in Telegram
5. Stop Worker → send another local command → verify it queues
6. Restart Worker → verify queued task executes automatically
7. Verify heartbeat: Worker sends heartbeats, Brain tracks state

### 7c. Graceful Degradation

1. Start Brain without Worker
2. Send cloud-only requests (chat, memory search, web search) → all work
3. Send local request (file read) → verify queue message
4. Connect Worker → verify queued task drains
5. Kill Worker mid-task → verify task fails gracefully

### 7d. Document Results

Create `PHASE-3-RESULTS.md` documenting:
- Test suite: total tests, all passing
- Single-machine regression: confirmed working
- Brain/Hands integration: tested or documented test plan
- Checkpoint updates: working or documented
- Docker: images build successfully
- Known issues and plans

**Commit**: `feat: Phase 3 complete — Brain/Hands architecture operational`

---

## AFTER PHASE 3

You now have a Drofbot that can run in two modes:

✅ **Single-machine mode** (unchanged default) — everything runs on your local machine, exactly like OpenClaw
✅ **Brain/Hands mode** — Brain runs on VPS (always reachable), Worker runs on local machine
✅ **Task routing** — cloud tools execute in Brain, local tools dispatch to Worker
✅ **Task queue** — local tasks queue when Worker is offline, drain on reconnect
✅ **Heartbeat protocol** — Brain tracks Worker online/offline state
✅ **Checkpoint updates** — progress messages sent to user during long tasks
✅ **Worker process** — lightweight WebSocket client that delegates to existing tools
✅ **Docker deployment** — Brain and Worker containerized
✅ **Graceful degradation** — everything works with or without Worker, with or without Supabase

**Phase 4 (Identity & Intelligence)** builds the dual identity system (soul + face), meta-memory pattern detection, and per-channel personality adaptation.

---

## EMERGENCY PROCEDURES

1. **DO NOT** reimplement any tool that already exists in `src/shared/tools/` or `src/brain/agent-runner/tools/`
2. **DO NOT** create a second WebSocket server — extend the existing Gateway
3. **DO NOT** break single-machine mode — it must remain the default and work unchanged
4. **DO NOT** make the Worker a hard dependency — Brain must function independently
5. If WebSocket message routing gets complex, study how the existing Gateway routes messages between channels and follow the same pattern
6. If tool execution context is hard to serialize for Worker dispatch, document the limitation rather than hacking around it — some tools may need to remain Brain-local initially
7. `git stash` and restart from last good commit if truly stuck
