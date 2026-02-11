/**
 * Browser Skill
 *
 * Wraps the existing browser tool for use by the Hands Worker.
 * Thin routing wrapper — delegates to the actual browser tool factory.
 *
 * This is NOT a reimplementation.
 */

import type { AnyAgentTool } from "../../brain/agent-runner/pi-tools.types.js";
import { createBrowserTool } from "../../brain/agent-runner/tools/browser-tool.js";

/** Browser-related tool names. */
export const BROWSER_TOOLS = ["browser"] as const;

export interface BrowserToolOptions {
  sandboxBridgeUrl?: string;
  allowHostControl?: boolean;
}

/**
 * Create the browser tool. Returns a Map<toolName, AgentTool> for dispatch.
 */
export function createBrowserTools(opts?: BrowserToolOptions): Map<string, AnyAgentTool> {
  const tools = new Map<string, AnyAgentTool>();
  const tool = createBrowserTool(opts);
  if (tool) {
    tools.set("browser", tool as AnyAgentTool);
  }
  return tools;
}
