/**
 * Shell Skill
 *
 * Wraps the existing exec and process tools for use by the Hands Worker.
 * Thin routing wrapper — delegates to the actual tool factories.
 *
 * This is NOT a reimplementation. All logic lives in the existing tools.
 */

import type { AnyAgentTool } from "../../brain/agent-runner/pi-tools.types.js";
import { createApplyPatchTool } from "../../brain/agent-runner/apply-patch.js";
import { createExecTool, createProcessTool } from "../../brain/agent-runner/bash-tools.js";

/** Shell-related tool names. */
export const SHELL_TOOLS = ["exec", "process", "apply_patch"] as const;
export type ShellToolName = (typeof SHELL_TOOLS)[number];

export interface ShellToolOptions {
  cwd?: string;
}

/**
 * Create all shell tools. Returns a Map<toolName, AgentTool> for dispatch.
 */
export function createShellTools(opts?: ShellToolOptions): Map<string, AnyAgentTool> {
  const tools = new Map<string, AnyAgentTool>();

  tools.set("exec", createExecTool({ cwd: opts?.cwd }) as AnyAgentTool);
  tools.set("process", createProcessTool() as AnyAgentTool);
  tools.set("apply_patch", createApplyPatchTool({ cwd: opts?.cwd }) as AnyAgentTool);

  return tools;
}
