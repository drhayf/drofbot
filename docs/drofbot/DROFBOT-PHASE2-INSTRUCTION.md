# DROFBOT: Phase 2 — Memory Foundation (Surgical Instruction)

> **CONTEXT**: Phase 1 is complete. Drofbot is rebranded, restructured into Brain/Hands/Channels/Shared, builds cleanly (142 files, ~1s), and has Supabase schema + 25 stub files ready. This instruction defines the EXACT steps for Phase 2: Memory Foundation. Read `DROFBOT-FORK-VISION.md` (specifically the "Hierarchical Brain" section) before starting.

> **PHILOSOPHY**: The existing OpenClaw memory system (markdown files + QMD hybrid search) is RETAINED as the base layer. We are adding a structured Supabase layer ON TOP of it. The two systems work together — QMD handles human-readable markdown memory, Supabase handles structured multi-bank memory with vector search. The agent's context window draws from BOTH. Nothing existing is replaced.

---

## CRITICAL CONSTRAINTS

1. **The existing memory system is NOT replaced.** `src/brain/memory/manager.ts`, `internal.ts`, `sync-memory-files.ts`, and the QMD sidecar all continue to function. We ADD to them.

2. **REUSE EVERYTHING THAT EXISTS — THIS IS NON-NEGOTIABLE.** OpenClaw is a 172k+ line codebase with years of engineering. Before writing ANY new function, class, or utility, you MUST search the existing codebase to see if that capability already exists. If it does, import and use it — do not create a parallel version. This applies to EVERYTHING:
   - **Embeddings**: OpenClaw already generates embeddings. Find the existing embedding pipeline (check `extensions/memory-core/`, `src/brain/memory/manager.ts`, and the QMD system). Use it. Do NOT create a new embedding function.
   - **Vector search**: OpenClaw already does vector similarity search (BM25 + vector hybrid in memory-core). Study how it works. Wire the new banks into the same patterns.
   - **LLM calls**: OpenClaw already has patterns for making LLM calls for non-chat purposes. Find them (check the agent runner, model routing in `src/shared/llm/`). Use the same patterns for the classifier.
   - **Tool registration**: OpenClaw already registers tools via `src/shared/tools/registry.ts`. Register new memory tools using the SAME pattern. Do not create a new tool system.
   - **Cron scheduling**: OpenClaw already has a cron system in `src/brain/cron/`. Register the consolidation job using the SAME system. Do not create a new scheduler.
   - **Config/validation**: OpenClaw uses JSON5 + Zod. Any new config (like memory settings) should use the SAME config system and extend the SAME schema.
   - **Session context**: OpenClaw tracks sessions in `src/shared/sessions/`. Use the existing session infrastructure for memory context.
   - **Logging**: Use whatever logging OpenClaw already uses. Don't introduce a new logger.
   - **Error handling**: Follow the existing error handling patterns.
   
   **The rule is simple: before you write it, grep for it.** If OpenClaw has it, use it. If OpenClaw has something close, extend it. Only write net-new code for genuinely new capabilities (the bank storage logic, the classifier prompt, the retriever routing).

3. **One commit per logical operation.** Same discipline as Phase 1.

4. **`pnpm build` must pass after every step.** No exceptions.

5. **Test after every feature addition.** Write tests for new memory bank operations as you build them.

---

## PRE-FLIGHT CHECKLIST

Before beginning, confirm:
- [ ] Phase 1 branch is merged or you are continuing on the same branch
- [ ] `pnpm build` passes
- [ ] You have read `DROFBOT-FORK-VISION.md` — specifically the "Hierarchical Brain (Memory Architecture)" section
- [ ] You have read and understood the existing memory system:
  - [ ] `src/brain/memory/manager.ts` — how OpenClaw indexes and syncs memory
  - [ ] `src/brain/memory/internal.ts` — internal memory operations
  - [ ] `src/brain/memory/memory-schema.ts` — existing embedding cache schema
  - [ ] `extensions/memory-core/` — the default memory search plugin (BM25 + vector)
  - [ ] `src/brain/agent-runner/memory-integration.ts` — how memory is wired into the agent loop
  - [ ] `src/shared/tools/registry.ts` — the existing memory_search tool registration
- [ ] You understand: the new system AUGMENTS the existing one, it does not replace it

---

## STEP 0: TEST SUITE REPAIR (Phase 1 Debt)

**Goal**: Run the full test suite, fix all broken imports from the Phase 1 restructure, and establish a green baseline before adding new code.

### 0a. Run Tests and Assess Damage

```bash
pnpm test 2>&1 | head -200
```

Categorize failures into:
1. **Import path failures** — tests referencing old paths like `../agents/`, `../config/`, `../telegram/`, etc.
2. **String assertion failures** — tests checking for "OpenClaw" strings that are now "Drofbot"
3. **Genuine logic failures** — anything that suggests the restructure broke actual behavior

### 0b. Fix Import Paths in Tests

