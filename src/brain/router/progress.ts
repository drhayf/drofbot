/**
 * Task Progress Forwarder
 *
 * When the Worker sends `task:progress` events, the Brain forwards them
 * to the user's originating messaging channel as proactive progress
 * messages.
 *
 * This module captures the originating channel context at task-enqueue
 * time and provides a `forwardProgress` function that sends formatted
 * updates.
 */

import type { TaskProgress } from "../../gateway/protocol/schema/worker.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Captures where to send progress updates for a task. */
export interface TaskOrigin {
  taskId: string;
  channel: string;
  to: string;
  sessionKey: string;
  threadId?: string;
  accountId?: string;
}

// ---------------------------------------------------------------------------
// In-memory origin registry (task ID → origin)
// ---------------------------------------------------------------------------

const taskOrigins = new Map<string, TaskOrigin>();

/** Register the originating channel for a task (called at enqueue time). */
export function registerTaskOrigin(origin: TaskOrigin): void {
  taskOrigins.set(origin.taskId, origin);
}

/** Remove a task's origin (called when task completes/fails). */
export function unregisterTaskOrigin(taskId: string): void {
  taskOrigins.delete(taskId);
}

/** Look up a task's origin. */
export function getTaskOrigin(taskId: string): TaskOrigin | undefined {
  return taskOrigins.get(taskId);
}

// ---------------------------------------------------------------------------
// Progress formatting
// ---------------------------------------------------------------------------

/** Format a progress event into a user-facing message. */
export function formatProgressMessage(progress: TaskProgress): string {
  const pct = progress.progress;
  const msg = progress.message?.trim();

  if (pct >= 100) {
    return msg ? `[✅ Complete] ${msg}` : "[✅ Complete]";
  }

  const bar = `[🔄 ${pct}%]`;
  return msg ? `${bar} ${msg}` : bar;
}

/** Format a task completion message. */
export function formatCompletionMessage(taskId: string, tool: string, duration: number): string {
  const secs = (duration / 1000).toFixed(1);
  return `✅ Task ${taskId.slice(0, 8)}… (${tool}) completed in ${secs}s`;
}

/** Format a task failure message. */
export function formatFailureMessage(taskId: string, tool: string, error: string): string {
  return `❌ Task ${taskId.slice(0, 8)}… (${tool}) failed: ${error}`;
}
