/**
 * Tool Classifier
 *
 * Rule-based classifier that determines whether a tool call requires
 * local system access (Hands Worker) or can execute in the cloud (Brain).
 * No LLM call needed — tool names are well-known and static.
 *
 * Classification:
 * - LOCAL: requires filesystem, shell, process management, or browser access
 * - CLOUD: memory, web search/fetch, messaging, session management, etc.
 * - HYBRID: can work in either context but prefers local
 *
 * @see DROFBOT-FORK-VISION.md section 2 (Brain/Hands Architecture)
 */

export type ToolLocation = "cloud" | "local" | "hybrid";

/**
 * Tools that require local machine access (filesystem, shell, process).
 * These MUST be dispatched to the Worker when in Brain/Hands mode.
 */
const LOCAL_TOOLS = new Set<string>([
  // SDK filesystem tools
  "read",
  "write",
  "edit",
  "grep",
  "find",
  "ls",
  // Execution tools
  "exec",
  "process",
  "apply_patch",
]);

/**
 * Tools that can execute entirely in the cloud (Brain process).
 * No local filesystem or OS access needed.
 */
const CLOUD_TOOLS = new Set<string>([
  // Memory (Supabase)
  "memory_store",
  "memory_search_structured",
  "memory_search",
  "memory_get",
  // Web (external APIs / HTTP)
  "web_search",
  "web_fetch",
  // Messaging (channel APIs)
  "message",
  // Session management (Gateway RPC)
  "sessions_list",
  "sessions_history",
  "sessions_send",
  "sessions_spawn",
  "session_status",
  "agents_list",
  // Infrastructure (Gateway)
  "cron",
  "nodes",
  "canvas",
  "tts",
]);

/**
 * Tools that can work in both contexts but prefer local.
 * Browser prefers local (direct Playwright access) but can fall back
 * to a sandbox bridge. Image can read local files or be served from gateway.
 */
const HYBRID_TOOLS = new Set<string>(["browser", "image", "gateway"]);

/**
 * Classify a tool by name to determine where it should execute.
 *
 * @returns "local" if the tool needs filesystem/shell/OS access,
 *          "cloud" if it can run entirely on the Brain server,
 *          "hybrid" if it can work in either context
 */
export function classifyTool(toolName: string): ToolLocation {
  const normalized = toolName.toLowerCase();

  if (LOCAL_TOOLS.has(normalized)) return "local";
  if (CLOUD_TOOLS.has(normalized)) return "cloud";
  if (HYBRID_TOOLS.has(normalized)) return "hybrid";

  // Channel-specific tools (e.g. whatsapp_login) are local
  // since they typically interact with local services.
  if (normalized.endsWith("_login")) return "local";

  // Unknown tools default to local for safety — better to dispatch
  // to the Worker than to fail silently on the Brain.
  return "local";
}

/**
 * Check if a tool can execute in the Brain process (cloud or hybrid).
 * Used to determine if a tool call can proceed without a Worker.
 */
export function canExecuteInCloud(toolName: string): boolean {
  const location = classifyTool(toolName);
  return location === "cloud" || location === "hybrid";
}

/**
 * Check if a tool requires the Worker (local-only).
 */
export function requiresWorker(toolName: string): boolean {
  return classifyTool(toolName) === "local";
}