The `test/` directory was not restructured in Phase 1. Tests will still import from old paths.

**Strategy:**
```bash
# Find all broken imports in test files
grep -rn "from.*['\"].*src/agents/" test/ --include="*.ts"
grep -rn "from.*['\"].*src/config/" test/ --include="*.ts"
grep -rn "from.*['\"].*src/telegram/" test/ --include="*.ts"
grep -rn "from.*['\"].*src/memory/" test/ --include="*.ts"
grep -rn "from.*['\"].*src/sessions/" test/ --include="*.ts"
grep -rn "from.*['\"].*src/routing/" test/ --include="*.ts"
grep -rn "from.*['\"].*src/cron/" test/ --include="*.ts"
grep -rn "from.*['\"].*src/discord/" test/ --include="*.ts"
grep -rn "from.*['\"].*src/slack/" test/ --include="*.ts"
grep -rn "from.*['\"].*src/signal/" test/ --include="*.ts"
grep -rn "from.*['\"].*src/web/" test/ --include="*.ts"
grep -rn "from.*['\"].*src/channels/" test/ --include="*.ts"
```

Also check colocated test files (OpenClaw uses `*.test.ts` files next to source):
```bash
find src/ -name "*.test.ts" | head -50
```

These colocated tests should have been moved with their source files in Phase 1 and may already work. Verify.

Update all import paths using the same mapping from the Phase 1 results:
- `src/agents/` → `src/brain/agent-runner/`
- `src/memory/` → `src/brain/memory/`
- `src/cron/` → `src/brain/cron/`
- `src/config/` → `src/shared/config/`
- `src/sessions/` → `src/shared/sessions/`
- `src/routing/` → `src/shared/routing/`
- `src/telegram/` → `src/channels/telegram/`
- `src/discord/` → `src/channels/discord/`
- `src/slack/` → `src/channels/slack/`
- `src/signal/` → `src/channels/signal/`
- `src/imessage/` → `src/channels/imessage/`
- `src/web/` → `src/channels/web/`
- `src/channels/*.ts` (shared) → `src/channels/shared/`

### 0c. Fix String Assertions

Tests that assert on output strings containing "OpenClaw" or "openclaw" may need updating:
```bash
grep -rn "openclaw\|OpenClaw\|OPENCLAW" test/ --include="*.ts" -l
```

Update assertions to expect "Drofbot"/"drofbot"/"DROFBOT" where the corresponding source code was rebranded. Leave alone where backward compat aliases are tested.

### 0d. Verify Green Suite

```bash
pnpm test
```

Document:
- Total tests run
- Tests passing
- Tests failing (with reasons — should be 0, or known/acceptable)
- Tests skipped

**All import-related failures must be fixed. If any genuine logic failures exist from Phase 1, fix them now before proceeding.**

**Commit**: `fix: repair test suite imports and assertions after Phase 1 restructure`

---

## STEP 1: INSTALL DEPENDENCIES AND START INFRASTRUCTURE

**Goal**: Get Supabase running and accessible from the Drofbot codebase.

### 1a. Install Supabase Client

```bash
pnpm add @supabase/supabase-js
```

### 1b. Uncomment and Configure Database Client

The Phase 1 stub at `src/shared/database/client.ts` has the Supabase client commented out. Uncomment and implement:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './schema.js'

let client: SupabaseClient<Database> | null = null

export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client

  const url = process.env.DROFBOT_SUPABASE_URL
    ?? process.env.OPENCLAW_SUPABASE_URL  // backward compat
  const key = process.env.DROFBOT_SUPABASE_SERVICE_KEY
    ?? process.env.OPENCLAW_SUPABASE_SERVICE_KEY
    ?? process.env.DROFBOT_SUPABASE_ANON_KEY
    ?? process.env.OPENCLAW_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase not configured. Set DROFBOT_SUPABASE_URL and DROFBOT_SUPABASE_SERVICE_KEY (or ANON_KEY) in .env'
    )
  }

  client = createClient<Database>(url, key)
  return client
}

