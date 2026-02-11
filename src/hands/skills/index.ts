/**
 * Skill Router
 *
 * Central entry point for creating and dispatching Hands Worker tools.
 * Combines all skill categories into a single Map<toolName, AgentTool>
 * so the Worker can look up and execute any tool by name.
 */

import type { AnyAgentTool } from "../../brain/agent-runner/pi-tools.types.js";
import type { ToolExecutor } from "../worker.js";
import { createAppControlTools } from "./app-control.js";
import { createBrowserTools } from "./browser.js";
import { createCodeTools } from "./code.js";
import { createFilesystemTools } from "./filesystem.js";
import { createShellTools } from "./shell.js";

export interface SkillRouterOptions {
  cwd?: string;
}

/**
 * Create a Map of all available local tools keyed by tool name.
 */
export function createLocalToolMap(opts?: SkillRouterOptions): Map<string, AnyAgentTool> {
  const cwd = opts?.cwd ?? process.cwd();
  const all = new Map<string, AnyAgentTool>();

  // Collect tools from each skill category
  const sources = [
    createFilesystemTools(cwd),
    createShellTools({ cwd }),
    createBrowserTools(),
    createCodeTools(),
    createAppControlTools(),
  ];

  for (const src of sources) {
    for (const [name, tool] of src) {
      all.set(name, tool);
    }
  }

  return all;
}

/**
 * Create a ToolExecutor function backed by the local tool map.
 * This is what gets passed to the HandsWorker constructor.
 */
export function createToolExecutor(opts?: SkillRouterOptions): ToolExecutor {
  const tools = createLocalToolMap(opts);

  return async (
    toolName: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<{ content: unknown; error?: string }> => {
    const tool = tools.get(toolName);
    if (!tool) {
      return { content: null, error: `Unknown tool: "${toolName}"` };
    }

    try {
      const toolCallId = `hands-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = await tool.execute(toolCallId, params, signal);
      return { content: result };
    } catch (err) {
      return {
        content: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };
}
