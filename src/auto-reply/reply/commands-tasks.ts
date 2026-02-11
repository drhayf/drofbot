/**
 * /tasks and /cancel command handlers
 *
 * Exposes the Brain→Hands task queue to the user via slash commands.
 */

import type { CommandHandler } from "./commands-types.js";
import { TaskQueueManager } from "../../brain/router/queue.js";

const tasksQueue = new TaskQueueManager();

/**
 * /tasks — show queued and running tasks
 */
export const handleTasksCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const body = params.command.commandBodyNormalized;
  if (!body.startsWith("/tasks") && !body.startsWith("/queue")) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    return { shouldContinue: false };
  }

  const queued = await tasksQueue.getQueued();
  if (queued.length === 0) {
    return {
      shouldContinue: false,
      reply: { text: "No tasks in queue." },
    };
  }

  const lines = queued.map((task, i) => {
    const status = task.status === "running" ? "🔄 running" : "⏳ queued";
    const age = Math.round((Date.now() - task.createdAt.getTime()) / 1000);
    return `${i + 1}. [${status}] ${task.payload.tool} (${task.id.slice(0, 8)}…) — ${age}s ago`;
  });

  return {
    shouldContinue: false,
    reply: { text: `**Task Queue** (${queued.length})\n${lines.join("\n")}` },
  };
};

/**
 * /cancel <taskId> — cancel a queued task
 */
export const handleCancelCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const body = params.command.commandBodyNormalized;
  if (!body.startsWith("/cancel")) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    return { shouldContinue: false };
  }

  // Extract task ID from "/cancel <taskId>"
  const parts = body.split(/\s+/);
  const taskIdPrefix = parts[1]?.trim();

  if (!taskIdPrefix) {
    return {
      shouldContinue: false,
      reply: { text: "Usage: /cancel <taskId>\nGet task IDs with /tasks" },
    };
  }

  // Try exact match first, then prefix match
  const cancelled = await tasksQueue.cancel(taskIdPrefix);
  if (cancelled) {
    return {
      shouldContinue: false,
      reply: { text: `Task ${taskIdPrefix} cancelled.` },
    };
  }

  // Try prefix match against queued tasks
  const queued = await tasksQueue.getQueued();
  const match = queued.find((t) => t.id.startsWith(taskIdPrefix));
  if (match) {
    const result = await tasksQueue.cancel(match.id);
    if (result) {
      return {
        shouldContinue: false,
        reply: { text: `Task ${match.id.slice(0, 8)}… cancelled.` },
      };
    }
  }

  return {
    shouldContinue: false,
    reply: { text: `No matching task found for "${taskIdPrefix}".` },
  };
};
