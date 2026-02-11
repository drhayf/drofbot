/**
 * Hands Heartbeat
 *
 * Periodic health check between Hands Worker and Brain. Reports worker
 * status, resource usage, and active task count. Brain uses this to
 * determine liveness and decide whether to dispatch or queue tasks.
 *
 * Uses a setTimeout chain (not setInterval) to match the Gateway's
 * existing runner pattern. Each heartbeat schedules the next, so drift
 * from long-running heartbeat callbacks doesn't compound.
 */

import os from "node:os";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeartbeatPayload {
  uptime: number;
  load: number;
  activeTasks: number;
  memory?: { free: number; total: number };
}

export interface HeartbeatOptions {
  /** Interval in seconds between heartbeats. Default: 30s */
  intervalSec?: number;
  /** Returns the number of currently active tasks. */
  getActiveTaskCount: () => number;
  /** Called with each heartbeat payload. Implementor sends it over WS. */
  onHeartbeat: (payload: HeartbeatPayload) => void;
}

// ---------------------------------------------------------------------------
// Heartbeat Runner
// ---------------------------------------------------------------------------

export class HandsHeartbeat {
  private readonly intervalMs: number;
  private readonly getActiveTaskCount: () => number;
  private readonly onHeartbeat: (payload: HeartbeatPayload) => void;
  private startedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(opts: HeartbeatOptions) {
    this.intervalMs = (opts.intervalSec ?? 30) * 1000;
    this.getActiveTaskCount = opts.getActiveTaskCount;
    this.onHeartbeat = opts.onHeartbeat;
  }

  /** Start the heartbeat loop. First beat fires after one full interval. */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.startedAt = Date.now();
    this.scheduleNext();
  }

  /** Stop the heartbeat loop. Safe to call multiple times. */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Whether the heartbeat loop is running. */
  isRunning(): boolean {
    return this.running;
  }

  /** Build a heartbeat payload (exported for testing). */
  buildPayload(): HeartbeatPayload {
    return {
      uptime: (Date.now() - this.startedAt) / 1000,
      load: os.loadavg()[0] ?? 0,
      activeTasks: this.getActiveTaskCount(),
      memory: {
        free: os.freemem(),
        total: os.totalmem(),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Internal setTimeout chain
  // -------------------------------------------------------------------------

  private scheduleNext(): void {
    if (!this.running) {
      return;
    }
    this.timer = setTimeout(() => {
      if (!this.running) {
        return;
      }
      try {
        const payload = this.buildPayload();
        this.onHeartbeat(payload);
      } catch {
        // Swallow errors to keep the chain alive
      }
      this.scheduleNext();
    }, this.intervalMs);
    this.timer.unref?.();
  }
}
