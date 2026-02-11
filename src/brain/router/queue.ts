/**
 * Task Queue Manager
 *
 * Manages the task queue for Brain→Worker dispatch. Uses the existing
 * `task_queue` table in Supabase (migration 002) when available, with
 * an in-memory fallback for when Supabase is not configured.
 *
 * Lifecycle: queued → running → completed/failed
 *
 * @see src/shared/database/migrations/002_task_queue.sql
 */

import { randomUUID } from "node:crypto";
import { isSupabaseConfigured, getSupabaseClient } from "../../shared/database/client.js";

export type TaskStatus = "queued" | "running" | "completed" | "failed";

export interface TaskInput {
  tool: string;
  params: Record<string, unknown>;
  priority?: number;
  /** Originating session key for routing progress/result messages. */
  sessionKey?: string;
  /** Originating channel for progress updates. */
  channel?: string;
}

export interface TaskQueueEntry {
  id: string;
  type: string;
  status: TaskStatus;
  payload: TaskInput;
  result: unknown | null;
  priority: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
}

export class TaskQueueManager {
  /** In-memory fallback queue (used when Supabase is not configured). */
  private memoryQueue = new Map<string, TaskQueueEntry>();

  private get useSupabase(): boolean {
    return isSupabaseConfigured();
  }

  /** Queue a task for Worker execution. Returns the task ID. */
  async enqueue(input: TaskInput): Promise<string> {
    const id = randomUUID();
    const priority = input.priority ?? 5;
    const now = new Date();

    if (this.useSupabase) {
      const client = getSupabaseClient();
      const { error } = await client.from("task_queue").insert({
        id,
        type: "local_skill",
        status: "queued" as const,
        payload: input,
        priority,
        created_at: now.toISOString(),
      });
      if (error) throw new Error(`Failed to enqueue task: ${error.message}`);
    } else {
      this.memoryQueue.set(id, {
        id,
        type: "local_skill",
        status: "queued",
        payload: input,
        result: null,
        priority,
        createdAt: now,
        startedAt: null,
        completedAt: null,
        error: null,
      });
    }

    return id;
  }

  /** Mark a task as running (Worker picked it up). */
  async markRunning(taskId: string): Promise<void> {
    const now = new Date();
    if (this.useSupabase) {
      const client = getSupabaseClient();
      const { error } = await client
        .from("task_queue")
        .update({ status: "running", started_at: now.toISOString() })
        .eq("id", taskId);
      if (error) throw new Error(`Failed to mark task running: ${error.message}`);
    } else {
      const entry = this.memoryQueue.get(taskId);
      if (entry) {
        entry.status = "running";
        entry.startedAt = now;
      }
    }
  }

  /** Mark a task as completed with its result. */
  async markCompleted(taskId: string, result: unknown): Promise<void> {
    const now = new Date();
    if (this.useSupabase) {
      const client = getSupabaseClient();
      const { error } = await client
        .from("task_queue")
        .update({
          status: "completed",
          result: result as Record<string, unknown>,
          completed_at: now.toISOString(),
        })
        .eq("id", taskId);
      if (error) throw new Error(`Failed to mark task completed: ${error.message}`);
    } else {
      const entry = this.memoryQueue.get(taskId);
      if (entry) {
        entry.status = "completed";
        entry.result = result;
        entry.completedAt = now;
      }
    }
  }

  /** Mark a task as failed with an error message. */
  async markFailed(taskId: string, error: string): Promise<void> {
    const now = new Date();
    if (this.useSupabase) {
      const client = getSupabaseClient();
      const { error: dbError } = await client
        .from("task_queue")
        .update({
          status: "failed",
          error,
          completed_at: now.toISOString(),
        })
        .eq("id", taskId);
      if (dbError) throw new Error(`Failed to mark task failed: ${dbError.message}`);
    } else {
      const entry = this.memoryQueue.get(taskId);
      if (entry) {
        entry.status = "failed";
        entry.error = error;
        entry.completedAt = now;
      }
    }
  }

  /** Get all queued tasks, ordered by priority (highest first) then creation time. */
  async getQueued(): Promise<TaskQueueEntry[]> {
    if (this.useSupabase) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("task_queue")
        .select("*")
        .eq("status", "queued")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw new Error(`Failed to get queued tasks: ${error.message}`);
      return ((data ?? []) as unknown as SupabaseQueueRow[]).map(rowToEntry);
    } else {
      return Array.from(this.memoryQueue.values())
        .filter((e) => e.status === "queued")
        .sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime());
    }
  }

  /** Get a task by ID. */
  async getTask(taskId: string): Promise<TaskQueueEntry | null> {
    if (this.useSupabase) {
      const client = getSupabaseClient();
      const { data, error } = await client.from("task_queue").select("*").eq("id", taskId).single();
      if (error) return null;
      return data ? rowToEntry(data as unknown as SupabaseQueueRow) : null;
    } else {
      return this.memoryQueue.get(taskId) ?? null;
    }
  }

  /** Cancel a queued task. Only queued tasks can be cancelled. */
  async cancel(taskId: string): Promise<boolean> {
    if (this.useSupabase) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("task_queue")
        .update({ status: "failed", error: "Cancelled", completed_at: new Date().toISOString() })
        .eq("id", taskId)
        .eq("status", "queued")
        .select("id");
      if (error) throw new Error(`Failed to cancel task: ${error.message}`);
      return (data?.length ?? 0) > 0;
    } else {
      const entry = this.memoryQueue.get(taskId);
      if (entry && entry.status === "queued") {
        entry.status = "failed";
        entry.error = "Cancelled";
        entry.completedAt = new Date();
        return true;
      }
      return false;
    }
  }

  /** Clean up old completed/failed tasks older than the specified days. Returns count removed. */
  async cleanup(olderThanDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    if (this.useSupabase) {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("task_queue")
        .delete()
        .in("status", ["completed", "failed"])
        .lt("completed_at", cutoff.toISOString())
        .select("id");
      if (error) throw new Error(`Failed to cleanup tasks: ${error.message}`);
      return data?.length ?? 0;
    } else {
      let count = 0;
      for (const [id, entry] of this.memoryQueue) {
        if (
          (entry.status === "completed" || entry.status === "failed") &&
          entry.completedAt &&
          entry.completedAt < cutoff
        ) {
          this.memoryQueue.delete(id);
          count++;
        }
      }
      return count;
    }
  }

  /** Get the count of queued tasks. */
  async getQueuedCount(): Promise<number> {
    if (this.useSupabase) {
      const client = getSupabaseClient();
      const { count, error } = await client
        .from("task_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "queued");
      if (error) return 0;
      return count ?? 0;
    } else {
      return Array.from(this.memoryQueue.values()).filter((e) => e.status === "queued").length;
    }
  }

  /** Reset in-memory queue. For testing only. */
  _resetMemoryQueue(): void {
    this.memoryQueue.clear();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shape returned by the Supabase `task_queue` table (snake_case columns). */
interface SupabaseQueueRow {
  id: string;
  type: string;
  status: TaskStatus;
  payload: TaskInput;
  result: unknown;
  priority: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

function rowToEntry(row: SupabaseQueueRow): TaskQueueEntry {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    payload: row.payload,
    result: row.result ?? null,
    priority: row.priority ?? 5,
    createdAt: new Date(row.created_at),
    startedAt: row.started_at ? new Date(row.started_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    error: row.error ?? null,
  };
}
