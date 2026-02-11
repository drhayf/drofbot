/**
 * Filesystem Skill
 *
 * Wraps the existing SDK filesystem tools (read, write, edit, grep, find, ls)
 * for use by the Hands Worker. These are thin routing wrappers — they
 * create tool instances via the existing factories and expose an execute()
 * method for the Worker to call.
 *
 * This is NOT a reimplementation. All logic lives in the existing tools.
 */

import {
  createEditTool,
  createReadTool,
  createWriteTool,
  codingTools,
} from "@mariozechner/pi-coding-agent";
import type { AnyAgentTool } from "../../brain/agent-runner/pi-tools.types.js";
import {
  createOpenClawReadTool,
  wrapToolParamNormalization,
  CLAUDE_PARAM_GROUPS,
} from "../../brain/agent-runner/pi-tools.read.js";

/** File system tool names. */
export const FILESYSTEM_TOOLS = ["read", "write", "edit", "grep", "find", "ls"] as const;
export type FilesystemToolName = (typeof FILESYSTEM_TOOLS)[number];

/**
 * Create all filesystem tools for a given working directory.
 * Returns a Map<toolName, AgentTool> for dispatch.
 */
export function createFilesystemTools(cwd: string): Map<string, AnyAgentTool> {
  const tools = new Map<string, AnyAgentTool>();

  // read — wrapped with MIME sniffing + Claude Code param compat
  const readBase = createReadTool(cwd);
  tools.set("read", createOpenClawReadTool(readBase) as AnyAgentTool);

  // write — wrapped with param normalization
  tools.set(
    "write",
    wrapToolParamNormalization(createWriteTool(cwd), CLAUDE_PARAM_GROUPS.write) as AnyAgentTool,
  );

  // edit — wrapped with param normalization
  tools.set(
    "edit",
    wrapToolParamNormalization(createEditTool(cwd), CLAUDE_PARAM_GROUPS.edit) as AnyAgentTool,
  );

  // grep, find, ls — used from codingTools array (SDK provides them)
  const sdkTools = codingTools as unknown as AnyAgentTool[];
  for (const tool of sdkTools) {
    if (tool.name === "grep" || tool.name === "find" || tool.name === "ls") {
      tools.set(tool.name, tool);
    }
  }

  return tools;
}
