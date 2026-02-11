import { describe, expect, it, beforeEach, vi } from "vitest";
import { WorkerRegistry, type WorkerConnection } from "./worker-registry.js";

// Mock Supabase as not configured for in-memory queue
vi.mock("../../shared/database/client.js", () => ({
  isSupabaseConfigured: () => false,
  getSupabaseClient: () => {
    throw new Error("Supabase not configured");
  },
}));

/** Create a mock WebSocket that records sent messages. */
function createMockWs() {
  const sent: string[] = [];
  return {
    ws: {
      readyState: 1, // OPEN
      send: (data: string) => {
        sent.push(data);
      },
      close: vi.fn(),
    },
    sent,
  };
}

describe("WorkerRegistry", () => {
  let registry: WorkerRegistry;

  beforeEach(() => {
    registry = new WorkerRegistry({ workerSecret: "test-secret-42" });
  });

  describe("validateSecret", () => {
    it("accepts correct secret", () => {
      expect(registry.validateSecret("test-secret-42")).toBe(true);
    });

    it("rejects wrong secret", () => {
      expect(registry.validateSecret("wrong-secret")).toBe(false);
    });

    it("rejects empty secret", () => {
      expect(registry.validateSecret("")).toBe(false);
    });

    it("rejects when no secret is configured", () => {
      const emptyRegistry = new WorkerRegistry({ workerSecret: "" });
      expect(emptyRegistry.validateSecret("anything")).toBe(false);
    });
  });

  describe("registerWorker", () => {
    it("registers a worker and makes it available", () => {
      const { ws } = createMockWs();
      registry.registerWorker(ws as any, {
        connId: "conn-1",
        hostname: "laptop",
        platform: "darwin",
        capabilities: ["read", "exec"],
      });

      expect(registry.isWorkerConnected()).toBe(true);
      expect(registry.workerCount).toBe(1);

      const worker = registry.getWorker();
      expect(worker).toBeDefined();
      expect(worker!.hostname).toBe("laptop");
      expect(worker!.platform).toBe("darwin");
    });
  });

  describe("unregisterWorker", () => {
    it("removes a worker", () => {
      const { ws } = createMockWs();
      registry.registerWorker(ws as any, {
        connId: "conn-1",
        hostname: "laptop",
        platform: "darwin",
        capabilities: [],
      });

      registry.unregisterWorker("conn-1");
      expect(registry.isWorkerConnected()).toBe(false);
      expect(registry.workerCount).toBe(0);
    });

    it("is a no-op for unknown connId", () => {
      registry.unregisterWorker("unknown");
      expect(registry.workerCount).toBe(0);
    });
  });

  describe("updateHeartbeat", () => {
    it("updates the last heartbeat time", async () => {
      const { ws } = createMockWs();
      registry.registerWorker(ws as any, {
        connId: "conn-1",
        hostname: "laptop",
        platform: "linux",
        capabilities: [],
      });

      const before = registry.getWorker()!.lastHeartbeat.getTime();

      // Real delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 5));

      registry.updateHeartbeat("conn-1");
      const after = registry.getWorker()!.lastHeartbeat.getTime();

      expect(after).toBeGreaterThan(before);
    });
  });

  describe("getExecutionStrategy", () => {
    it('returns "local" when hands is disabled', () => {
      expect(registry.getExecutionStrategy(false, "exec")).toBe("local");
      expect(registry.getExecutionStrategy(false, "web_search")).toBe("local");
    });

    it('returns "local" for cloud tools even when hands is enabled', () => {
      expect(registry.getExecutionStrategy(true, "web_search")).toBe("local");
      expect(registry.getExecutionStrategy(true, "memory_store")).toBe("local");
      expect(registry.getExecutionStrategy(true, "message")).toBe("local");
    });

    it('returns "dispatch" for local tools when worker is connected', () => {
      const { ws } = createMockWs();
      registry.registerWorker(ws as any, {
        connId: "conn-1",
        hostname: "laptop",
        platform: "darwin",
        capabilities: [],
      });

      expect(registry.getExecutionStrategy(true, "exec")).toBe("dispatch");
      expect(registry.getExecutionStrategy(true, "read")).toBe("dispatch");
      expect(registry.getExecutionStrategy(true, "write")).toBe("dispatch");
    });

    it('returns "queue" for local tools when no worker is connected', () => {
      expect(registry.getExecutionStrategy(true, "exec")).toBe("queue");
      expect(registry.getExecutionStrategy(true, "read")).toBe("queue");
    });

    it('returns "local" for hybrid tools when no worker is connected', () => {
      expect(registry.getExecutionStrategy(true, "browser")).toBe("local");
      expect(registry.getExecutionStrategy(true, "image")).toBe("local");
    });

    it('returns "dispatch" for hybrid tools when worker is connected', () => {
      const { ws } = createMockWs();
      registry.registerWorker(ws as any, {
        connId: "conn-1",
        hostname: "laptop",
        platform: "linux",
        capabilities: [],
      });

      expect(registry.getExecutionStrategy(true, "browser")).toBe("dispatch");
    });
  });

  describe("dispatchToWorker", () => {
    it("sends task to connected worker via WebSocket", async () => {
      const { ws, sent } = createMockWs();
      registry.registerWorker(ws as any, {
        connId: "conn-1",
        hostname: "laptop",
        platform: "darwin",
        capabilities: ["exec"],
      });

      // Don't await — we'll resolve it manually
      const resultPromise = registry.dispatchToWorker("exec", { command: "ls" });

      // The dispatch is async (enqueue first), wait for microtasks
      await new Promise((r) => setTimeout(r, 10));

      // The frame should have been sent
      expect(sent).toHaveLength(1);
      const frame = JSON.parse(sent[0]);
      expect(frame.type).toBe("event");
      expect(frame.event).toBe("worker.task.dispatch");
      expect(frame.payload.tool).toBe("exec");
      expect(frame.payload.params).toEqual({ command: "ls" });

      // Resolve it by handling a task result
      const taskId = frame.payload.taskId;
      registry.handleTaskResult({
        taskId,
        status: "completed",
        result: { output: "file1.txt" },
        duration: 100,
      });

      const result = await resultPromise;
      expect(result.status).toBe("completed");
      expect(result.result).toEqual({ output: "file1.txt" });
    });

    it("returns queued message when no worker is connected", async () => {
      const result = await registry.dispatchToWorker("exec", { command: "ls" });
      expect(result.status).toBe("failed");
      expect(result.error).toContain("offline");
      expect(result.error).toContain("queued");
    });
  });

  describe("handleTaskResult", () => {
    it("returns false for unknown task ID", () => {
      const handled = registry.handleTaskResult({
        taskId: "unknown-task",
        status: "completed",
        result: null,
        duration: 0,
      });
      expect(handled).toBe(false);
    });
  });

  describe("drainQueue", () => {
    it("dispatches queued tasks to newly connected worker", async () => {
      // Enqueue some tasks while no worker is connected
      await registry.queue.enqueue({ tool: "exec", params: { command: "ls" } });
      await registry.queue.enqueue({ tool: "read", params: { path: "/tmp" } });

      // Now connect a worker
      const { ws, sent } = createMockWs();
      registry.registerWorker(ws as any, {
        connId: "conn-1",
        hostname: "laptop",
        platform: "darwin",
        capabilities: [],
      });

      const dispatched = await registry.drainQueue();
      expect(dispatched).toBe(2);
      expect(sent).toHaveLength(2);

      // Verify the sent frames
      for (const raw of sent) {
        const frame = JSON.parse(raw);
        expect(frame.type).toBe("event");
        expect(frame.event).toBe("worker.task.dispatch");
      }
    });

    it("returns 0 when no tasks are queued", async () => {
      const { ws } = createMockWs();
      registry.registerWorker(ws as any, {
        connId: "conn-1",
        hostname: "laptop",
        platform: "darwin",
        capabilities: [],
      });

      const dispatched = await registry.drainQueue();
      expect(dispatched).toBe(0);
    });

    it("returns 0 when no worker is connected", async () => {
      await registry.queue.enqueue({ tool: "exec", params: {} });
      const dispatched = await registry.drainQueue();
      expect(dispatched).toBe(0);
    });
  });

  describe("shutdown", () => {
    it("removes all workers", () => {
      const { ws: ws1 } = createMockWs();
      const { ws: ws2 } = createMockWs();
      registry.registerWorker(ws1 as any, {
        connId: "conn-1",
        hostname: "laptop1",
        platform: "darwin",
        capabilities: [],
      });
      registry.registerWorker(ws2 as any, {
        connId: "conn-2",
        hostname: "laptop2",
        platform: "linux",
        capabilities: [],
      });

      expect(registry.workerCount).toBe(2);
      registry.shutdown();
      expect(registry.workerCount).toBe(0);
      expect(registry.isWorkerConnected()).toBe(false);
    });
  });
});
