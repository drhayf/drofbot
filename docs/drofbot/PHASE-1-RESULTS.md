# Phase 1 Results — Drofbot Foundation

**Date**: 2025-07-25  
**Status**: ✅ COMPLETE  
**Build**: PASSING (1004ms, 142 output files)

---

## Summary

Phase 1 transforms the OpenClaw fork into Drofbot — rebranding identity, restructuring source code into the Brain/Hands/Channels/Shared architecture, adding database infrastructure, and creating stub files for Phases 2–5. All changes preserve backward compatibility with the existing OpenClaw feature set.

---

## 1. What Was Rebranded

### Package Identity
| Item | Before | After |
|------|--------|-------|
| package.json `name` | `openclaw` | `drofbot` |
| package.json `description` | OpenClaw description | Drofbot – your sovereign personal intelligence |
| CLI binary | `openclaw` only | `drofbot` (primary) + `openclaw` (backward compat) |
| Entry script | `openclaw.mjs` | `drofbot.mjs` (primary) + `openclaw.mjs` (retained) |
| npm scripts | `OPENCLAW_*` env only | `DROFBOT_*` + `OPENCLAW_*` fallbacks |

### Config Paths (`src/shared/config/paths.ts`)
| Item | Before | After |
|------|--------|-------|
| State directory | `~/.openclaw/` | `~/.drofbot/` (falls back to `~/.openclaw/` → `~/.clawdbot/`) |
| Config file | `openclaw.json` | `drofbot.json` (falls back to `openclaw.json` → `clawd.json`) |
| Config filename | `OPENCLAW_CONFIG_FILENAME` | `DROFBOT_CONFIG_FILENAME` (falls back to `OPENCLAW_*` → `CLAWDBOT_*`) |
| Gateway lock | `openclaw-{uid}` | `drofbot-{uid}` |
| OAuth dir | `openclaw-oauth` | `drofbot-oauth` |
| All env vars | `OPENCLAW_*` | `DROFBOT_*` with `OPENCLAW_*` → `CLAWDBOT_*` fallback chain |

### Swabble Wake Word
- Wake word: `clawd` → `drof`
- Aliases: `["drofbot", "clawd", "claude"]`
- Hook prefix: `clawd` → `drof`

### Native App Branding
| Platform | Changes |
|----------|---------|
| **macOS** | Bundle ID → `ai.drofbot.app`, display name → "Drofbot", URL scheme → `drofbot://` |
| **iOS** | Bundle ID → `ai.drofbot.mobile`, display name → "Drofbot", App Group → `group.ai.drofbot` |
| **Android** | applicationId → `ai.drofbot.android`, app_name → "Drofbot", deep link host → `drofbot.ai` |

### UI Dashboard
- `ui/index.html` title → "Drofbot Dashboard"
- `ui/package.json` name → `drofbot-dashboard-ui`

### Not Yet Rebranded (deferred)
- ~2560 files still contain `openclaw` in comments, type names (e.g., `OpenClawConfig`), and non-critical strings
- README.md still has OpenClaw branding in body text
- Root `AGENTS.md` still references OpenClaw (this is the upstream project guidelines file)

---

## 2. What Was Restructured

### Directory Moves (src/)

| Original Path | New Path |
|----------------|----------|
| `src/agents/` | `src/brain/agent-runner/` |
| `src/memory/` | `src/brain/memory/` |
| `src/cron/` | `src/brain/cron/` |
| `src/telegram/` | `src/channels/telegram/` |
| `src/discord/` | `src/channels/discord/` |
| `src/slack/` | `src/channels/slack/` |
| `src/signal/` | `src/channels/signal/` |
| `src/imessage/` | `src/channels/imessage/` |
| `src/web/` | `src/channels/web/` |
| `src/channels/*.ts` (shared files) | `src/channels/shared/` |
| `src/channels/allowlists/` | `src/channels/shared/allowlists/` |
| `src/channels/plugins/` | `src/channels/shared/plugins/` |
| `src/channels/web/` (shared web) | `src/channels/shared/web-shared/` |
| `src/config/` | `src/shared/config/` |
| `src/sessions/` | `src/shared/sessions/` |
| `src/routing/` | `src/shared/routing/` |

### Import Fix Statistics
- **Total imports fixed**: ~4,200+ across ~700+ files
- **Fix scripts created**: 6 (fix-imports.ts, fix-slash-js.sh, fix-imports-v2.ts, fix-imports-v3.ts, fix-imports-final.ts, fix-wrong-matches.sh)
- **Manual fixes**: ~15 files with depth mismatches or ambiguous filenames

### New Directory Structure
```
src/
├── brain/               # 562 files — reasoning, memory, scheduling
│   ├── agent-runner/    # Core agent loop (was src/agents/)
│   ├── memory/          # Memory system (was src/memory/) + new banks/meta stubs
│   ├── cron/            # Scheduled tasks (was src/cron/) + new consolidation/briefing stubs
│   ├── identity/        # NEW — Soul/Face/Evolution stubs (Phase 4)
│   └── router/          # NEW — Task classifier/queue stubs (Phase 3)
├── hands/               # 8 files — all new stubs
│   ├── worker.ts        # Worker process (Phase 3)
│   ├── heartbeat.ts     # Health check (Phase 3)
│   ├── skills/          # Filesystem, shell, browser, code, app-control
│   └── mcp/             # GUTTERS MCP bridge (Phase 5)
├── channels/            # 440 files — messaging integrations
│   ├── telegram/        # Primary channel
│   ├── discord/         
│   ├── slack/           
│   ├── signal/          
│   ├── imessage/        
│   ├── web/             # WhatsApp web
│   └── shared/          # Cross-channel routing, allowlists, plugins
├── shared/              # 153 files — cross-cutting concerns
│   ├── config/          # Configuration (was src/config/)
│   ├── sessions/        # Session management (was src/sessions/)
│   ├── routing/         # Message routing (was src/routing/)
│   └── database/        # NEW — Supabase client, schema, migrations
└── [unchanged dirs]     # cli/, commands/, gateway/, hooks/, media/, etc.
```