export function isSupabaseConfigured(): boolean {
  return !!(
    (process.env.DROFBOT_SUPABASE_URL ?? process.env.OPENCLAW_SUPABASE_URL)
    && (process.env.DROFBOT_SUPABASE_SERVICE_KEY
      ?? process.env.OPENCLAW_SUPABASE_SERVICE_KEY
      ?? process.env.DROFBOT_SUPABASE_ANON_KEY
      ?? process.env.OPENCLAW_SUPABASE_ANON_KEY)
  )
}
```

**Important**: The memory system must gracefully degrade when Supabase is not configured. The existing QMD/markdown memory should continue to work independently. Supabase is an enhancement layer, not a hard dependency.

### 1c. Update Database Schema Types

Verify `src/shared/database/schema.ts` matches the migration SQL from Phase 1. The types should include:

```typescript
export interface Database {
  public: {
    Tables: {
      memory_episodic: { Row: EpisodicMemory; Insert: EpisodicMemoryInsert; Update: EpisodicMemoryUpdate }
      memory_semantic: { Row: SemanticMemory; Insert: SemanticMemoryInsert; Update: SemanticMemoryUpdate }
      memory_procedural: { Row: ProceduralMemory; Insert: ProceduralMemoryInsert; Update: ProceduralMemoryUpdate }
      memory_relational: { Row: RelationalMemory; Insert: RelationalMemoryInsert; Update: RelationalMemoryUpdate }
      task_queue: { Row: TaskQueueEntry; Insert: TaskQueueInsert; Update: TaskQueueUpdate }
      identity: { Row: IdentityEntry; Insert: IdentityInsert; Update: IdentityUpdate }
    }
  }
}
```

Ensure each table type includes all columns from the migration SQL, with appropriate TypeScript types (UUID as string, TIMESTAMPTZ as string, JSONB as Record<string, unknown>, vector as number[], etc.).

### 1d. Start Infrastructure

```bash
docker compose -f docker/docker-compose.yml up -d
```

Verify:
- PostgreSQL is running and accessible
- pgvector extension is available: `SELECT * FROM pg_extension WHERE extname = 'vector';`
- Redis is running

### 1e. Apply Migrations

Create a migration runner script or apply manually:
```bash
# Connect to the PostgreSQL instance and run each migration in order
psql $DROFBOT_SUPABASE_URL -f src/shared/database/migrations/001_memory_banks.sql
psql $DROFBOT_SUPABASE_URL -f src/shared/database/migrations/002_task_queue.sql
psql $DROFBOT_SUPABASE_URL -f src/shared/database/migrations/003_identity.sql
```

Verify all tables exist:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- Should show: memory_episodic, memory_semantic, memory_procedural, memory_relational, task_queue, identity
```

### 1f. Verify

```bash
pnpm build    # Must still pass with new dependency
pnpm test     # Must still pass
```

**Commit**: `feat: install Supabase client, configure database connection, apply migrations`

---

## STEP 2: IMPLEMENT MEMORY BANK CLASSES

**Goal**: Replace the stub files in `src/brain/memory/banks/` with working implementations that store and retrieve memories from Supabase.

### 2a. AUDIT: Map All Existing Infrastructure You Will Reuse

**This step is MANDATORY before writing any bank code.** Spend time reading and mapping the existing codebase. Document what you find in a comment block at the top of `src/brain/memory/index.ts` or in a temporary `AUDIT.md`. Specifically find and document:

```bash
# Find embedding generation
grep -rn "embedding\|embed" src/brain/memory/ extensions/memory-core/ --include="*.ts" -l

# Find vector search / similarity
grep -rn "vector\|similarity\|cosine\|search" src/brain/memory/ extensions/memory-core/ --include="*.ts" -l

# Find LLM call patterns (for classifier)
grep -rn "generateText\|complete\|chat\|inference\|llm\|model" src/brain/agent-runner/ src/shared/llm/ --include="*.ts" -l

# Find tool registration patterns
grep -rn "registerTool\|addTool\|createTool\|toolDef" src/shared/tools/ src/brain/agent-runner/ --include="*.ts" -l

# Find cron registration patterns
grep -rn "registerCron\|addCron\|schedule\|cron" src/brain/cron/ --include="*.ts" -l

# Find config schema extension patterns
grep -rn "schema\|zod\|z\.\|config" src/shared/config/ --include="*.ts" -l

# Find logging patterns
grep -rn "log\|logger\|console\.\|debug\|warn" src/brain/agent-runner/runner.ts src/brain/memory/manager.ts --include="*.ts" | head -20

# Find how memory results get injected into context
grep -rn "memory\|recall\|context" src/brain/agent-runner/prompt-builder.ts src/brain/agent-runner/memory-integration.ts --include="*.ts" -l
```

**Document your findings.** For each capability, note:
- The exact file and function name
- How to import it
- What parameters it expects
- Any gotchas or patterns to follow

**Do NOT proceed to 2b until this audit is complete.** The audit determines how you write everything that follows.

### 2b. Create Shared Embedding Utility (if needed)

Based on your audit, determine whether the existing embedding function can be imported directly by the new bank classes, or whether you need a thin wrapper to make it accessible.

**If the existing embedding function is accessible from `src/brain/memory/`**: Just import it directly in the bank classes. Do not create a wrapper.

**If the existing embedding function is tightly coupled to the QMD system or memory-core extension**: Create a minimal `src/brain/memory/embedding.ts` that extracts/wraps the existing function for shared use. This wrapper should call the EXISTING function, not implement its own embedding logic.

```typescript
// GOOD — wrapping existing infrastructure
import { existingEmbedFunction } from './manager.js'  // or wherever it lives
export async function generateEmbedding(text: string): Promise<number[]> {
  return existingEmbedFunction(text)
}

// BAD — reimplementing from scratch
import OpenAI from 'openai'
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = new OpenAI()  // NO! Use the existing provider system!
  // ...
}
```

