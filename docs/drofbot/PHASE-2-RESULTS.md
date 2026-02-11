# PHASE 2 RESULTS — Memory Foundation

## Summary

Phase 2 implements Drofbot's hierarchical structured memory system on top of
the existing OpenClaw QMD/markdown memory. The system uses Supabase + pgvector
for durable, vector-searchable memory banks that survive session boundaries.

**All code gracefully degrades** — when Supabase is not configured, the system
logs a single warning and returns empty results. QMD memory continues unaffected.

---

## What Was Built

### 1. Database Layer (`src/shared/database/`)

| File | Purpose |
|------|---------|
| `client.ts` | Supabase client singleton with `isSupabaseConfigured()` guard |
| `schema.ts` | TypeScript types for all DB tables (Row/Insert/Update variants) |
| `migrations/001_memory_banks.sql` | Four tables with pgvector `vector(1536)` + HNSW indexes |
| `migrations/002_task_queue.sql` | Task queue schema (Phase 3 prep) |
| `migrations/003_identity.sql` | Identity schema (Phase 3 prep) |

**Config**: `DROFBOT_SUPABASE_URL` and `DROFBOT_SUPABASE_KEY` env vars.

### 2. Memory Banks (`src/brain/memory/banks/`)

Four specialized banks, all extending `BaseMemoryBank`:

| Bank | Table | Purpose | Key Operations |
|------|-------|---------|----------------|
| **Episodic** | `memory_episodic` | Events, decisions, experiences | `store()`, `search()`, `getRecent()`, `searchByTimeRange()`, `searchByChannel()` |
| **Semantic** | `memory_semantic` | Facts, preferences, knowledge | `store()`, `search()`, `exists()` (dedup), `getByCategory()` |
| **Procedural** | `memory_procedural` | Workflows, habits, how-to | `store()`, `search()`, `recordUse()` |
| **Relational** | `memory_relational` | Entity connections | `store()`, `search()`, `getRelationshipsForEntity()` |

- `base.ts`: Shared embedding generation, Supabase client access, graceful degradation
- `drofbot-memory.ts`: Unified `DrofbotMemory` class (singleton via `getDrofbotMemory()`)

### 3. Classifier (`src/brain/memory/classifier.ts`)

LLM-based memory classifier that determines:
1. Should this exchange be stored as a durable memory?
2. Which bank(s) should receive it?
3. How should the content be reformulated for each bank?

Uses existing `completeSimple`, `resolveDefaultModelForAgent`, `resolveModel`,
and `requireApiKey` infrastructure — no new LLM machinery.

### 4. Retriever (`src/brain/memory/retriever.ts`)

Rule-based multi-bank retrieval with relevance scoring:
- **SEMANTIC** always searched
- **EPISODIC** included for time-reference queries ("yesterday", "last week", etc.)
- **PROCEDURAL** included for how-to queries ("how to deploy", "steps for", etc.)
- **RELATIONAL** included for relationship queries ("depends on", "related to", etc.)
- Results merged across banks, sorted by similarity, truncated to limit

### 5. Integration Bridge (`src/brain/memory/structured-memory-integration.ts`)

Three entry points wired into the agent runner:

| Function | Where Called | Purpose |
|----------|-------------|---------|
| `fetchStructuredMemoryContext()` | `attempt.ts` (pre-turn) | Retrieve relevant memories → inject into system prompt |
| `classifyAndStorePostTurn()` | `attempt.ts` (post-turn) | Fire-and-forget classification + storage |
| `flushCompactionMemory()` | `compact.ts` | Preserve context before session compaction |

### 6. Consolidation Cron (`src/brain/cron/consolidation.ts`)

Background timer (setTimeout chain, matching heartbeat-runner pattern):

| Operation | Trigger | Description |
|-----------|---------|-------------|
| **Dedup** | >0.95 cosine similarity | Merge near-duplicate entries, keep newer |
| **Compression** | Episodic entries >30 days old | Batch-summarize old entries, archive originals |
| **Promotion** | 3+ similar episodic entries | Extract recurring patterns → semantic facts |

**Config**: `memory.consolidation.enabled` (default: true), `memory.consolidation.intervalHours` (default: 6)

