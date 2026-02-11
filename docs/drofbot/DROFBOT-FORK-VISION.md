# DROFBOT: The Complete Fork Vision & Architectural Blueprint

> **Purpose**: This document is the definitive architectural blueprint for transforming an OpenClaw fork into Drofbot — a sovereign personal intelligence. It is intended to be handed to an AI coding agent (e.g., Claude Code, Cursor, Windsurf) alongside the cloned repo as the single source of truth. The companion document `DROFBOT-PHASE1-INSTRUCTION.md` contains step-by-step surgical execution instructions.

---

## Origin Story

Drofbot is a fork of [OpenClaw](https://github.com/openclaw/openclaw) — just as Kilo Code forked Cline and made it its own. OpenClaw (117k+ GitHub stars, 16.5k forks) provided the proof that a personal AI agent living on messaging platforms could work at scale. Drofbot takes that foundation and transforms it into something fundamentally different: a **sovereign personal intelligence** that learns about you, from you, for you — while building its own evolving identity.

**"It's a sovereign personal intelligence that lives in the cloud and reaches into my machine. It knows who I am — not just my preferences, but my patterns, my projects, my goals, my cosmic timing. It has its own evolving identity and it learns alongside me. I forked the messaging plumbing from OpenClaw, but the brain, the memory, the identity, and the soul — that's mine."**

---

## Philosophy: Inherit Everything, Enhance What Matters

Drofbot is NOT OpenClaw with features removed. It is OpenClaw with **depth added**.

We keep every channel adapter, every native app, every integration, every skill — all of that is battle-tested infrastructure that would take months to rebuild. We rebrand it, restructure the codebase for our Brain/Hands architecture, and then layer on the systems that make Drofbot categorically different: hierarchical memory, evolving identity, Brain/Hands cloud-local split, GUTTERS integration, and prolonged autonomous operation.

Think of it this way: OpenClaw is a powerful body with a basic brain. Drofbot gives it a sophisticated brain, a soul, and a purpose.

---

## What OpenClaw IS vs What Drofbot BECOMES

### OpenClaw: The Generic Agent

OpenClaw is a **multi-channel messaging gateway** with an agent loop attached. Written in TypeScript (172k+ lines), it runs as a single Gateway process on your machine. It supports 12+ messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, MS Teams, WebChat, Matrix, Zalo, Google Chat), has native apps (macOS menubar, iOS, Android), a voice wake-word daemon (Swabble), 50+ integrations (smart home, music, productivity, browser), a skills marketplace (3000+ community skills), and a memory system based on markdown files with QMD hybrid search (BM25 + vector). It's powerful but generic — designed to serve everyone equally rather than understand one person deeply.

### Drofbot: The Sovereign Personal Intelligence

Drofbot inherits ALL of OpenClaw's capabilities and adds depth:

| Dimension | OpenClaw (Inherited) | Drofbot (Enhanced) |
|-----------|---------------------|-------------------|
| **Channels** | 12+ platforms (WhatsApp, Telegram, Discord, Slack, Signal, iMessage, Teams, WebChat, Matrix, Zalo, Google Chat) | All channels retained. Telegram designated as primary for richest bot API features. All others fully functional. |
| **Native Apps** | macOS menubar, iOS, Android | All retained and rebranded. Enhanced for Brain/Hands architecture (local Worker integration via native app). |
| **Voice** | Swabble wake-word daemon ("Clawd") | Retained and rebranded. Wake word changed to "Drof" or custom. Voice as first-class input. |
| **Integrations** | 50+ (Home Assistant, Spotify, Sonos, Notion, Obsidian, Trello, GitHub, browser, etc.) | All retained. Enhanced with GUTTERS MCP integration, cosmic timing, and personal tool chain. |
| **Skills** | 3000+ community skills, skill marketplace | All retained. Curated personal skill library + custom Drofbot skills. |
| **Memory** | Flat markdown files, QMD hybrid search (BM25 + vector) | **ENHANCED**: Hierarchical brain with 4 memory banks (episodic, semantic, procedural, relational) + meta-memory consolidation layer. Supabase/pgvector backend. Original markdown memory kept as human-readable backup/export. |
| **Identity** | System prompt with SOUL.md bootstrap file | **NEW**: Living dual identity system (soul + face) that evolves — builds self-knowledge alongside user-knowledge. |
| **Architecture** | Single gateway process, local only | **NEW**: Brain/Hands split — cloud Core (always reachable via VPS) + local Worker (reaches into your machine). Gateway bridges both. |
| **Context Handling** | Compaction with memory flush to markdown | **ENHANCED**: Checkpoint system with proactive Telegram updates, task queuing, and prolonged operation awareness. Pre-compaction memory flush to structured banks. |
| **Cron/Automation** | Basic cron job system | **ENHANCED**: Memory consolidation cron, daily briefing generation, cosmic timing integration. |
| **Philosophy** | "Do things for everyone on every platform" | "Understand one person deeply and serve them brilliantly — through every platform" |

