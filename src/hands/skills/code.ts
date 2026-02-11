/**
 * Code Skill
 *
 * Placeholder for future code-specific tool wrappers (e.g. sandboxed
 * language runtimes, REPL execution). Currently, code execution goes
 * through the `exec` tool (shell skill) or browser-based runners.
 *
 * No additional tool factories exist for this category yet.
 */

import type { AnyAgentTool } from "../../brain/agent-runner/pi-tools.types.js";

/**
 * Create code analysis/execution tools. Returns an empty Map currently —
 * future work will add language-specific sandboxed runners here.
 */
export function createCodeTools(): Map<string, AnyAgentTool> {
  return new Map();
}
