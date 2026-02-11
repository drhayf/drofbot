/**
 * Worker Registry
 *
 * Manages the state of connected Hands Workers. The Gateway uses this
 * module to track which Workers are online, dispatch tasks to them,
 * and receive results back.
 *
 * Designed for single-worker scenarios (personal Drofbot) but supports
 * multiple workers for future expansion.
 *
 * @see DROFBOT-FORK-VISION.md section 2 (Brain/Hands Architecture)
 */

import type { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { timingSafeEqual } from "node:crypto";
import { classifyTool } from "../../brain/router/classifier.js";
import { TaskQueueManager } from "../../brain/router/queue.js";
import { WORKER_EVENTS, type TaskDispatch, type TaskResult } from "../protocol/schema/worker.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkerConnection {
  ws: WebSocket;
  connId: string;
  hostname: string;
  platform: string;
  capabilities: string[];
  connectedAt: Date;
  lastHeartbeat: Date;
  activeTasks: Map<string, PendingTask>;
}

interface PendingTask {
  taskId: string;
  tool: string;
  dispatchedAt: Date;
  timeout: number;
  resolve: (result: TaskResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface WorkerRegistryOptions {
  /** Shared secret for worker auth. From config or DROFBOT_WORKER_SECRET env. */
  workerSecret?: string;
  /** Heartbeat timeout multiplier. Worker is offline if no heartbeat in interval × this. Default 2. */
  heartbeatTimeoutMultiplier?: number;
  /** Default task timeout in ms. Default 300000 (5 min). */
  defaultTaskTimeout?: number;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class WorkerRegistry {
  private workers = new Map<string, WorkerConnection>();
  private taskQueue: TaskQueueManager;
  private pendingResults = new Map<string, PendingTask>();
  private options: Required<WorkerRegistryOptions>;

  constructor(opts: WorkerRegistryOptions = {}) {
    this.options = {
      workerSecret: opts.workerSecret ?? process.env.DROFBOT_WORKER_SECRET ?? "",
      heartbeatTimeoutMultiplier: opts.heartbeatTimeoutMultiplier ?? 2,
      defaultTaskTimeout: opts.defaultTaskTimeout ?? 300_000,
    };
    this.taskQueue = new TaskQueueManager();
  }

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  /** Validate the worker's shared secret. */
  validateSecret(secret: string): boolean {
    const expected = this.options.workerSecret;
    if (!expected || !secret) {
      return false;
    }
    try {
      const a = Buffer.from(expected, "utf8");
      const b = Buffer.from(secret, "utf8");
      if (a.length !== b.length) {
        return false;
      }
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Connection management
  // -------------------------------------------------------------------------

  /** Register a new Worker connection. Returns the connection reference. */
  registerWorker(
    ws: WebSocket,
    info: {
      connId: string;
      hostname: string;
      platform: string;
      capabilities: string[];
    },
  ): WorkerConnection {
    const worker: WorkerConnection = {
      ws,
      connId: info.connId,
      hostname: info.hostname,
      platform: info.platform,
      capabilities: info.capabilities,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      activeTasks: new Map(),
    };
    this.workers.set(info.connId, worker);
    return worker;
  }

  /** Remove a Worker connection and fail its active tasks. */
  unregisterWorker(connId: string): void {
    const worker = this.workers.get(connId);
    if (!worker) {
      return;
    }

    // Fail all active tasks
    for (const [taskId, pending] of worker.activeTasks) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Worker disconnected"));
      this.pendingResults.delete(taskId);
      // Mark in queue as failed
      this.taskQueue.markFailed(taskId, "Worker disconnected").catch(() => {});
    }
    worker.activeTasks.clear();
    this.workers.delete(connId);
  }

  /** Update a Worker's last heartbeat timestamp. */
  updateHeartbeat(connId: string): void {
    const worker = this.workers.get(connId);
    if (worker) {
      worker.lastHeartbeat = new Date();
    }
  }

  /** Check if any Worker is connected. */
  isWorkerConnected(): boolean {
    return this.workers.size > 0;
  }

  /** Get the first connected worker (single-user mode). */
  getWorker(): WorkerConnection | undefined {
    return this.workers.values().next().value;
  }

  /** Get all connected workers. */
  getWorkers(): WorkerConnection[] {
    return Array.from(this.workers.values());
  }

  // -------------------------------------------------------------------------
  // Task dispatch
  // -------------------------------------------------------------------------

  /**
   * Dispatch a tool call to the Worker.
   * Returns a Promise that resolves when the Worker sends result.
   * If no Worker is connected, enqueues the task instead.
   */
  async dispatchToWorker(
    tool: string,
    params: Record<string, unknown>,
    opts?: { priority?: number; timeout?: number; sessionKey?: string; channel?: string },
  ): Promise<TaskResult> {
    const worker = this.getWorker();
    if (!worker || worker.ws.readyState !== 1 /* WebSocket.OPEN */) {
      // No worker — enqueue for later
      const taskId = await this.taskQueue.enqueue({
        tool,
        params,
        priority: opts?.priority ?? 5,
        sessionKey: opts?.sessionKey,
        channel: opts?.channel,
      });
      return {
        taskId,
        status: "failed",
        error: `Your machine is offline. Task queued (${taskId}). It will execute when your machine reconnects.`,
        duration: 0,
      };
    }

    const taskId = randomUUID();
    const timeout = opts?.timeout ?? this.options.defaultTaskTimeout;

    // Enqueue in the database for persistence
    await this.taskQueue.enqueue({
      tool,
      params,
      priority: opts?.priority ?? 5,
      sessionKey: opts?.sessionKey,
      channel: opts?.channel,
    });
    // (Note: we don't use the DB-generated ID; we use our own to track the WS round-trip)

    return new Promise<TaskResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.activeTasks.delete(taskId);
        this.pendingResults.delete(taskId);
        reject(new Error(`Task ${taskId} timed out after ${timeout}ms`));
      }, timeout);
      timer.unref?.();

      const pending: PendingTask = {
        taskId,
        tool,
        dispatchedAt: new Date(),
        timeout,
        resolve,
        reject,
        timer,
      };

      worker.activeTasks.set(taskId, pending);
      this.pendingResults.set(taskId, pending);

      // Send the dispatch message to the Worker
      const dispatch: TaskDispatch = {
        taskId,
        tool,
        params,
        priority: opts?.priority ?? 5,
        timeout,
      };

      const frame = JSON.stringify({
        type: "event",
        event: WORKER_EVENTS.TASK_DISPATCH,
        payload: dispatch,
      });

      worker.ws.send(frame);
    });
  }