---

## Verified OpenClaw Source Structure (as of Feb 2026)

This is the actual repo layout, verified directly from the GitHub repository, AGENTS.md, and DeepWiki documentation:

```
openclaw/                          # 172k+ lines TypeScript, 8,368 commits
├── .agent/workflows/              # GitHub agent workflows
├── .github/                       # CI/CD, labeler, issue templates
├── Swabble/                       # Voice wake-word daemon (Swift 6.2)
│   └── (wake word, transcription, hook system, launchd service)
├── apps/                          # Native applications
│   ├── macos/                     # macOS menubar app (Swift, XPC)
│   ├── ios/                       # iOS app (Swift, XcodeGen)
│   ├── android/                   # Android app (Kotlin, Gradle)
│   └── shared/OpenClawKit/        # Shared native Swift code
├── assets/                        # Static assets (logos, icons)
├── docs/                          # Mintlify documentation (docs.openclaw.ai)
├── extensions/                    # Plugin extensions (workspace packages)
│   ├── memory-core/               # Default memory search plugin (BM25 + vector)
│   ├── msteams/                   # Microsoft Teams channel
│   ├── matrix/                    # Matrix channel
│   ├── zalo/                      # Zalo channel
│   ├── zalouser/                  # Zalo Personal channel
│   └── voice-call/                # Voice call extension
├── git-hooks/                     # Git hooks
├── packages/                      # Shared packages
├── patches/                       # pnpm patches for deps
├── scripts/                       # Build/release/utility scripts
├── skills/                        # Bundled skills (SKILL.md per skill)
├── src/                           # *** CORE SOURCE CODE ***
│   ├── agents/                    # Agent system (THE ENGINE)
│   │   ├── pi-embedded-runner/    # Main agent runner (wraps pi-agent-core)
│   │   │   ├── run.ts             # runEmbeddedPiAgent lifecycle
│   │   │   ├── run/attempt.ts     # Single inference attempt orchestration
│   │   │   ├── lanes.ts           # Session/global lane queue (race condition prevention)
│   │   │   ├── compact.ts         # Context compaction logic
│   │   │   └── system-prompt.ts   # System prompt override
│   │   ├── pi-tools.ts            # Tool registry (Pi coding tools + OpenClaw tools)
│   │   ├── pi-tools.policy.ts     # Tool policy enforcement
│   │   ├── system-prompt.ts       # buildAgentSystemPrompt() — full prompt assembly
│   │   ├── system-prompt-params.ts # Prompt parameter resolution
│   │   ├── bootstrap-files.ts     # AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md loading
│   │   ├── model-auth.ts          # Provider auth profiles
│   │   ├── auth-profiles.ts       # Auth config + failover via auth.order
│   │   ├── sandbox.ts             # Sandboxing logic
│   │   ├── skills.ts              # Skill discovery, caching, snapshot versioning
│   │   ├── memory-search.ts       # Memory search integration
│   │   ├── bash-tools.ts          # Shell execution tools
│   │   └── tool-policy.ts         # Tool allow/deny policy cascade
│   ├── auto-reply/                # Auto-reply orchestration
│   │   └── reply/
│   │       ├── agent-runner*.ts   # Agent runner wiring
│   │       └── commands-context-report.ts  # /context command
│   ├── channels/                  # Channel routing shared logic
│   ├── cli/                       # CLI wiring (openclaw CLI commands)
│   ├── commands/                  # CLI command implementations
│   │   └── agent/                 # Agent CLI commands
│   ├── config/                    # Configuration system
│   │   ├── config.ts              # Config loading (JSON5, hot-reload)
│   │   ├── schema.ts              # Config schema
│   │   ├── sessions.ts            # Session management
│   │   ├── types.ts               # Core types
│   │   ├── types.agents.ts        # Agent config types
│   │   ├── types.tools.ts         # Tool config types
│   │   └── zod-schema.ts          # Zod validation
│   ├── cron/                      # Cron job system
│   ├── discord/                   # Discord channel adapter
│   ├── gateway/                   # Gateway WebSocket server (port 18789)
│   │   ├── server.ts              # Server entry
│   │   ├── server.impl.ts         # Server implementation
│   │   └── protocol/              # Gateway protocol schema
│   ├── imessage/                  # iMessage channel adapter
│   ├── infra/                     # Infrastructure utilities
│   ├── media/                     # Media pipeline
│   ├── memory/                    # Memory system
│   │   ├── manager.ts             # Memory manager (indexing, sync, caching)
│   │   ├── internal.ts            # Internal memory operations
│   │   ├── sync-memory-files.ts   # File sync
│   │   └── memory-schema.ts       # Embedding cache schema (SQLite)
│   ├── provider-web.ts            # Web provider
│   ├── routing/                   # Message routing + session keys
│   ├── sessions/                  # Session persistence (JSONL)
│   ├── signal/                    # Signal channel adapter
│   ├── slack/                     # Slack channel adapter
│   ├── telegram/                  # Telegram adapter (grammY)
│   │   ├── bot.ts                 # grammY bot setup
│   │   └── (HTML formatting, media, threads, pairing, group migration)
│   ├── terminal/                  # Terminal output helpers
│   └── web/                       # WhatsApp Web adapter (Baileys)
├── test/                          # Test suite
├── ui/                            # Control UI (web dashboard)
├── vendor/a2ui/                   # Vendored UI dependency
├── .env.example                   # Environment template
├── AGENTS.md                      # Agent coding guidelines (important context)
├── package.json                   # pnpm workspace root
└── tsdown.config.ts               # Build config (tsdown → dist/)
```