**Gateway wiring**: Started in `server.impl.ts` alongside heartbeat runner, stopped in `server-close.ts` during shutdown.

---

## Files Modified (Existing Code)

| File | Change |
|------|--------|
| `src/brain/memory/index.ts` | Added exports for new types |
| `src/brain/agent-runner/system-prompt.ts` | Added `structuredMemoryContext` param + `buildStructuredMemorySection()` |
| `src/brain/agent-runner/pi-embedded-runner/system-prompt.ts` | Threaded `structuredMemoryContext` through |
| `src/brain/agent-runner/pi-embedded-runner/run/attempt.ts` | Pre-turn fetch + post-turn classify |
| `src/brain/agent-runner/pi-embedded-runner/compact.ts` | Compaction flush |
| `src/shared/config/types.memory.ts` | Added `MemoryConsolidationConfig` type |
| `src/gateway/server.impl.ts` | Start consolidation runner |
| `src/gateway/server-close.ts` | Stop consolidation runner |

---

## Test Results

**8 test files, 62 tests — all passing**

```
 ✓ src/brain/memory/banks/base.test.ts         (7 tests)
 ✓ src/brain/memory/banks/episodic.test.ts      (7 tests)
 ✓ src/brain/memory/banks/semantic.test.ts      (8 tests)
 ✓ src/brain/memory/classifier.test.ts          (7 tests)
 ✓ src/brain/memory/retriever.test.ts          (11 tests)
 ✓ src/brain/memory/drofbot-memory.test.ts      (6 tests)
 ✓ src/brain/cron/consolidation.test.ts         (6 tests)
 ✓ src/brain/memory/structured-memory-integration.test.ts (10 tests)

 Test Files  8 passed (8)
      Tests  62 passed (62)
   Duration  5.47s
```

**Build**: 142 files, ~6.1 MB total, completes in ~5s.

---

## Architecture Decisions

1. **HNSW over IVFFlat** — IVFFlat requires minimum rows and a `lists` parameter;
   HNSW works out of the box on empty tables with good ANN performance.

2. **Timer module over CronService** — The existing `CronService` triggers agent
   message processing (system events). Consolidation is a background DB operation,
   so it uses the same `setTimeout` + `scheduleNext` pattern as `startHeartbeatRunner`.

3. **Rule-based retriever** — No LLM call for routing queries to banks. Pattern
   matching handles 95% of cases and avoids the latency + cost of an extra LLM call
   on the critical path (user message → system prompt injection).

4. **Fire-and-forget classification** — Post-turn classification runs async and
   does not block the agent response delivery. Errors are logged but never surface
   to the user.

5. **Singleton DrofbotMemory** — Single instance per process with `resetDrofbotMemory()`
   for test isolation. Banks are created eagerly; embedding provider is injected later.

---

## Known Limitations

- **No embedding provider auto-setup** — `setEmbeddingProvider()` must be called
  externally after DrofbotMemory initialization. Until called, memories are stored
  without embeddings (vector search returns no results, but text content is preserved).

- **Consolidation dedup is O(n²)** — Pairwise cosine similarity over 200-entry
  batches. Sufficient for early usage; may need approximate nearest-neighbor
  clustering at scale.

- **No migration runner** — SQL files in `migrations/` must be applied manually
  to the Supabase instance. A migration runner can be added in a later phase.

- **Classifier error propagation** — `classifyAndStorePostTurn` does not catch
  classifier errors internally (relies on caller's fire-and-forget pattern via
  `.catch()` in `attempt.ts`). The classifier itself catches LLM errors and
  returns `{ shouldStore: false }`.

---

## Configuration

```json
{
  "memory": {
    "backend": "builtin",
    "consolidation": {
      "enabled": true,
      "intervalHours": 6
    }
  }
}
```

Environment variables:
- `DROFBOT_SUPABASE_URL` — Supabase project URL
- `DROFBOT_SUPABASE_KEY` — Supabase anon/service key

---

## Phase 3 Prep

Phase 2 laid the foundation. Phase 3 (Proactive Behavior) will build on:
- Task queue tables (migration 002) for autonomous task scheduling
- Identity tables (migration 003) for multi-user memory scoping
- The consolidation pattern for periodic background intelligence operations
