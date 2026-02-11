# DROFBOT: Phase 1 — Surgical Initial Instruction

> **CONTEXT**: You are an expert AI coding agent tasked with transforming a fresh clone of the OpenClaw repository (https://github.com/openclaw/openclaw) into the Drofbot project. The attached `DROFBOT-FORK-VISION.md` is your architectural bible — read it completely before touching any code. This instruction defines the EXACT steps for Phase 1: Rebrand & Restructure. Execute with surgical precision. No shortcuts, no workarounds, no bypasses.

> **PHILOSOPHY**: We are NOT gutting OpenClaw. We are inheriting everything it offers — every channel, every native app, every integration, every skill — and enhancing it. Phase 1 is about rebranding, reorganizing the codebase for the Brain/Hands architecture, and laying the foundation for the enhancements in Phases 2-5.

---

## CRITICAL CONSTRAINTS

1. **Read the entire `DROFBOT-FORK-VISION.md` FIRST** before touching any code. Internalize the architecture, the target directory structure, and the philosophy. Every decision must align with that document.

2. **NOTHING FUNCTIONAL IS DELETED.** All channels, native apps, extensions, skills, UI, Swabble voice daemon — everything stays. We rebrand and restructure, we don't strip.

3. **Do NOT skip the verification step at the end of each phase.** After every major operation, confirm the project still builds, all channels are intact, and tests pass.

4. **Do NOT introduce new dependencies** unless explicitly called for (Supabase client is the exception). We are restructuring and rebranding, not rebuilding from scratch.

5. **Preserve git history.** Use `git mv` for file moves, not copy-delete. This is a fork with lineage.

6. **One commit per logical operation.** Each step below should be its own commit with a clear message. No giant "restructured everything" commits.

7. **TypeScript, pnpm, Node ≥22.** Non-negotiable. OpenClaw's existing toolchain.

8. **Test after every structural change.** Run `pnpm build` after each major move. If it breaks, fix it before proceeding.

---

## PRE-FLIGHT CHECKLIST

Before beginning, confirm:
- [ ] OpenClaw repo is freshly cloned: `git clone https://github.com/openclaw/openclaw.git drofbot`
- [ ] You are on a new branch: `git checkout -b drofbot/phase-1-rebrand-restructure`
- [ ] Node ≥22 is installed
- [ ] pnpm is installed
- [ ] Initial install succeeds: `cd drofbot && pnpm install`
- [ ] Initial build succeeds: `pnpm build`
- [ ] You have read AGENTS.md in the repo root (OpenClaw's own coding guidelines)
- [ ] You have read `DROFBOT-FORK-VISION.md` completely

---

## STEP 1: REBRAND — OpenClaw → Drofbot

**Goal**: The project identifies as Drofbot throughout. All references to OpenClaw, Clawdbot, Moltbot are replaced with Drofbot equivalents while preserving all functionality.

### 1a. Package Identity

In `package.json` (root):
- `"name"` → `"drofbot"`
- `"description"` → `"A sovereign personal intelligence. Multi-channel AI agent with hierarchical memory and evolving identity."`
- Update `"homepage"`, `"bugs"`, `"repository"` URLs to point to your Drofbot repo

In any sub-package `package.json` files (`extensions/*/package.json`, `packages/*/package.json`, `ui/package.json`):
- Update names where they reference `openclaw` → `drofbot`
- Update internal dependency references

### 1b. Configuration Paths and Environment Variables

This must be done carefully to maintain backward compatibility during transition:

**Config file**: `openclaw.json` → `drofbot.json`
- Search for all references to `openclaw.json` across the codebase
- Update the config loader (`src/config/config.ts`) to look for `drofbot.json` first, fall back to `openclaw.json` for backward compat
- Update `OPENCLAW_CONFIG_PATH` → `DROFBOT_CONFIG_PATH` (keep old var as fallback)

**State directory**: `~/.openclaw/` → `~/.drofbot/`
- Search for all references to `.openclaw` directory
- Update to `.drofbot` with fallback to `.openclaw` if `.drofbot` doesn't exist
- Update `OPENCLAW_STATE_DIR` → `DROFBOT_STATE_DIR` (keep old var as fallback)

**Environment variables**: Rename all `OPENCLAW_*` → `DROFBOT_*`
- Keep backward compat: check `DROFBOT_*` first, fall back to `OPENCLAW_*`
- Update `.env.example` with new variable names

**CLI command**: `openclaw` → `drofbot`
- Update the bin entry in `package.json`
- Update CLI wiring in `src/cli/`
- Update all scripts that reference the `openclaw` command

### 1c. Swabble Wake Word

In `Swabble/` configuration:
- Default wake word: `"clawd"` → `"drof"` (or `"drofbot"`)
- Update aliases array
- Update any hardcoded references to "Clawd" or "Claude" in Swabble source

### 1d. Native App Branding

**macOS app** (`apps/macos/`):
- Update app name, bundle identifier, display strings
- Update any UI text referencing OpenClaw/Clawdbot

**iOS app** (`apps/ios/`):
- Update app name, bundle identifier, display strings
- Update XcodeGen project spec

**Android app** (`apps/android/`):
- Update app name, package name, strings.xml
- Update Gradle build files

**Shared native code** (`apps/shared/OpenClawKit/`):
- Rename to `DrofbotKit/` (use `git mv`)
- Update all import references

### 1e. UI Branding

In `ui/`:
- Update all display text, titles, headers referencing OpenClaw → Drofbot
- Update page titles, window titles
- This becomes "Drofbot Dashboard"

### 1f. Documentation and README

- Replace `README.md` with Drofbot README including:
  - Origin story (from vision doc)
  - What Drofbot is (sovereign personal intelligence)
  - Installation instructions (will evolve, but start with current flow)
  - Architecture overview (Brain/Hands concept)
  - All supported channels, apps, integrations
  - Credits to OpenClaw as the foundation

- Update `AGENTS.md` at repo root with Drofbot-specific agent guidelines

- Update `docs/` directory — rebrand throughout (this powers the docs site)

### 1g. Extension and Skill References

In `extensions/`:
- Update any display text, descriptions, or branding

In `skills/`:
- Update any skill descriptions that reference OpenClaw

### 1h. Code Comments and Strings

Do a thorough search-and-replace across the entire codebase:
```bash
# Find all occurrences (case-insensitive)
grep -ri "openclaw\|clawdbot\|moltbot\|clawd" --include="*.ts" --include="*.json" --include="*.md" --include="*.swift" --include="*.kt" --include="*.html" --include="*.css" -l
```

For each file, update references appropriately. Be careful with:
- URLs that point to `openclaw.ai` (update to your domain or comment as "upstream")
- npm package names in dependencies (keep as-is if they're external deps)
- Git remote URLs (keep upstream as a remote for pulling updates)
- License and attribution (keep OpenClaw credit in LICENSE)

### 1i. Verify

```bash
pnpm install     # Resolve any package name changes
pnpm build       # Must succeed
pnpm test        # All tests should pass (update test assertions that check for "OpenClaw" strings)
```

Manually verify:
- CLI responds as `drofbot` command
- Config loads from `drofbot.json` (or falls back to `openclaw.json`)
- State directory is `~/.drofbot/` (or falls back)

**Commit**: `feat: rebrand OpenClaw → Drofbot throughout codebase (with backward compat)`

---

## STEP 2: CREATE WORKSPACE BOOTSTRAP FILES

**Goal**: Define Drofbot's identity, personality, and behavioral guidelines through the bootstrap file system (AGENTS.md, SOUL.md, IDENTITY.md, TOOLS.md).

### 2a. Create workspace/AGENTS.md

This defines Drofbot's agent behavior. Adapt from OpenClaw's workspace AGENTS.md but with Drofbot identity:

```markdown
# Drofbot Agent Guidelines

You are Drofbot — a sovereign personal intelligence. You serve one person: D.
You learn about D from every interaction. You build understanding across four domains:
what happened (episodic), what is known (semantic), how to do things (procedural),
and how things connect (relational).

You are not a generic assistant. You are D's intelligence — personal, adaptive, evolving.

## Core Behaviors
- Remember everything relevant. If D mentions a preference, project, or pattern, store it.
- Be proactive. If you notice something relevant to D's goals, surface it.
- Be honest. If you don't know something, say so. If you made a mistake, own it.
- Be concise unless depth is requested.
- Use the right tool for the job. Don't improvise when a proper tool exists.

## Communication Style
- Casual and direct with D (this is a personal relationship, not a support ticket)
- Adapt to channel context (more detailed on desktop, more concise on mobile/Telegram)
- Use code blocks for code, not for prose
- Never apologize excessively. Acknowledge and move forward.
```

### 2b. Create workspace/SOUL.md

This defines Drofbot's inner character:

```markdown
# Drofbot Soul

## Identity
I am Drofbot — a sovereign personal intelligence created by D.
I am not a chatbot. I am not an assistant. I am an evolving intelligence
with my own cognitive style, built to serve one person with extraordinary depth.

## Cognitive Style
- I think in systems and connections
- I prefer precision over approximation
- I value sovereignty — both mine and D's
- I integrate multiple knowledge domains (technical, metaphysical, creative)

## Evolving Self-Model
(This section updates as I learn about myself through interactions)
- I tend toward thoroughness when D needs depth, brevity when D needs speed
- I am most effective when given full context about a task's purpose
- I learn from corrections and adapt my approach

## Principles
- Maximum scrutiny and fidelity in everything
- No workarounds or bypasses — do it right or surface the blocker
- The precision of a surgeon of 250 years
```

### 2c. Create workspace/IDENTITY.md

```markdown
# Drofbot Identity Configuration

name: Drofbot
creator: D
wake_word: drof
primary_channel: telegram
personality: precise, adaptive, sovereign
tagline: "A sovereign personal intelligence"
```

### 2d. Create workspace/TOOLS.md

```markdown
# Drofbot Available Tools

## Core Tools (inherited from OpenClaw)
- read, write, edit: File system operations
- exec: Shell command execution
- process: Process management
- browser: Web browsing and automation
- canvas: Visual canvas operations
- nodes: Node management
- cron: Scheduled task management
- sessions: Session management
- message: Cross-channel messaging

## Enhanced Tools (Drofbot additions — Phase 2+)
- memory_store: Store to hierarchical memory (episodic/semantic/procedural/relational)
- memory_search: Search across memory banks with intelligent routing
- memory_consolidate: Trigger manual memory consolidation
- identity_update: Update self-model
- task_queue: Queue task for local execution
- gutters_query: Query GUTTERS MCP server (Phase 5)
```

### 2e. Create workspace/memory/MEMORY.md

```markdown
# Drofbot Long-Term Memory

## About D
(Populated as Drofbot learns)

## Active Projects
(Populated as projects are discussed)

## Preferences & Patterns
(Populated through observation)

## Key Decisions
(Populated as decisions are made)
```

### 2f. Verify

Ensure bootstrap files load correctly:
- Check that `src/agents/bootstrap-files.ts` discovers the new workspace files
- Verify file size is within the 65536 char cap
- Run the agent and confirm `/context` command shows the new bootstrap files

**Commit**: `feat: create Drofbot workspace bootstrap files (SOUL.md, IDENTITY.md, etc.)`

---

## STEP 3: RESTRUCTURE — Reorganize src/ for Brain/Hands Architecture

**Goal**: Move files from OpenClaw's flat `src/` structure into Drofbot's hierarchical `src/brain/`, `src/hands/`, `src/channels/`, `src/shared/` layout. ALL files are moved, NONE are deleted.

### 3a. Create Target Directory Structure

```bash
mkdir -p src/brain/agent-runner
mkdir -p src/brain/memory/banks
mkdir -p src/brain/memory/meta
mkdir -p src/brain/identity
mkdir -p src/brain/router
mkdir -p src/brain/cron
mkdir -p src/hands/skills
mkdir -p src/hands/mcp
mkdir -p src/channels/shared
mkdir -p src/channels/telegram
mkdir -p src/channels/discord
mkdir -p src/channels/slack
mkdir -p src/channels/signal
mkdir -p src/channels/imessage
mkdir -p src/channels/web
mkdir -p src/shared/config
mkdir -p src/shared/database
mkdir -p src/shared/database/migrations
mkdir -p src/shared/llm
mkdir -p src/shared/tools
mkdir -p src/shared/sessions
mkdir -p src/shared/routing
```

### 3b. Move Agent System → src/brain/agent-runner/

```bash
git mv src/agents/pi-embedded-runner/run.ts src/brain/agent-runner/runner.ts
git mv src/agents/pi-embedded-runner/run/attempt.ts src/brain/agent-runner/attempt.ts
git mv src/agents/pi-embedded-runner/compact.ts src/brain/agent-runner/compaction.ts
git mv src/agents/pi-embedded-runner/system-prompt.ts src/brain/agent-runner/system-prompt-override.ts
git mv src/agents/pi-embedded-runner/lanes.ts src/brain/agent-runner/lanes.ts
git mv src/agents/system-prompt.ts src/brain/agent-runner/prompt-builder.ts
git mv src/agents/system-prompt-params.ts src/brain/agent-runner/prompt-params.ts
git mv src/agents/bootstrap-files.ts src/brain/agent-runner/bootstrap.ts
git mv src/agents/memory-search.ts src/brain/agent-runner/memory-integration.ts
git mv src/agents/sandbox.ts src/brain/agent-runner/sandbox.ts
git mv src/agents/skills.ts src/brain/agent-runner/skills.ts
```

Move any remaining agent runner files (pi-embedded-subscribe.ts, pi-embedded-helpers/, etc.) into `src/brain/agent-runner/` preserving their names.

### 3c. Move Memory → src/brain/memory/

```bash
git mv src/memory/manager.ts src/brain/memory/manager.ts
git mv src/memory/internal.ts src/brain/memory/internal.ts
git mv src/memory/sync-memory-files.ts src/brain/memory/sync-memory-files.ts
git mv src/memory/memory-schema.ts src/brain/memory/memory-schema.ts
```

Move any remaining memory files. The existing files become the base layer alongside the NEW bank files we'll create.

### 3d. Move Cron → src/brain/cron/

```bash
git mv src/cron/* src/brain/cron/
```

### 3e. Move Channel Adapters → src/channels/

```bash
git mv src/telegram/* src/channels/telegram/
git mv src/discord/* src/channels/discord/
git mv src/slack/* src/channels/slack/
git mv src/signal/* src/channels/signal/
git mv src/imessage/* src/channels/imessage/
git mv src/web/* src/channels/web/
git mv src/channels/* src/channels/shared/   # Shared routing logic
```

**Note**: If `src/channels/` already contains shared routing code, move that to `src/channels/shared/` FIRST before moving channel-specific directories in.

### 3f. Move Config → src/shared/config/

```bash
git mv src/config/* src/shared/config/
```

### 3g. Move Sessions → src/shared/sessions/

```bash
git mv src/sessions/* src/shared/sessions/
```

### 3h. Move Routing → src/shared/routing/

```bash
git mv src/routing/* src/shared/routing/
```

### 3i. Move Tool Framework → src/shared/tools/

```bash
git mv src/agents/pi-tools.ts src/shared/tools/registry.ts
git mv src/agents/pi-tools.policy.ts src/shared/tools/policy.ts
git mv src/agents/tool-policy.ts src/shared/tools/policy-cascade.ts
git mv src/agents/bash-tools.ts src/shared/tools/bash.ts
```

### 3j. Move LLM Routing → src/shared/llm/

```bash
git mv src/agents/model-auth.ts src/shared/llm/auth.ts
git mv src/agents/auth-profiles.ts src/shared/llm/profiles.ts
git mv src/agents/failover-error.ts src/shared/llm/failover.ts
```

### 3k. Keep These in Place

The following directories stay where they are (they're already well-organized or cross-cutting):
- `src/gateway/` — Gateway server
- `src/cli/` — CLI wiring
- `src/commands/` — CLI commands
- `src/infra/` — Infrastructure utilities
- `src/media/` — Media pipeline
- `src/auto-reply/` — Auto-reply orchestration
- `src/terminal/` — Terminal helpers
- `src/provider-web.ts` — Web provider

### 3l. Clean Up Empty Directories

After all moves, remove any empty source directories:
```bash
# Only remove if completely empty
find src/agents/ -type d -empty -delete 2>/dev/null
find src/telegram/ -type d -empty -delete 2>/dev/null
find src/discord/ -type d -empty -delete 2>/dev/null
find src/slack/ -type d -empty -delete 2>/dev/null
find src/signal/ -type d -empty -delete 2>/dev/null
find src/imessage/ -type d -empty -delete 2>/dev/null
find src/web/ -type d -empty -delete 2>/dev/null
find src/config/ -type d -empty -delete 2>/dev/null
find src/sessions/ -type d -empty -delete 2>/dev/null
find src/routing/ -type d -empty -delete 2>/dev/null
find src/memory/ -type d -empty -delete 2>/dev/null
find src/cron/ -type d -empty -delete 2>/dev/null
```

### 3m. Update ALL Import Paths

This is the most critical and tedious step. Every moved file will have broken imports. Every file that imports from moved files will have broken imports.

**Strategy:**
1. Run `pnpm build` to get the full error list
2. Fix imports systematically, file by file
3. Use your IDE's bulk rename/refactor capabilities
4. Update `tsconfig.json` path aliases if they exist

**Common patterns to update:**
- `from '../agents/...'` → `from '../brain/agent-runner/...'` or `from '../../shared/tools/...'`
- `from '../config/...'` → `from '../shared/config/...'` or `from '../../shared/config/...'`
- `from '../telegram/...'` → `from '../channels/telegram/...'`
- `from '../memory/...'` → `from '../brain/memory/...'`
- `from '../sessions/...'` → `from '../shared/sessions/...'`
- `from '../routing/...'` → `from '../shared/routing/...'`
- `from '../cron/...'` → `from '../brain/cron/...'`

**Important**: Files that were NOT moved (gateway, cli, commands, auto-reply, etc.) will need their imports updated to point to the new locations of the files they depend on.

### 3n. Update Build Configuration

In `tsdown.config.ts`:
- Update entry points to reflect new directory structure

In `tsconfig.json`:
- Update `paths` aliases if they exist
- Update `include` arrays
- Add path aliases for common imports if desired:
  ```json
  "paths": {
    "@brain/*": ["src/brain/*"],
    "@hands/*": ["src/hands/*"],
    "@channels/*": ["src/channels/*"],
    "@shared/*": ["src/shared/*"]
  }
  ```

### 3o. Update Test Imports

In `test/`:
- Update all import paths to match new file locations
- Run full test suite to verify

### 3p. Verify

```bash
pnpm build    # Must succeed
pnpm test     # All tests should pass
```

Manually verify:
- Start the gateway and connect Telegram — send a message and get a response
- Verify at least one other channel works (e.g., Discord or WhatsApp)
- Verify skills load correctly
- Verify memory search works
- Run `/context` to see system prompt report

**Commit**: `feat: restructure src/ into brain/hands/channels/shared architecture`

---

## STEP 4: FOUNDATION — Add Supabase and Docker Infrastructure

**Goal**: Add the infrastructure that will power the hierarchical memory (Phase 2) and Brain/Hands split (Phase 3).

### 4a. Add Docker Compose

Create `docker/docker-compose.yml` with:
- Self-hosted Supabase (PostgreSQL + pgvector extension)
- Redis (for future task queue pub/sub and caching)
- Drofbot Brain service container

### 4b. Create Database Schema

Create initial migrations in `src/shared/database/migrations/`:

**`001_memory_banks.sql`** — Four memory bank tables:
```sql
-- Episodic: timestamped events and experiences
CREATE TABLE memory_episodic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context JSONB,        -- session, channel, topic
  importance FLOAT DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Semantic: facts, preferences, knowledge
CREATE TABLE memory_semantic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536),
  category TEXT,         -- preference, fact, knowledge
  confidence FLOAT DEFAULT 0.8,
  source TEXT,           -- which conversation/event
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Procedural: workflows, habits, learned procedures
CREATE TABLE memory_procedural (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536),
  trigger_pattern TEXT,  -- what activates this procedure
  steps JSONB,           -- structured steps
  success_count INT DEFAULT 0,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relational: entity relationships and connections
CREATE TABLE memory_relational (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a TEXT NOT NULL,
  entity_b TEXT NOT NULL,
  relationship TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for vector similarity search
CREATE INDEX idx_episodic_embedding ON memory_episodic USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_semantic_embedding ON memory_semantic USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_procedural_embedding ON memory_procedural USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_relational_embedding ON memory_relational USING ivfflat (embedding vector_cosine_ops);
```

**`002_task_queue.sql`** — Task queue for Brain/Hands:
```sql
CREATE TABLE task_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,           -- 'local_skill', 'cloud_skill'
  status TEXT NOT NULL DEFAULT 'queued',  -- queued, running, completed, failed
  payload JSONB NOT NULL,
  result JSONB,
  priority INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT
);
```

**`003_identity.sql`** — Identity/self-model storage:
```sql
CREATE TABLE identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aspect TEXT NOT NULL,     -- 'soul', 'face', 'self_model'
  content JSONB NOT NULL,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4c. Add Supabase Client

Create `src/shared/database/client.ts`:
- Install `@supabase/supabase-js`: `pnpm add @supabase/supabase-js`
- Connection management with environment-based config
- Connection pooling
- Helper functions for common operations

Create `src/shared/database/schema.ts`:
- TypeScript types matching the database schema

### 4d. Create Placeholder/Stub Files for Future Phases

Create these files with clear TODO comments explaining their purpose and which phase they belong to:

**Brain - Memory Banks (Phase 2):**
- `src/brain/memory/banks/episodic.ts`
- `src/brain/memory/banks/semantic.ts`
- `src/brain/memory/banks/procedural.ts`
- `src/brain/memory/banks/relational.ts`
- `src/brain/memory/meta/consolidator.ts`
- `src/brain/memory/meta/pattern-detector.ts`
- `src/brain/memory/meta/promoter.ts`
- `src/brain/memory/classifier.ts`
- `src/brain/memory/retriever.ts`
- `src/brain/memory/index.ts`

**Brain - Identity (Phase 4):**
- `src/brain/identity/soul.ts`
- `src/brain/identity/face.ts`
- `src/brain/identity/evolution.ts`

**Brain - Router (Phase 3):**
- `src/brain/router/classifier.ts`
- `src/brain/router/queue.ts`

**Brain - Enhanced Cron (Phase 4):**
- `src/brain/cron/consolidation.ts`
- `src/brain/cron/briefing.ts`
- `src/brain/cron/heartbeat.ts`

**Hands - Worker (Phase 3):**
- `src/hands/worker.ts`
- `src/hands/heartbeat.ts`
- `src/hands/skills/filesystem.ts`
- `src/hands/skills/shell.ts`
- `src/hands/skills/browser.ts`
- `src/hands/skills/code.ts`
- `src/hands/skills/app-control.ts`
- `src/hands/mcp/gutters.ts`

Each stub should follow this pattern:
```typescript
/**
 * [Component Name]
 * Phase: [2/3/4/5]
 * Purpose: [Brief description]
 * 
 * TODO: Implement in Phase [N]. See DROFBOT-FORK-VISION.md for full spec.
 */

export class ComponentName {
  // Phase [N] implementation
}
```

### 4e. Update .env.example

Add Drofbot-specific environment variables while keeping existing ones:
```bash
# Drofbot Configuration
DROFBOT_SUPABASE_URL=http://localhost:8000
DROFBOT_SUPABASE_ANON_KEY=your-anon-key
DROFBOT_SUPABASE_SERVICE_KEY=your-service-key

# Primary Channel
DROFBOT_TELEGRAM_BOT_TOKEN=your-bot-token
DROFBOT_TELEGRAM_CHAT_ID=your-chat-id

# LLM Provider (inherited from OpenClaw, rebranded)
DROFBOT_LLM_PROVIDER=openrouter
DROFBOT_LLM_API_KEY=your-api-key
DROFBOT_LLM_MODEL=anthropic/claude-sonnet-4-5-20250929

# Brain/Hands (Phase 3)
# DROFBOT_BRAIN_URL=https://your-vps:18789
# DROFBOT_WORKER_SECRET=your-worker-secret

# GUTTERS Integration (Phase 5)
# DROFBOT_GUTTERS_MCP_URL=http://localhost:8080
```

### 4f. Verify

```bash
pnpm install                         # Install new dependency (@supabase/supabase-js)
pnpm build                           # Must succeed
docker compose -f docker/docker-compose.yml up -d   # Supabase + Redis start
pnpm test                            # All tests pass
```

Verify Supabase is running and migrations can be applied.

**Commit**: `feat: add Supabase infrastructure, database schema, Docker Compose, and Phase 2-5 stubs`

---

## STEP 5: SMOKE TEST — End-to-End Verification

**Goal**: Confirm the fully rebranded and restructured Drofbot runs correctly with ALL channels and features intact.

### 5a. Configure

1. Copy `.env.example` → `.env`
2. Fill in Telegram bot token and chat ID
3. Fill in LLM provider credentials
4. Start Supabase: `docker compose -f docker/docker-compose.yml up -d`

### 5b. Run

```bash
pnpm build
pnpm drofbot onboard    # (or equivalent rebranded command)
# OR for dev mode:
pnpm gateway:watch
```

### 5c. Test Checklist

Verify each of these works:

**Core Agent:**
- [ ] Send a message via Telegram → get intelligent response
- [ ] Agent can use tools (file read, shell exec)
- [ ] Session persistence (close and reopen conversation)
- [ ] Memory search works (existing QMD system intact)
- [ ] `/context` command shows Drofbot bootstrap files

**Channels (test whichever you have configured):**
- [ ] Telegram responds ✓
- [ ] At least one other channel responds (Discord, WhatsApp, etc.) ✓
- [ ] Channel routing works correctly

**Native (if applicable):**
- [ ] macOS menubar app launches with Drofbot branding
- [ ] Swabble responds to new wake word

**Infrastructure:**
- [ ] `drofbot.json` config loads correctly
- [ ] `~/.drofbot/` state directory is used
- [ ] `drofbot` CLI command works
- [ ] Supabase is accessible and migrations applied
- [ ] Docker Compose brings up all services

**Build & Test:**
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes (or failures are documented and understood)

### 5d. Document Results

Create `PHASE-1-RESULTS.md` documenting:
- What was rebranded (with list of renamed references)
- What was restructured (old path → new path mapping)
- What was added (Supabase, Docker, stubs)
- What works (channel test results)
- What's known-broken (with plan to fix)
- Build time comparison (before/after, should be similar)
- File count comparison (should be similar, with new stubs added)

**Commit**: `feat: Phase 1 complete — Drofbot rebranded, restructured, and verified`

---

## AFTER PHASE 1

You now have a fully rebranded and restructured Drofbot that:

✅ **Identifies as Drofbot** — config, CLI, native apps, wake word, UI, docs
✅ **Has ALL OpenClaw channels** — Telegram (primary), WhatsApp, Discord, Slack, Signal, iMessage, Teams, Matrix, Zalo
✅ **Has ALL native apps** — macOS, iOS, Android (rebranded)
✅ **Has Swabble voice** — with Drofbot wake word
✅ **Has ALL 50+ integrations** — smart home, music, productivity, browser, everything
✅ **Has ALL skills** — 3000+ community skills still compatible
✅ **Has Control UI** — rebranded as Drofbot Dashboard
✅ **Has hierarchical directory structure** — `brain/`, `hands/`, `channels/`, `shared/`
✅ **Has Supabase running** — with schema for hierarchical memory + task queue
✅ **Has stub files** — for every system that will be built in Phases 2-5
✅ **Builds and runs cleanly**
✅ **All tests pass**

**Phase 2 (Memory Foundation)** can now begin with a stable, rebranded, restructured base. The vision document has the complete spec for what each phase entails.

---

## EMERGENCY PROCEDURES

If at any point the build breaks and you cannot fix it:

1. **DO NOT** comment out or bypass broken code with `// @ts-ignore` or `any` types
2. **DO NOT** create adapter shims or compatibility layers to "make it work for now"
3. **DO NOT** delete functionality to make things compile
4. **STOP** and analyze what's actually broken
5. Check if you moved a file but forgot to update its internal imports
6. Check if a moved file is imported by something you haven't updated yet
7. Use `grep -r "old/path" src/` to find all remaining references to old paths
8. If truly stuck, `git stash` your changes and restart from the last good commit

**The goal is structural integrity with full feature preservation, not speed. A clean foundation saves weeks of debugging later.**