**Key Technical Details (from AGENTS.md and DeepWiki):**
- Runtime: Node ≥22, TypeScript, built with tsdown → dist/
- Agent core: wraps `@mariozechner/pi-agent-core` (pi-ai library)
- Model routing: pi-ai with auth profiles, failover via `auth.order` map
- Memory: Markdown files + QMD sidecar (SQLite, GGUF models for reranking/query expansion)
- Config: `~/.openclaw/openclaw.json` (JSON5, Zod-validated, hot-reload)
- Sessions: JSONL files, session keys encode routing metadata
- Plugins: `extensions/*` workspace packages, loaded via package.json manifest
- Tools: Pi coding tools (read, write, edit, exec, process) + OpenClaw tools (browser, canvas, nodes, cron, sessions, message)
- Tool policy: profile → allow/deny → byProvider → per-agent cascading
- Bootstrap files: AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md (capped at 65536 chars per file)
- Channels: always consider all built-in + extension channels when refactoring shared logic
- Swabble: Swift 6.2 wake-word daemon, local-only Speech.framework, hooks into gateway

---

## What We ADD (The Drofbot Enhancements)

Everything below is layered ON TOP of the inherited OpenClaw infrastructure. Nothing functional is removed.

### 1. The Hierarchical Brain (Memory Architecture)

