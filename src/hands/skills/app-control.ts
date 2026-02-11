/**
 * App Control Skill
 *
 * Placeholder for future native application automation (macOS Shortcuts,
 * AppleScript, Android Intents). No tool factories exist for this
 * category yet — app control is invoked via `exec` or future plugins.
 */

import type { AnyAgentTool } from "../../brain/agent-runner/pi-tools.types.js";

/**
 * Create app-control tools. Returns an empty Map currently —
 * future work will add platform-specific automation tools here.
 */
export function createAppControlTools(): Map<string, AnyAgentTool> {
  return new Map();
}