### 2c. Create Base Memory Bank Class

Create `src/brain/memory/banks/base.ts` — a shared base class or utility module that all four banks use:

```typescript
/**
 * Base utilities for memory bank operations.
 * All banks share: embedding generation, Supabase operations, graceful degradation.
 */

import { getSupabaseClient, isSupabaseConfigured } from '../../../shared/database/client.js'

export interface MemoryEntry {
  id: string
  content: string
  embedding?: number[]
  created_at: string
  updated_at: string
}

export interface StoreOptions {
  content: string
  metadata?: Record<string, unknown>
}

export interface SearchOptions {
  query: string
  embedding?: number[]   // pre-computed, or will be generated
  limit?: number         // default 10
  threshold?: number     // similarity threshold, default 0.7
}

export interface SearchResult<T extends MemoryEntry> {
  entry: T
  similarity: number
}

/**
 * Graceful degradation: if Supabase is not configured, log a warning
 * and return empty results. The existing QMD memory continues to work.
 */
export function requireSupabase(): boolean {
  if (!isSupabaseConfigured()) {
    console.warn('[drofbot:memory] Supabase not configured — structured memory banks unavailable. QMD memory still active.')
    return false
  }
  return true
}
```

### 2c. Implement Episodic Bank

Replace the stub in `src/brain/memory/banks/episodic.ts`:

The episodic bank stores **timestamped events, experiences, decisions, and conversation context**.

Key operations:
- `store(content, context)` — Store a new episodic memory with timestamp, session context, channel, topic
- `search(query, options)` — Vector similarity search with optional time range filter
- `getRecent(n, timeRange?)` — Get the N most recent episodic memories, optionally within a time range
- `getBySession(sessionId)` — Get all memories from a specific session
- `updateImportance(id, importance)` — Adjust importance score (used by meta-memory consolidation)

**Context fields for episodic memories:**
```typescript
interface EpisodicContext {
  session_id?: string
  channel?: string       // telegram, discord, whatsapp, etc.
  topic?: string         // what the conversation was about
  participants?: string[] // who was involved
  decision?: boolean     // was this a decision point?
}
```

### 2d. Implement Semantic Bank

Replace the stub in `src/brain/memory/banks/semantic.ts`:

The semantic bank stores **facts, preferences, knowledge, and beliefs**.

Key operations:
- `store(content, category, confidence?, source?)` — Store a fact/preference with category and confidence
- `search(query, options)` — Vector similarity search, optionally filtered by category
- `getByCategory(category)` — Get all memories of a specific category (preference, fact, knowledge)
- `updateConfidence(id, confidence)` — Adjust confidence as facts are confirmed/contradicted
- `exists(content)` — Check if a similar fact already exists (dedup, using embedding similarity)

**Categories:**
- `preference` — "D prefers modular architecture"
- `fact` — "GUTTERS uses FastAPI + PostgreSQL"
- `knowledge` — "The cardology module connects to the chronos system"
- `identity` — "D is a Projector human design type"

### 2e. Implement Procedural Bank

Replace the stub in `src/brain/memory/banks/procedural.ts`:

The procedural bank stores **workflows, habits, learned procedures, and how-to knowledge**.

Key operations:
- `store(content, triggerPattern, steps?)` — Store a procedure with its trigger and optional structured steps
- `search(query, options)` — Vector similarity search for matching procedures
- `getByTrigger(pattern)` — Find procedures that match a trigger pattern
- `recordUsage(id)` — Increment success_count and update last_used (procedures that work get reinforced)
- `getMostUsed(n)` — Get the N most frequently used procedures

**Trigger patterns are natural language descriptions of when to use the procedure:**
- "When D says 'deploy GUTTERS'"
- "When a new session starts"
- "When D asks about cosmic timing"

### 2f. Implement Relational Bank

Replace the stub in `src/brain/memory/banks/relational.ts`:

The relational bank stores **entity relationships, connections, and dependencies**.

Key operations:
- `store(entityA, entityB, relationship, metadata?)` — Store a relationship between two entities
- `search(query, options)` — Vector similarity search across relationship descriptions
- `getRelationships(entity)` — Get all relationships involving a specific entity
- `getConnected(entity, depth?)` — Graph traversal — get entities connected to an entity, optionally N levels deep
- `exists(entityA, entityB, relationship)` — Check if this specific relationship is already stored

**Examples:**
- `("GUTTERS", "PostgreSQL", "depends_on", { required: true })`
- `("D", "TypeScript", "prefers", { since: "2024" })`
- `("cardology module", "chronos system", "connects_to", {})`

### 2g. Create Memory Index

Replace the stub in `src/brain/memory/index.ts` with a unified interface:

```typescript
/**
 * Unified memory interface for the Drofbot Brain.
 * Provides access to all four memory banks and the existing QMD system.
 */

import { EpisodicBank } from './banks/episodic.js'
import { SemanticBank } from './banks/semantic.js'
import { ProceduralBank } from './banks/procedural.js'
import { RelationalBank } from './banks/relational.js'
import { isSupabaseConfigured } from '../../shared/database/client.js'

export class DrofbotMemory {
  readonly episodic: EpisodicBank
  readonly semantic: SemanticBank
  readonly procedural: ProceduralBank
  readonly relational: RelationalBank
  readonly isStructuredMemoryAvailable: boolean

  constructor() {
    this.isStructuredMemoryAvailable = isSupabaseConfigured()
    this.episodic = new EpisodicBank()
    this.semantic = new SemanticBank()
    this.procedural = new ProceduralBank()
    this.relational = new RelationalBank()
  }

  /**
   * Intelligent search across all banks.
   * The retriever (Step 3) handles routing queries to the right bank(s).
   */
  async searchAll(query: string, limit?: number): Promise</* unified results */> {
    // Implemented in Step 3 via the Retriever
  }
}

// Singleton
let instance: DrofbotMemory | null = null
export function getDrofbotMemory(): DrofbotMemory {
  if (!instance) instance = new DrofbotMemory()
  return instance
}
```

### 2h. Write Tests for Each Bank