> **CRITICAL IMPLEMENTATION PRINCIPLE**: OpenClaw already has a sophisticated memory infrastructure — embedding generation, vector search (BM25 + hybrid), caching, memory tools, and a cron system. The new memory banks MUST be built on top of this existing infrastructure, not alongside it. Import existing embedding functions, follow existing tool registration patterns, use existing cron scheduling, follow existing config/validation patterns. Before writing ANY utility function, grep the codebase to check if it already exists. The only genuinely new code should be the bank storage logic, the classifier prompt, and the retriever routing.

This is the crown jewel — the thing that makes Drofbot categorically different from every other agent.

OpenClaw's existing markdown + QMD memory is retained as the base layer and human-readable backup. On top of it, we build structured memory in Supabase (PostgreSQL + pgvector):

**Four Memory Banks:**

```
┌─────────────────────────────────────────────────────┐
│                  DROFBOT BRAIN                       │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐                  │
│  │  EPISODIC    │  │  SEMANTIC    │                  │
│  │  What        │  │  What is     │                  │
│  │  happened    │  │  known/true  │                  │
│  │             │  │              │                  │
│  │  Events,     │  │  Facts,      │                  │
│  │  decisions,  │  │  preferences,│                  │
│  │  context     │  │  knowledge   │                  │
│  └──────┬──────┘  └──────┬───────┘                  │
│         │                │                           │
│  ┌──────┴──────┐  ┌──────┴───────┐                  │
│  │ PROCEDURAL  │  │ RELATIONAL   │                  │
│  │ How to do   │  │ How things   │                  │
│  │ things      │  │ connect      │                  │
│  │             │  │              │                  │
│  │ Workflows,  │  │ Project deps,│                  │
│  │ scripts,    │  │ people,      │                  │
│  │ habits      │  │ systems      │                  │
│  └─────────────┘  └──────────────┘                  │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │           META-MEMORY LAYER                      │ │
│  │  Consolidation · Pattern Detection · Promotion   │ │
│  │  Compression · Core Identity Maintenance         │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │        ORIGINAL OPENCLAW MEMORY (Base Layer)     │ │
│  │  Markdown files + QMD hybrid search              │ │
│  │  (Retained as human-readable backup/export)      │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**EPISODIC** — "What happened." Stores timestamped events:
*"On Feb 7, D and I architected the Drofbot fork strategy. Key decision: keep all channels, build hierarchical memory on Supabase."*

**SEMANTIC** — "What is known." Stores facts and preferences:
*"D uses TypeScript. D is a Projector human design type. D prefers modular architecture. GUTTERS uses FastAPI + PostgreSQL."*

**PROCEDURAL** — "How to do things." Stores learned workflows:
*"When D says 'deploy GUTTERS,' run the build script, check .env, and push to the VPS at [address]."*

**RELATIONAL** — "How things connect." Stores entity relationships:
*"GUTTERS depends on PostgreSQL + Redis. The cardology module connects to the chronos system. D's VPS runs on Hetzner."*

**META-MEMORY LAYER** — Runs on a cron schedule. Performs:
- Consolidation: dedup and compress similar memories across banks
- Pattern detection: "D asks about deployment every Friday"
- Promotion: recurring patterns become core identity facts
- Compression: old episodic memories get summarized into semantic knowledge

**Storage**: Self-hosted Supabase (PostgreSQL + pgvector) alongside the existing QMD system. Structured memory with vector search, cloud-accessible from both Brain and Hands components.

### 2. Brain / Hands Architecture

> **CRITICAL IMPLEMENTATION NOTE**: OpenClaw already has fully functional tool implementations — file read/write/edit (`pi-tools.ts` → `src/shared/tools/registry.ts`), shell execution (`bash-tools.ts` → `src/shared/tools/bash.ts`), browser automation, canvas, and more, all registered through `createOpenClawCodingTools`. The `src/hands/skills/` files are NOT reimplementations of these tools. They are **thin routing wrappers** that receive commands from the Brain over WebSocket and delegate to the existing tool implementations. The Brain/Hands split inserts a network boundary between decision-making and execution — it does not duplicate the execution layer. When implementing Phase 3, always check what already exists in `src/shared/tools/` and `src/brain/agent-runner/` before writing any tool logic.

This is the major architectural enhancement — splitting the single-machine Gateway into a cloud Brain (always reachable) and a local Hands Worker (system access).

```
┌──────────────────────────────────────┐    ┌──────────────────────────────────────┐
│          BRAIN (VPS / Cloud)          │    │        HANDS (Local Machine)          │
│                                        │    │                                        │
│  ┌────────────────────────────────┐   │    │  ┌────────────────────────────────┐   │
│  │  All Channel Adapters           │   │    │  │  Worker Service                 │   │
│  │  Telegram (primary), WhatsApp,  │   │    │  │  WebSocket client → Brain       │   │
│  │  Discord, Slack, Signal,        │   │    │  └──────────┬─────────────────────┘   │
│  │  iMessage, Teams, Matrix, etc.  │   │    │             │                          │
│  │  Always listening.              │   │    │  ┌──────────▼─────────────────────┐   │
│  └──────────┬─────────────────────┘   │    │  │  Local Skills                    │   │
│             │                          │    │  │  File I/O, Shell, Code Exec,     │   │
│  ┌──────────▼─────────────────────┐   │    │  │  Browser Automation, App Control  │   │
│  │  Agent Runner (pi-agent-core)   │   │    │  └────────────────────────────────┘   │
│  │  LLM orchestration              │   │    │                                        │
│  │  System prompt assembly         │   │    │  ┌────────────────────────────────┐   │
│  │  Tool execution                 │   │    │  │  Native App Integration         │   │
│  └──────────┬─────────────────────┘   │    │  │  macOS menubar (rebranded)       │   │
│             │                          │    │  │  iOS/Android (rebranded)         │   │
│  ┌──────────▼─────────────────────┐   │    │  │  Swabble voice daemon            │   │
│  │  Hierarchical Brain              │   │    │  └────────────────────────────────┘   │
│  │  4 Memory Banks + Meta Layer    │   │    │                                        │
│  │  Supabase (pgvector)            │   │    │  ┌────────────────────────────────┐   │
│  │  + Original QMD (backup)        │   │    │  │  MCP Integrations               │   │
│  └────────────────────────────────┘   │    │  │  GUTTERS, Home Assistant,        │   │
│                                        │    │  │  Spotify, Notion, etc.           │   │
│  ┌────────────────────────────────┐   │    │  └────────────────────────────────┘   │
│  │  Cloud Skills                    │   │    │                                        │
│  │  Web Search, Memory Mgmt,       │   │    │  ┌────────────────────────────────┐   │
│  │  API Integrations, Logic         │   │    │  │  Heartbeat Protocol             │   │
│  └────────────────────────────────┘   │    │  │  Online/Offline detection        │   │
│                                        │    │  │  Task queue execution            │   │
│  ┌────────────────────────────────┐   │    │  └────────────────────────────────┘   │
│  │  Identity System                 │   │    └──────────────────────────────────────┘
│  │  Soul (internal cognition)       │   │
│  │  Face (external presentation)    │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │  Task Queue (PostgreSQL)         │   │
│  │  Persistent, crash-resilient     │   │
│  └────────────────────────────────┘   │
│                                        │
│  ┌────────────────────────────────┐   │
│  │  Cron Engine (Enhanced)          │   │
│  │  Memory consolidation            │   │
│  │  Daily briefings                 │   │
│  │  Cosmic timing integration       │   │
│  └────────────────────────────────┘   │
└──────────────────────────────────────┘
```

**How it works in practice:**

You message Telegram: "Check the weather" → Router: Cloud Skill → Agent replies instantly from anywhere.

You message WhatsApp: "Edit main.py in my Projects folder" → Router: Local Skill → Check: Is Worker connected? → If Yes: sends command via WebSocket → Worker executes → reports back. If No: "Your PC is offline. I've queued this task."

You say "Drof, what's on my screen?" → Swabble transcribes → Brain routes to Hands → Worker takes screenshot → Brain analyzes and responds.

You use the iOS app while commuting → chat flows through Brain → no local machine needed for conversation, memory, and cloud skills.

You shut down your PC at 11 PM → "Your machine went offline. I'll continue in brain-only mode. Goodnight." → Brain keeps running across all channels. Text at 2 AM from any platform, it responds using memory and cloud skills. Can't execute local code until Hands reconnect.

### 3. Dual Identity System

**Soul** (internal) — Cognitive configuration: reasoning style, ethical boundaries, curiosity drives, self-model. Evolves based on interaction patterns. Stored in workspace/SOUL.md + semantic memory bank.

**Face** (external) — Presentation layer: tone, vocabulary, humor style, communication preferences. Adapts to D's preferred interaction style. Different "faces" possible per channel (professional on Slack, casual on Telegram).

Both update through the meta-memory consolidation process. The agent builds understanding of itself alongside understanding of you.

### 4. Prolonged Operation & Checkpoints

**Checkpoint Updates (via any channel, Telegram primary):**
```
You (6:30 AM): "Refactor the auth module in GUTTERS. Use the new token rotation pattern."
Drofbot: "Starting auth refactor. I'll update you at 25%, 50%, 75%, and on completion."

