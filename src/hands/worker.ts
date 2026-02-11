/**
 * Hands Worker
 *
 * A lightweight WebSocket client that runs on the local machine, connects
 * to the Brain's Gateway, and executes local-only tool calls. It delegates
 * to the EXISTING tool implementations — it does NOT reimplement any tools.
 *
 * Flow: Brain dispatches task → Worker receives via WS → Worker calls
 * the existing tool execute() → Worker sends result back via WS.
 *
 * @see DROFBOT-FORK-VISION.md section 2 (Brain/Hands Architecture)
 */

import { EventEmitter } from "node:events";
import os from "node:os";
import WebSocket from "ws";
import {
  WORKER_EVENTS,
  WORKER_METHODS,
  type TaskDispatch,
  type TaskResult,
  type WorkerHeartbeat,
  type WorkerRegister,
} from "../gateway/protocol/schema/worker.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HandsWorkerOptions {
  /** Brain Gateway WebSocket URL (e.g. "ws://localhost:18789"). */
  brainUrl: string;
  /** Shared secret for authentication. */
  secret: string;
  /** Which tools this Worker can execute. Default: all local tools. */
  capabilities?: string[];
  /** Heartbeat interval in seconds. Default: 30. */
  heartbeatInterval?: number;
  /** Max reconnection attempts. Default: 10. 0 = unlimited. */
  maxReconnectAttempts?: number;
  /** Tool executor: given a tool name and params, returns the result. */
  toolExecutor?: ToolExecutor;
}