For each memory bank, write tests covering:
- Store a memory → retrieve it by search → verify content and similarity
- Store multiple memories → search returns ranked results
- Category/type filtering works (semantic categories, procedural triggers)
- Dedup detection works (semantic `exists()`)
- Graceful degradation when Supabase is not configured (returns empty, doesn't crash)
- Edge cases: empty content, very long content, special characters

### 2i. Verify

```bash
pnpm build    # Must pass
pnpm test     # Must pass, including new memory bank tests
```

**Commit**: `feat: implement four memory bank classes (episodic, semantic, procedural, relational)`

---

## STEP 3: BUILD CLASSIFIER AND RETRIEVER

**Goal**: The classifier determines which bank(s) incoming information belongs to. The retriever determines which bank(s) to search for a given query.

### 3a. Implement Memory Classifier

Replace the stub in `src/brain/memory/classifier.ts`:

**FIRST**: From your Step 2a audit, you should already know how OpenClaw makes LLM calls for non-chat purposes. Use that EXACT pattern. The classifier is just an LLM call with a classification prompt — it uses the existing model routing, auth profiles, and provider infrastructure. Do NOT instantiate your own LLM client.

Also check if OpenClaw already has any classification or categorization logic (for skill routing, tool selection, etc.) that you can follow as a pattern.

The classifier takes incoming information and determines which memory bank it should be stored in.

```typescript
/**
 * Memory Classifier
 *
 * Given a piece of information from a conversation, determines:
 * 1. Should this be stored as a durable memory? (not everything should be)
 * 2. Which bank(s) should it go to?
 * 3. What metadata should be attached?
 *
 * Uses a lightweight LLM call with a classification prompt.
 */

export interface ClassificationResult {
  shouldStore: boolean
  banks: Array<{
    bank: 'episodic' | 'semantic' | 'procedural' | 'relational'
    content: string        // may be reformulated for the bank
    metadata: Record<string, unknown>
  }>
}
```

**Classification prompt** (injected as a system prompt for the classification LLM call):
```
You are a memory classifier for Drofbot, a personal AI agent.
Given a piece of information from a conversation, determine:

1. Should this be stored as a durable memory? Say NO for:
   - Greetings, small talk, filler
   - Questions that were fully answered (store the answer, not the question)
   - Repetitions of already-known information

2. Which memory bank(s) should it go to?
   - EPISODIC: Events, decisions, experiences, things that happened (timestamped)
   - SEMANTIC: Facts, preferences, knowledge, beliefs (timeless truths)
   - PROCEDURAL: Workflows, habits, how-to instructions, learned procedures
   - RELATIONAL: Connections between entities, dependencies, relationships

3. Reformulate the content for each bank (make it self-contained and retrievable).

Respond in JSON format:
{
  "shouldStore": true/false,
  "banks": [
    { "bank": "semantic", "content": "D prefers TypeScript for all projects", "metadata": { "category": "preference", "confidence": 0.9 } }
  ]
}
```

**Important**: Use a SMALL/CHEAP model for classification — this runs on every significant message. Don't burn Opus tokens on classification. Use the existing model routing to select an appropriate model (Haiku-class or similar).

### 3b. Implement Memory Retriever

Replace the stub in `src/brain/memory/retriever.ts`:

The retriever is the counterpart to the classifier. Given a query (from the agent's context assembly), it determines which bank(s) to search and how to merge results.

```typescript
/**
 * Memory Retriever
 *
 * Given a query (usually the user's latest message + recent context),
 * determines which bank(s) to search and returns merged, ranked results.
 *
 * Retrieval strategy:
 * 1. Always search SEMANTIC (facts/preferences are almost always relevant)
 * 2. Search EPISODIC if the query references past events or "what happened"
 * 3. Search PROCEDURAL if the query is about how to do something
 * 4. Search RELATIONAL if the query involves connections between entities
 * 5. Merge and rank results by relevance
 */

export interface RetrievalResult {
  bank: 'episodic' | 'semantic' | 'procedural' | 'relational'
  content: string
  similarity: number
  metadata: Record<string, unknown>
}

export interface RetrievalOptions {
  query: string
  maxResults?: number      // default 15 across all banks
  banks?: Array<'episodic' | 'semantic' | 'procedural' | 'relational'>  // force specific banks
  includeRecent?: boolean  // include N most recent episodic memories regardless of similarity
}
```

**Retrieval routing can be rule-based initially** (no LLM call needed):
- Query contains time references ("yesterday", "last week", "when we") → include EPISODIC
- Query contains "how to", "how do I", "the process for" → include PROCEDURAL
- Query contains entity names or "depends on", "connects to", "related to" → include RELATIONAL
- SEMANTIC is ALWAYS included (it's the general knowledge base)

This can be upgraded to LLM-based routing later if the rule-based approach proves insufficient. Start simple.

### 3c. Write Tests

- Classifier correctly identifies memory types from sample conversations
- Classifier correctly rejects small talk / filler
- Retriever routes queries to correct banks
- Retriever merges and ranks results from multiple banks
- Retriever returns reasonable results when some banks are empty

### 3d. Verify

```bash
pnpm build
pnpm test
```

**Commit**: `feat: implement memory classifier and multi-bank retriever`

---

## STEP 4: WIRE INTO AGENT RUNNER

**Goal**: The agent's context window now draws from BOTH the existing QMD/markdown memory AND the new structured memory banks. Memory is also stored after conversations.

This is the integration step — the most delicate part. We are touching the core agent loop.

### 4a. Study the Existing Memory Integration

Before changing anything, deeply understand:

1. **`src/brain/agent-runner/memory-integration.ts`** — How memory is currently wired into the agent loop. What gets loaded into context? When? How much?

2. **`src/brain/agent-runner/prompt-builder.ts`** (was `system-prompt.ts`) — How the system prompt is assembled. Where does memory content get injected?

3. **`src/brain/agent-runner/compaction.ts`** — How context compaction works. What happens to memory during compaction? (OpenClaw has a `memoryFlush` feature that writes to markdown before compacting.)

4. **`extensions/memory-core/`** — The memory search plugin that provides the `memory_search` tool.

### 4b. Add Structured Memory to Context Assembly

In the system prompt assembly (wherever memory recall is injected into the prompt), ADD the structured memory results alongside the existing QMD results:

```typescript
// Pseudocode — adapt to actual code structure
async function assembleMemoryContext(userMessage: string, sessionContext: any) {
  const results: string[] = []

  // EXISTING: QMD/markdown memory search (keep as-is)
  const qmdResults = await existingMemorySearch(userMessage)
  if (qmdResults.length > 0) {
    results.push('## Memory (Markdown)\n' + qmdResults.map(r => `- ${r}`).join('\n'))
  }

  // NEW: Structured memory bank search (only if Supabase is configured)
  if (isSupabaseConfigured()) {
    const retriever = getRetriever()
    const structured = await retriever.search({ query: userMessage, maxResults: 10 })

    if (structured.length > 0) {
      const grouped = groupByBank(structured)
      const sections: string[] = []

      if (grouped.semantic?.length)
        sections.push('### Known Facts & Preferences\n' + grouped.semantic.map(r => `- ${r.content}`).join('\n'))
      if (grouped.episodic?.length)
        sections.push('### Relevant Past Events\n' + grouped.episodic.map(r => `- ${r.content}`).join('\n'))
      if (grouped.procedural?.length)
        sections.push('### Relevant Procedures\n' + grouped.procedural.map(r => `- ${r.content}`).join('\n'))
      if (grouped.relational?.length)
        sections.push('### Entity Relationships\n' + grouped.relational.map(r => `- ${r.content}`).join('\n'))

      results.push('## Memory (Structured)\n' + sections.join('\n'))
    }
  }

  return results.join('\n\n')
}
```

**Token budget**: Be mindful of context window usage. Set reasonable limits:
- Structured memory: max ~2000 tokens in the system prompt
- This is in ADDITION to existing QMD memory allocation
- The retriever's `maxResults` should be tuned to stay within budget

### 4c. Add Memory Storage After Conversations

Hook into the conversation lifecycle to classify and store memories. The best place is likely:

1. **After each agent turn** — classify the user's message + agent's response
2. **During compaction memory flush** — enhance the existing `memoryFlush` to also write to structured banks
3. **At session end** — summarize the session and store key points

For the initial implementation, focus on **after each agent turn**:

```typescript
// Pseudocode — hook into the agent runner's post-turn logic
async function postTurnMemoryStore(userMessage: string, agentResponse: string, sessionContext: any) {
  if (!isSupabaseConfigured()) return  // graceful degradation

  const classifier = getClassifier()
  const memory = getDrofbotMemory()

  // Classify the exchange
  const classification = await classifier.classify(
    `User: ${userMessage}\nAgent: ${agentResponse}`,
    sessionContext
  )

  if (!classification.shouldStore) return

  // Store in appropriate banks
  for (const entry of classification.banks) {
    switch (entry.bank) {
      case 'episodic':
        await memory.episodic.store(entry.content, entry.metadata)
        break
      case 'semantic':
        // Check for duplicates first
        if (!(await memory.semantic.exists(entry.content))) {
          await memory.semantic.store(entry.content, entry.metadata.category as string, entry.metadata.confidence as number)
        }
        break
      case 'procedural':
        await memory.procedural.store(entry.content, entry.metadata.trigger_pattern as string, entry.metadata.steps as any)
        break
      case 'relational':
        await memory.relational.store(
          entry.metadata.entity_a as string,
          entry.metadata.entity_b as string,
          entry.content,
          entry.metadata
        )
        break
    }
  }
}
```

**Critical**: This must be non-blocking. Memory storage happens asynchronously after the agent's response is delivered. The user should never wait for memory classification/storage.

### 4d. Enhance Compaction Memory Flush

OpenClaw's existing compaction system has a `memoryFlush` feature that writes to markdown before compacting the context window. Enhance this to ALSO flush to structured memory banks:

Find the compaction logic in `src/brain/agent-runner/compaction.ts` and add:

```typescript
// After the existing markdown memory flush...
if (isSupabaseConfigured()) {
  // Extract key context from the about-to-be-compacted conversation
  // and store it in episodic memory so it survives compaction
  const compactionSummary = await summarizeForCompaction(sessionHistory)
  await getDrofbotMemory().episodic.store(compactionSummary, {
    session_id: sessionId,
    channel: channelName,
    type: 'compaction_summary',
    timestamp: new Date().toISOString()
  })
}
```

This is what makes Drofbot's memory fundamentally better than OpenClaw's — context that would be lost to compaction is preserved in structured memory and can be retrieved in future sessions.

### 4e. Add Memory Tools for the Agent

The agent should be able to explicitly store and search memory using tools. OpenClaw already has `memory_search` — we add structured memory variants:

Register new tools in the tool registry (or enhance the existing memory tools):

- **`memory_store`** — Explicitly store a memory in a specific bank
  ```
  memory_store({ bank: "semantic", content: "D's VPS runs on Hetzner", category: "fact" })
  ```

- **`memory_search_structured`** — Search the structured memory banks
  ```
  memory_search_structured({ query: "What does D prefer for deployment?", banks: ["semantic", "procedural"] })
  ```

These are IN ADDITION to the existing `memory_search` tool (which searches QMD/markdown). The agent can use both.

**Update the system prompt / TOOLS.md** to inform the agent about the new memory tools and when to use them.

### 4f. Write Integration Tests

- Agent turn → memory classified and stored → subsequent search retrieves it
- Compaction flush → episodic summary stored → retrievable in new session
- Structured memory appears in context alongside QMD memory
- Graceful degradation: everything works when Supabase is down (just no structured memory)
- Token budget: structured memory doesn't blow the context window

### 4g. Verify

```bash
pnpm build
pnpm test
```

Manual smoke test:
1. Start the gateway with Supabase running
2. Send a message via Telegram: "I prefer to use Docker for all deployments"
3. Wait for response
4. In a new session, ask: "What are my deployment preferences?"
5. Verify the structured memory is retrieved and influences the response
6. Check Supabase directly: the preference should be in `memory_semantic`

**Commit**: `feat: wire structured memory into agent runner (context assembly + storage + tools)`

---

## STEP 5: IMPLEMENT BASIC CONSOLIDATION CRON

**Goal**: Set up the meta-memory consolidation job that runs periodically to dedup, compress, and promote memories.

### 5a. Implement Consolidation Cron

Replace the stub in `src/brain/cron/consolidation.ts`:

This runs on a schedule (initially every 6 hours) and performs:

1. **Deduplication** — Find semantically similar entries within each bank and merge them
   - Use embedding similarity: if two entries have >0.95 cosine similarity, merge them
   - Keep the more detailed/recent version, increment a `merge_count` if desired

2. **Compression** — Summarize old episodic memories
   - Episodic memories older than 30 days: batch-summarize into condensed entries
   - Original entries can be archived or deleted after compression

3. **Promotion** — Detect patterns and promote to higher-level knowledge
   - If the same type of information appears in 3+ episodic memories, promote to semantic
   - Example: if D mentions Docker deployment in 5 different conversations → store as semantic fact: "D consistently uses Docker for deployment"

### 5b. Wire Into Existing Cron System

OpenClaw has an existing cron system in `src/brain/cron/`. From your Step 2a audit, you should already know how cron jobs are registered and scheduled.

**Use the EXACT same registration pattern as existing cron jobs.** Look at how the current cron jobs are defined, registered, and invoked. Your consolidation job should be indistinguishable in structure from the existing ones — just with different logic inside.

- Register the consolidation job using the EXISTING cron infrastructure
- Do NOT create a separate scheduling system (no `setInterval`, no `node-cron` import, no custom scheduler)
- Default schedule: every 6 hours
- Make the schedule configurable via `drofbot.json`:
  ```json
  {
    "memory": {
      "consolidation": {
        "enabled": true,
        "intervalHours": 6
      }
    }
  }
  ```

### 5c. Write Tests

- Dedup correctly merges similar semantic memories
- Compression summarizes old episodic memories
- Promotion detects patterns and creates semantic entries
- Cron job runs on schedule and completes without errors

### 5d. Verify

```bash
pnpm build
pnpm test
```

**Commit**: `feat: implement memory consolidation cron (dedup, compress, promote)`

---

## STEP 6: SMOKE TEST — End-to-End Memory Verification

**Goal**: Full end-to-end test of the memory system working alongside the existing QMD system.

### 6a. Test Scenario

Run through this complete scenario:

1. **Start fresh**: Clean Supabase database, clean QMD state
2. **Conversation 1** (Telegram):
   - Tell Drofbot: "I'm working on a project called GUTTERS. It uses FastAPI and PostgreSQL. It's deployed on a Hetzner VPS."
   - Verify: semantic memories stored (GUTTERS → FastAPI, PostgreSQL dependencies; Hetzner deployment fact)
   - Verify: episodic memory stored (conversation event)
   - Verify: relational memories stored (GUTTERS → FastAPI, GUTTERS → PostgreSQL, GUTTERS → Hetzner)

3. **Conversation 2** (different session or channel):
   - Ask: "What do you know about my GUTTERS project?"
   - Verify: response draws from structured memory (mentions FastAPI, PostgreSQL, Hetzner)
   - Verify: structured memory appears in context alongside any QMD results

4. **Conversation 3**:
   - Tell Drofbot: "When I say 'deploy GUTTERS', I want you to run the build script, check the .env file, then push to the VPS."
   - Verify: procedural memory stored with trigger pattern "deploy GUTTERS"
   - Later, say: "Deploy GUTTERS"
   - Verify: agent retrieves and follows the procedure

5. **Compaction test**:
   - Have a long conversation that triggers compaction
   - Verify: pre-compaction context is stored in episodic memory
   - Start a new session and reference something from the compacted conversation
   - Verify: the information is retrieved from episodic memory

6. **Graceful degradation**:
   - Stop Supabase: `docker compose -f docker/docker-compose.yml stop`
   - Verify: Drofbot still works with QMD memory only, no crashes
   - Start Supabase again: verify structured memory resumes

### 6b. Document Results

Create `PHASE-2-RESULTS.md` documenting:
- Test suite status (total tests, passing, failing)
- Memory bank operation results
- Integration test results
- Performance observations (does classification add noticeable latency?)
- Token usage observations (how much context budget do structured memories use?)
- Graceful degradation confirmation
- Known issues and plans

**Commit**: `feat: Phase 2 complete — hierarchical memory foundation operational`

---

## AFTER PHASE 2

You now have a Drofbot with:

✅ **Green test suite** (Phase 1 debt resolved)
✅ **Four structured memory banks** (episodic, semantic, procedural, relational) in Supabase
✅ **Memory classifier** — automatically categorizes information from conversations
✅ **Multi-bank retriever** — intelligently searches the right bank(s) for a query
✅ **Dual memory system** — structured banks + QMD/markdown working together
✅ **Enhanced compaction** — critical context survives compaction via episodic memory
✅ **Memory tools** — agent can explicitly store and search structured memory
✅ **Consolidation cron** — periodic dedup, compression, and pattern promotion
✅ **Graceful degradation** — everything works without Supabase, just fewer features

**Phase 3 (Brain/Hands Split)** can now begin. The memory system is the foundation that makes the Brain/Hands architecture meaningful — the Brain always has access to structured memory regardless of whether the Hands (local machine) are connected.

---

## EMERGENCY PROCEDURES

Same as Phase 1:
1. **DO NOT** `// @ts-ignore` or `any`-type your way out of problems
2. **DO NOT** disable the existing QMD memory to "make room" for the new system
3. **DO NOT** make the Supabase connection a hard dependency — graceful degradation is non-negotiable
4. **STOP** and analyze if the agent runner's behavior changes unexpectedly after integration
5. If memory classification is too slow, use a smaller model — don't skip classification
6. If token budgets are exceeded, reduce `maxResults` in the retriever — don't remove memory sections from the prompt
7. `git stash` and restart from last good commit if truly stuck