[🔄 40%] Found 8 files referencing the old JWT logic. Refactoring to use the new
token rotation pattern we discussed on Feb 3rd. No breaking changes so far.

[✅ Complete] Auth refactor done. 12 files modified, 0 tests broken. Changes saved
to branch `feature/auth-refactor`. Want me to push it?
```

- Enhanced compaction: Before context window compression, Drofbot writes critical context to episodic and procedural memory banks
- Session continuity: Retrieved from structured memory, not lost to compaction
- Cross-session awareness: Pick up any thread from any past conversation on any channel
- Multiple tasks queued and executed serially via Lane Queue
- Multi-step tasks get execution plans, adaptive on failure
- Interruptible from any channel: "Pause that. Different priority."

### 5. GUTTERS Integration (via MCP)

- GUTTERS runs as an MCP server accessible to the Hands Worker
- Drofbot can query natal chart data, current transits, numerology, cardology readings
- Daily briefings incorporate cosmic timing
- Task prioritization informed by metaphysical frameworks
- Eventually: the "Solo Leveling Quest Dashboard" where real tasks get assigned cosmic significance and optimal timing

---

## Restructured Project Layout (Target)

The existing OpenClaw structure is reorganized into a Brain/Hands/Channels/Shared hierarchy. **All existing functionality is preserved** — files are moved and enhanced, not deleted.

```
drofbot/
├── src/
│   ├── brain/                        # The Cloud Core (NEW organization)
│   │   ├── agent-runner/             # LLM orchestration (from src/agents/)
│   │   │   ├── runner.ts             # Main agent loop (from pi-embedded-runner/run.ts)
│   │   │   ├── attempt.ts            # Single inference attempt (from run/attempt.ts)
│   │   │   ├── system-prompt.ts      # Dynamic prompt assembly
│   │   │   ├── prompt-params.ts      # Prompt parameters
│   │   │   ├── context-guard.ts      # Token management
│   │   │   ├── compaction.ts         # Enhanced compaction with memory flush
│   │   │   ├── lanes.ts              # Lane queue
│   │   │   ├── bootstrap.ts          # Bootstrap files loading
│   │   │   └── memory-integration.ts # Memory in agent loop
│   │   ├── memory/                   # Hierarchical Brain (ENHANCED)
│   │   │   ├── banks/                # NEW: Four memory banks
│   │   │   │   ├── episodic.ts
│   │   │   │   ├── semantic.ts
│   │   │   │   ├── procedural.ts
│   │   │   │   └── relational.ts
│   │   │   ├── meta/                 # NEW: Meta-memory layer
│   │   │   │   ├── consolidator.ts
│   │   │   │   ├── pattern-detector.ts
│   │   │   │   └── promoter.ts
│   │   │   ├── classifier.ts         # NEW: Memory classification
│   │   │   ├── retriever.ts          # NEW: Multi-bank retrieval
│   │   │   ├── manager.ts            # EXISTING: from src/memory/
│   │   │   ├── internal.ts           # EXISTING
│   │   │   ├── sync-memory-files.ts  # EXISTING
│   │   │   ├── memory-schema.ts      # EXISTING
│   │   │   └── index.ts              # NEW: Unified interface
│   │   ├── identity/                 # NEW: Agent self-model
│   │   │   ├── soul.ts
│   │   │   ├── face.ts
│   │   │   └── evolution.ts
│   │   ├── router/                   # NEW: Skill routing (cloud vs local)
│   │   │   ├── classifier.ts
│   │   │   └── queue.ts
│   │   └── cron/                     # ENHANCED (from src/cron/)
│   │       ├── consolidation.ts      # NEW
│   │       ├── briefing.ts           # NEW
│   │       ├── heartbeat.ts          # NEW
│   │       └── (existing cron files)
│   │
│   ├── hands/                        # NEW: The Local Worker
│   │   ├── worker.ts
│   │   ├── heartbeat.ts
│   │   ├── skills/
│   │   │   ├── filesystem.ts
│   │   │   ├── shell.ts
│   │   │   ├── browser.ts
│   │   │   ├── code.ts
│   │   │   └── app-control.ts
│   │   └── mcp/
│   │       └── gutters.ts
│   │
│   ├── channels/                     # ALL CHANNELS RETAINED (reorganized)
│   │   ├── shared/                   # Shared routing logic (from src/channels/)
│   │   ├── telegram/                 # PRIMARY (from src/telegram/)
│   │   ├── discord/                  # RETAINED (from src/discord/)
│   │   ├── slack/                    # RETAINED (from src/slack/)
│   │   ├── signal/                   # RETAINED (from src/signal/)
│   │   ├── imessage/                 # RETAINED (from src/imessage/)
│   │   └── web/                      # RETAINED: WhatsApp Web (from src/web/)
│   │
│   ├── shared/                       # Shared utilities (reorganized)
│   │   ├── config/                   # From src/config/
│   │   ├── database/                 # NEW: Supabase client + migrations
│   │   ├── llm/                      # LLM routing (from src/agents/)
│   │   ├── tools/                    # Tool framework (from src/agents/)
│   │   ├── sessions/                 # From src/sessions/
│   │   └── routing/                  # From src/routing/
│   │
│   ├── gateway/                      # Kept in place (from src/gateway/)
│   ├── cli/                          # Kept in place
│   ├── commands/                     # Kept in place
│   ├── infra/                        # Kept in place
│   ├── media/                        # Kept in place
│   ├── auto-reply/                   # Kept in place
│   └── terminal/                     # Kept in place
│
├── Swabble/                          # RETAINED, rebranded wake word
├── apps/                             # ALL RETAINED, rebranded
│   ├── macos/                        # macOS menubar → Drofbot
│   ├── ios/                          # iOS → Drofbot
│   ├── android/                      # Android → Drofbot
│   └── shared/                       # Shared native code
├── extensions/                       # ALL RETAINED
├── skills/                           # ALL RETAINED
├── ui/                               # RETAINED → Drofbot Dashboard
├── vendor/a2ui/                      # RETAINED
│
├── workspace/                        # Agent workspace (bootstrap files)
│   ├── AGENTS.md
│   ├── SOUL.md
│   ├── TOOLS.md
│   ├── IDENTITY.md
│   └── memory/
│       └── MEMORY.md
│
├── docker/                           # NEW: Deployment
│   ├── docker-compose.yml
│   ├── Dockerfile.brain
│   └── Dockerfile.hands
│
├── docs/                             # Rebranded
├── scripts/                          # Build/utility
├── test/                             # Test suite
├── packages/                         # Shared packages
├── patches/                          # pnpm patches
├── drofbot.json                      # Config (replaces openclaw.json)
├── package.json                      # Rebranded
├── AGENTS.md                         # Rebranded
├── .env.example                      # Expanded
└── README.md                         # Drofbot docs
```

---

## Technical Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Language** | TypeScript | OpenClaw-native, MCP-native, AI-ecosystem dominant |
| **Runtime** | Node ≥22 | OpenClaw requirement, LTS |
| **Channels** | grammY, discord.js, Baileys, etc. | All inherited, battle-tested |
| **Voice** | Swabble (Swift 6.2) | Wake-word daemon, rebranded |
| **Native Apps** | Swift (macOS/iOS), Kotlin (Android) | All inherited, rebranded |
| **Database** | Self-hosted Supabase (PostgreSQL + pgvector) | Structured memory + vector search |
| **Memory (base)** | QMD + Markdown | Inherited, retained as backup layer |
| **Model Routing** | pi-ai | Multi-provider with failover |
| **Protocol** | MCP | Tool integrations including GUTTERS |
| **Worker Comms** | WebSocket | Brain↔Hands real-time |
| **Deployment** | Docker Compose | Brain on VPS, Hands on local |
| **Task Queue** | PostgreSQL-backed | Persistent, crash-resilient |
| **Build** | tsdown, pnpm | Inherited |
| **Config** | JSON5 + Zod | Inherited |
| **UI** | Control UI → Drofbot Dashboard | Inherited, rebranded |

---

## Build Roadmap

### Phase 1: Rebrand & Restructure (Week 1)
- Fork OpenClaw
- **Rebrand**: OpenClaw → Drofbot throughout (config, env vars, package identity, CLI, native apps, Swabble wake word, UI, README, docs)
- **Restructure**: Reorganize `src/` into `brain/`, `hands/`, `channels/`, `shared/` using `git mv`
- Update all import paths
- Create Drofbot workspace bootstrap files (SOUL.md, IDENTITY.md, etc.)
- Set up Supabase (local Docker for dev)
- Create database schema for memory banks and task queue
- Add Docker Compose for Brain deployment
- Verify everything builds and all channels work

### Phase 2: Memory Foundation (Week 2)
- Implement four memory banks in Supabase
- Build classifier and multi-bank retriever
- Wire into agent runner alongside existing QMD
- Keep markdown + QMD as base layer

### Phase 3: Brain/Hands Split (Week 3)
- Extract Brain service for VPS deployment
- Build Worker WebSocket client for local machine
- Heartbeat protocol, task queue, checkpoint updates
- Wire native apps into Hands architecture
- Docker Compose for full deployment

### Phase 4: Identity & Intelligence (Week 4)
- Dual identity system (soul + face)
- Meta-memory consolidation cron
- Core identity promotion
- Prolonged operation with progress reporting
- Per-channel face adaptation

### Phase 5: GUTTERS & Beyond (Week 5+)
- GUTTERS MCP server integration
- Daily briefing system with cosmic timing
- Quest Dashboard concepts
- Enhanced Drofbot Dashboard
- Enhanced native app features
- Community skill curation

---

## The North Star

When someone asks "What is Drofbot?" the answer is:

**"It's a sovereign personal intelligence that lives in the cloud and reaches into my machine. It knows who I am — not just my preferences, but my patterns, my projects, my goals, my cosmic timing. It has its own evolving identity and it learns alongside me. It manages tasks while I sleep, updates me on progress, and integrates ancient wisdom systems with modern execution. I forked the messaging plumbing from OpenClaw, but the brain, the memory, the identity, and the soul — that's mine."**

That's not a fork story. That's an origin story.
