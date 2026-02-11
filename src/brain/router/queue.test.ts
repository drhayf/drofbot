import { describe, expect, it, beforeEach, vi } from "vitest";
import { TaskQueueManager, type TaskInput } from "./queue.js";

// Mock Supabase as not configured — test the in-memory fallback path
vi.mock("../../shared/database/client.js", () => ({
  isSupabaseConfigured: () => false,
  getSupabaseClient: () => {
    throw new Error("Supabase not configured");
  },
}));

describe("TaskQueueManager (in-memory)", () => {
  let queue: TaskQueueManager;

  beforeEach(() => {
    queue = new TaskQueueManager();
  });

  const sampleTask: TaskInput = {
    tool: "exec",
    params: { command: "ls -la" },
    priority: 5,
    sessionKey: "test-session",
    channel: "telegram",
  };

  describe("enqueue", () => {
    it("returns a task ID", async () => {
      const id = await queue.enqueue(sampleTask);
      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
    });

    it("creates a task with queued status", async () => {
      const id = await queue.enqueue(sampleTask);
      const task = await queue.getTask(id);
      expect(task).not.toBeNull();
      expect(task!.status).toBe("queued");
      expect(task!.payload.tool).toBe("exec");
      expect(task!.type).toBe("local_skill");
    });

    it("uses default priority of 5", async () => {
      const id = await queue.enqueue({ tool: "read", params: {} });
      const task = await queue.getTask(id);
      expect(task!.priority).toBe(5);
    });

    it("respects custom priority", async () => {
      const id = await queue.enqueue({ ...sampleTask, priority: 10 });
      const task = await queue.getTask(id);
      expect(task!.priority).toBe(10);
    });
  });

  describe("markRunning", () => {
    it("transitions a task to running", async () => {
      const id = await queue.enqueue(sampleTask);
      await queue.markRunning(id);
      const task = await queue.getTask(id);
      expect(task!.status).toBe("running");
      expect(task!.startedAt).toBeInstanceOf(Date);
    });
  });

  describe("markCompleted", () => {
    it("transitions a task to completed with result", async () => {
      const id = await queue.enqueue(sampleTask);
      await queue.markRunning(id);
      await queue.markCompleted(id, { output: "success" });
      const task = await queue.getTask(id);
      expect(task!.status).toBe("completed");
      expect(task!.result).toEqual({ output: "success" });
      expect(task!.completedAt).toBeInstanceOf(Date);
    });
  });

  describe("markFailed", () => {
    it("transitions a task to failed with error", async () => {
      const id = await queue.enqueue(sampleTask);
      await queue.markRunning(id);
      await queue.markFailed(id, "Command failed");
      const task = await queue.getTask(id);
      expect(task!.status).toBe("failed");
      expect(task!.error).toBe("Command failed");
      expect(task!.completedAt).toBeInstanceOf(Date);
    });
  });

  describe("getQueued", () => {
    it("returns only queued tasks sorted by priority desc", async () => {
      const id1 = await queue.enqueue({ ...sampleTask, priority: 3 });
      const id2 = await queue.enqueue({ ...sampleTask, priority: 8 });
      const id3 = await queue.enqueue({ ...sampleTask, priority: 5 });

      // Mark one as running — should not appear in queued
      await queue.markRunning(id1);

      const queued = await queue.getQueued();
      expect(queued).toHaveLength(2);
      expect(queued[0].id).toBe(id2); // priority 8 first
      expect(queued[1].id).toBe(id3); // priority 5 second
    });

    it("returns empty array when no tasks are queued", async () => {
      const queued = await queue.getQueued();
      expect(queued).toHaveLength(0);
    });
  });

  describe("getTask", () => {
    it("returns null for non-existent task", async () => {
      const task = await queue.getTask("non-existent-id");
      expect(task).toBeNull();
    });
  });

  describe("cancel", () => {
    it("cancels a queued task", async () => {
      const id = await queue.enqueue(sampleTask);
      const cancelled = await queue.cancel(id);
      expect(cancelled).toBe(true);
      const task = await queue.getTask(id);
      expect(task!.status).toBe("failed");
      expect(task!.error).toBe("Cancelled");
    });

    it("does not cancel a running task", async () => {
      const id = await queue.enqueue(sampleTask);
      await queue.markRunning(id);
      const cancelled = await queue.cancel(id);
      expect(cancelled).toBe(false);
      const task = await queue.getTask(id);
      expect(task!.status).toBe("running");
    });

    it("returns false for non-existent task", async () => {
      const cancelled = await queue.cancel("non-existent-id");
      expect(cancelled).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("removes old completed tasks", async () => {
      const id = await queue.enqueue(sampleTask);
      await queue.markRunning(id);
      await queue.markCompleted(id, { ok: true });

      // Manually backdate the completedAt to make it old
      const task = await queue.getTask(id);
      task!.completedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      const removed = await queue.cleanup(7);
      expect(removed).toBe(1);
      expect(await queue.getTask(id)).toBeNull();
    });

    it("does not remove recent tasks", async () => {
      const id = await queue.enqueue(sampleTask);
      await queue.markRunning(id);
      await queue.markCompleted(id, { ok: true });

      const removed = await queue.cleanup(7);
      expect(removed).toBe(0);
    });
  });

  describe("getQueuedCount", () => {
    it("returns count of queued tasks", async () => {
      await queue.enqueue(sampleTask);
      await queue.enqueue(sampleTask);
      const id3 = await queue.enqueue(sampleTask);
      await queue.markRunning(id3);

      expect(await queue.getQueuedCount()).toBe(2);
    });
  });
});