  /**
   * Handle a task result from the Worker. Resolves the pending Promise.
   */
  handleTaskResult(result: TaskResult): boolean {
    const pending = this.pendingResults.get(result.taskId);
    if (!pending) {
      return false;
    }

    clearTimeout(pending.timer);
    this.pendingResults.delete(result.taskId);

    // Remove from active tasks on the worker
    for (const worker of this.workers.values()) {
      worker.activeTasks.delete(result.taskId);
    }

    // Update queue status
    if (result.status === "completed") {
      this.taskQueue.markCompleted(result.taskId, result.result).catch(() => {});
    } else {
      this.taskQueue.markFailed(result.taskId, result.error ?? "Unknown error").catch(() => {});
    }

    pending.resolve(result);
    return true;
  }

  /**
   * Drain queued tasks to a newly connected Worker.
   * Called after a Worker registers successfully.
   */
  async drainQueue(): Promise<number> {
    const worker = this.getWorker();
    if (!worker) {
      return 0;
    }

    const queued = await this.taskQueue.getQueued();
    let dispatched = 0;

    for (const task of queued) {
      await this.taskQueue.markRunning(task.id);

      const dispatch: TaskDispatch = {
        taskId: task.id,
        tool: task.payload.tool,
        params: task.payload.params,
        priority: task.priority,
        timeout: this.options.defaultTaskTimeout,
      };

      const frame = JSON.stringify({
        type: "event",
        event: WORKER_EVENTS.TASK_DISPATCH,
        payload: dispatch,
      });

      worker.ws.send(frame);
      dispatched++;
    }

    return dispatched;
  }

  // -------------------------------------------------------------------------
  // Routing decision
  // -------------------------------------------------------------------------

  /**
   * Determine how to execute a tool call based on Brain/Hands configuration.
   *
   * @param handsEnabled - Whether Brain/Hands mode is enabled in config
   * @param toolName - The tool to execute
   * @returns "local" to execute locally (single-machine mode or cloud-capable tool),
   *          "dispatch" to send to Worker,
   *          "queue" to enqueue for later (Worker offline)
   */
  getExecutionStrategy(handsEnabled: boolean, toolName: string): "local" | "dispatch" | "queue" {
    // If Brain/Hands is not enabled, always execute locally (single-machine mode)
    if (!handsEnabled) {
      return "local";
    }

    const location = classifyTool(toolName);

    // Cloud tools always execute locally in the Brain process
    if (location === "cloud") {
      return "local";
    }

    // Local or hybrid tools need the Worker
    if (this.isWorkerConnected()) {
      return "dispatch";
    }

    // No Worker connected — queue the task or classify hybrid as local
    if (location === "hybrid") {
      return "local";
    }

    return "queue";
  }

  // -------------------------------------------------------------------------
  // Accessors for testing and diagnostics
  // -------------------------------------------------------------------------

  get queue(): TaskQueueManager {
    return this.taskQueue;
  }

  get workerCount(): number {
    return this.workers.size;
  }

  /** Shut down and clean up all workers. */
  shutdown(): void {
    for (const [connId] of this.workers) {
      this.unregisterWorker(connId);
    }
  }
}