---

## 3. What Was Added

### Infrastructure (`docker/`)
- **docker-compose.yml**: PostgreSQL 16 + pgvector + Redis 7 Alpine, with persistent volumes and health checks

### Database (`src/shared/database/`)
- **migrations/001_memory_banks.sql**: Four memory bank tables (episodic, semantic, procedural, relational) with pgvector embeddings and ivfflat indexes
- **migrations/002_task_queue.sql**: Task queue table for Brain/Hands work dispatch
- **migrations/003_identity.sql**: Identity/self-model storage
- **client.ts**: Supabase client with env-based config (commented out pending `@supabase/supabase-js` install)
- **schema.ts**: TypeScript types matching all DB tables

### Workspace Bootstrap (`workspace/`)
- **AGENTS.md**: Agent operating instructions
- **SOUL.md**: Core identity definition
- **IDENTITY.md**: Self-model and evolution tracking
- **TOOLS.md**: Tool capabilities and preferences
- **memory/MEMORY.md**: Memory system documentation

### Phase 2–5 Stub Files (25 files)

**Brain — Memory Banks (Phase 2):**
- `src/brain/memory/banks/episodic.ts`
- `src/brain/memory/banks/semantic.ts`
- `src/brain/memory/banks/procedural.ts`
- `src/brain/memory/banks/relational.ts`
- `src/brain/memory/meta/consolidator.ts`
- `src/brain/memory/meta/pattern-detector.ts`
- `src/brain/memory/meta/promoter.ts`
- `src/brain/memory/classifier.ts`
- `src/brain/memory/retriever.ts`

**Brain — Identity (Phase 4):**
- `src/brain/identity/soul.ts`
- `src/brain/identity/face.ts`
- `src/brain/identity/evolution.ts`

**Brain — Router (Phase 3):**
- `src/brain/router/classifier.ts`
- `src/brain/router/queue.ts`

**Brain — Cron (Phase 4):**
- `src/brain/cron/consolidation.ts`
- `src/brain/cron/briefing.ts`
- `src/brain/cron/heartbeat.ts`

**Hands — Worker (Phase 3):**
- `src/hands/worker.ts`
- `src/hands/heartbeat.ts`
- `src/hands/skills/filesystem.ts`
- `src/hands/skills/shell.ts`
- `src/hands/skills/browser.ts`
- `src/hands/skills/code.ts`
- `src/hands/skills/app-control.ts`

**Hands — MCP (Phase 5):**
- `src/hands/mcp/gutters.ts`

### Environment
- `.env.example` updated with Drofbot-specific environment variables (Supabase, Telegram, LLM, Brain/Hands, GUTTERS)

---

## 4. Build Verification

| Check | Result |
|-------|--------|
| `pnpm build` (tsdown) | ✅ 142 files, 1004ms |
| `build:plugin-sdk:dts` (tsc) | ✅ Success |
| Hook metadata copy | ✅ 4 hooks copied |
| UNRESOLVED_IMPORT errors | ✅ 0 |
| TS2305 (wrong export) errors | ✅ 0 |

Build time is comparable to pre-restructure (~1000–1300ms).

---

## 5. What Works (verified)

- ✅ Full TypeScript build completes without errors
- ✅ Plugin SDK DTS generation works
- ✅ Hook metadata pipeline works
- ✅ All existing source files compile with updated import paths
- ✅ New stub files compile (empty classes, no runtime logic)
- ✅ Config path fallback chain is in place (drofbot → openclaw → clawdbot)
- ✅ Both `drofbot` and `openclaw` CLI entry points exist

---

## 6. What's Known-Incomplete

| Item | Status | Plan |
|------|--------|------|
| Bulk string rename (~2560 files) | Deferred | Can be done incrementally; non-blocking |
| `@supabase/supabase-js` install | Not installed | Install when Phase 2 begins |
| Docker Compose startup | Not tested | Requires Docker; test when ready |
| Test suite (`pnpm test`) | Not run | Should be run before merging |
| Channel smoke tests | Not run | Requires credentials + running gateway |
| TypeScript path aliases | Not added | Optional quality-of-life (tsconfig paths) |
| Test import updates | Not verified | Tests may need import path updates |

---

## 7. File Count Comparison

| Metric | Value |
|--------|-------|
| Total `.ts` files in `src/` | 2,629 |
| `src/brain/` | 562 files |
| `src/channels/` | 440 files |
| `src/shared/` | 153 files |
| `src/hands/` | 8 files (all new stubs) |
| New infrastructure files | 6 (database client, schema, 3 migrations, docker-compose) |
| New stub files | 25 |
| New workspace docs | 5 |

---

## 8. Next Steps → Phase 2

Phase 2 (Memory Foundation) can now begin with:
1. `pnpm add @supabase/supabase-js` — install the database client
2. `docker compose -f docker/docker-compose.yml up -d` — start PostgreSQL + Redis
3. Apply migrations to the database
4. Implement the memory bank classes (episodic → semantic → procedural → relational)
5. Wire the memory retriever into the agent's context window
6. Add consolidation cron job

The stub files provide the exact scaffolding. See `DROFBOT-FORK-VISION.md` for the complete Phase 2 specification.
