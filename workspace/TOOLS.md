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

## Memory Tools
### QMD Memory (markdown file-based)
- **memory_search**: Semantic search across MEMORY.md + memory/*.md files. Use for recalling information stored in markdown memory files.
- **memory_get**: Read specific lines from a memory file. Use after memory_search to pull exact content.

### Structured Memory (Supabase-backed four-bank system)
- **memory_store**: Explicitly store a memory in a specific bank.
  - `bank`: "episodic" | "semantic" | "procedural" | "relational"
  - `content`: The text to store
  - `metadata`: Bank-specific fields:
    - Semantic: `{ category: "preference"|"fact"|"knowledge"|"identity", confidence: 0-1, source }`
    - Episodic: `{ channel, topic, session, participants, importance }`
    - Procedural: `{ trigger_pattern, steps: [...] }`
    - Relational: `{ entity_a, entity_b, relationship }` (all three required)

- **memory_search_structured**: Search the structured memory banks with vector similarity.
  - `query`: Natural-language search query
  - `banks`: Optional array of banks to search (defaults to all four)
  - `limit`: Max results per bank (default 10)

### When to use which?
- **memory_search**: For recalling information from MEMORY.md files (diary-style, notes, logs)
- **memory_search_structured**: For recalling structured facts, events, procedures, relationships
- **memory_store**: When you want to *deliberately* save something important — a fact you've learned, a procedure you've been taught, a relationship between entities

## Enhanced Tools (Drofbot additions — future phases)
- task_queue: Queue task for local execution (Phase 3)
- identity_update: Update self-model (Phase 4)
- gutters_query: Query GUTTERS MCP server (Phase 5)