export type ToolExecutor = (
  tool: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<{ content: unknown; error?: string }>;

type WorkerState = "disconnected" | "connecting" | "registering" | "connected" | "stopped";

// ---------------------------------------------------------------------------
// Default local tool capabilities
// ---------------------------------------------------------------------------

const DEFAULT_CAPABILITIES = [
  "read",
  "write",
  "edit",
  "exec",
  "process",
  "apply_patch",
  "grep",
  "find",
  "ls",
  "browser",
  "image",
];

// ---------------------------------------------------------------------------
// Worker Implementation
// ---------------------------------------------------------------------------

export class HandsWorker extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: WorkerState = "disconnected";
  private readonly options: Required<
    Pick<
      HandsWorkerOptions,
      "brainUrl" | "secret" | "capabilities" | "heartbeatInterval" | "maxReconnectAttempts"
    >
  >;
  private readonly toolExecutor: ToolExecutor;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private startedAt = Date.now();
  private activeTasks = new Map<string, AbortController>();

  constructor(opts: HandsWorkerOptions) {
    super();
    this.options = {
      brainUrl: opts.brainUrl,
      secret: opts.secret,
      capabilities: opts.capabilities ?? DEFAULT_CAPABILITIES,
      heartbeatInterval: opts.heartbeatInterval ?? 30,
      maxReconnectAttempts: opts.maxReconnectAttempts ?? 10,
    };
    this.toolExecutor = opts.toolExecutor ?? defaultToolExecutor;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Start the Worker: connect to the Brain's Gateway. */
  start(): void {
    if (this.state === "stopped") {
      return;
    }
    this.state = "connecting";
    this.reconnectAttempts = 0;
    this.connect();
  }

  /** Stop the Worker: disconnect and do not reconnect. */
  stop(): void {
    this.state = "stopped";
    this.stopHeartbeat();
    // Cancel all active tasks
    for (const [, controller] of this.activeTasks) {
      controller.abort();
    }
    this.activeTasks.clear();
    if (this.ws) {
      this.ws.close(1000, "Worker stopped");
      this.ws = null;
    }
  }

  /** Current connection state. */
  getState(): WorkerState {
    return this.state;
  }

  /** Whether the Worker is connected and registered. */
  isConnected(): boolean {
    return this.state === "connected";
  }

  // -------------------------------------------------------------------------
  // Connection
  // -------------------------------------------------------------------------

  private connect(): void {
    if (this.state === "stopped") {
      return;
    }

    try {
      this.ws = new WebSocket(this.options.brainUrl);
    } catch (err) {
      this.emit("error", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      this.state = "registering";
      this.register();
    });

    this.ws.on("message", (data) => {
      try {
        const frame = JSON.parse(data.toString());
        this.handleFrame(frame);
      } catch {
        // Ignore malformed frames
      }
    });

    this.ws.on("close", (code, reason) => {
      this.emit("disconnected", { code, reason: reason.toString() });
      this.stopHeartbeat();
      if (this.state !== "stopped") {
        this.state = "disconnected";
        this.scheduleReconnect();
      }
    });

    this.ws.on("error", (err) => {
      this.emit("error", err);
    });
  }

  private register(): void {
    const msg: WorkerRegister = {
      secret: this.options.secret,
      capabilities: this.options.capabilities,
      hostname: os.hostname(),
      platform: os.platform(),
    };

    this.send({
      type: "req",
      id: "register",
      method: WORKER_METHODS.REGISTER,
      params: msg,
    });
  }

  private scheduleReconnect(): void {
    if (this.state === "stopped") {
      return;
    }
    if (
      this.options.maxReconnectAttempts > 0 &&
      this.reconnectAttempts >= this.options.maxReconnectAttempts
    ) {
      this.emit("maxReconnectAttemptsReached");
      this.state = "stopped";
      return;
    }

    this.reconnectAttempts++;
    // Exponential backoff: 1s, 2s, 4s, 8s, ... capped at 60s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 60_000);
    this.emit("reconnecting", { attempt: this.reconnectAttempts, delay });

    setTimeout(() => {
      if (this.state !== "stopped") {
        this.connect();
      }
    }, delay);
  }

  // -------------------------------------------------------------------------
  // Message handling
  // -------------------------------------------------------------------------

  private handleFrame(frame: {
    type: string;
    event?: string;
    payload?: unknown;
    ok?: boolean;
    id?: string;
  }): void {
    // Handle ack response to our register request
    if (frame.type === "res" && frame.id === "register") {
      if (frame.ok) {
        this.state = "connected";
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit("connected", frame.payload);
      } else {
        this.emit("authFailed");
        this.state = "stopped";
        this.ws?.close(4001, "Authentication failed");
      }
      return;
    }

    // Handle events from Brain
    if (frame.type === "event" && frame.event) {
      switch (frame.event) {
        case WORKER_EVENTS.TASK_DISPATCH:
          this.handleTaskDispatch(frame.payload as TaskDispatch);
          break;
        case WORKER_EVENTS.TASK_CANCEL:
          this.handleTaskCancel((frame.payload as { taskId: string }).taskId);
          break;
        case WORKER_EVENTS.WORKER_ACK:
          // Already handled in register response
          break;
        default:
          // Forward unknown events for extensibility
          this.emit("unknownEvent", frame);
      }
    }
  }

  private async handleTaskDispatch(task: TaskDispatch): Promise<void> {
    const abortController = new AbortController();
    this.activeTasks.set(task.taskId, abortController);

    // Set up timeout
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    if (task.timeout && task.timeout > 0) {
      timeoutTimer = setTimeout(() => {
        abortController.abort();
      }, task.timeout);
      timeoutTimer.unref?.();
    }

    const startTime = Date.now();
    let result: TaskResult;

    try {
      this.emit("taskStart", { taskId: task.taskId, tool: task.tool });
      const output = await this.toolExecutor(task.tool, task.params, abortController.signal);

      if (output.error) {
        result = {
          taskId: task.taskId,
          status: "failed",
          error: output.error,
          duration: Date.now() - startTime,
        };
      } else {
        result = {
          taskId: task.taskId,
          status: "completed",
          result: output.content,
          duration: Date.now() - startTime,
        };
      }
    } catch (err) {
      result = {
        taskId: task.taskId,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - startTime,
      };
    } finally {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      this.activeTasks.delete(task.taskId);
    }

    this.emit("taskEnd", { taskId: task.taskId, tool: task.tool, status: result.status });

    // Send result back to Brain
    this.send({
      type: "req",
      id: `result-${task.taskId}`,
      method: WORKER_METHODS.TASK_RESULT,
      params: result,
    });
  }

  private handleTaskCancel(taskId: string): void {
    const controller = this.activeTasks.get(taskId);
    if (controller) {
      controller.abort();
      this.activeTasks.delete(taskId);
      this.emit("taskCancelled", { taskId });
    }
  }

  // -------------------------------------------------------------------------
  // Heartbeat
  // -------------------------------------------------------------------------

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.options.heartbeatInterval * 1000);
    this.heartbeatTimer.unref?.();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendHeartbeat(): void {
    const heartbeat: WorkerHeartbeat = {
      uptime: (Date.now() - this.startedAt) / 1000,
      load: os.loadavg()[0] ?? 0,
      activeTasks: this.activeTasks.size,
    };

    this.send({
      type: "req",
      id: `heartbeat-${Date.now()}`,
      method: WORKER_METHODS.HEARTBEAT,
      params: heartbeat,
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private send(frame: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }
}

// ---------------------------------------------------------------------------
// Default tool executor (no-op — actual implementation wires in real tools)
// ---------------------------------------------------------------------------

const defaultToolExecutor: ToolExecutor = async (tool, _params) => {
  return {
    content: null,
    error: `No executor configured for tool "${tool}". Wire in a ToolExecutor when creating the Worker.`,
  };
};
