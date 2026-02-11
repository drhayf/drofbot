import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { WORKER_EVENTS, WORKER_METHODS } from "../gateway/protocol/schema/worker.js";
import { HandsWorker, type ToolExecutor } from "./worker.js";

// ---------------------------------------------------------------------------
// Minimal mock for ws.WebSocket
// ---------------------------------------------------------------------------

const mockWsInstances: MockWs[] = [];

class MockWs {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWs.OPEN;
  handlers = new Map<string, (...args: unknown[]) => void>();
  sent: string[] = [];
  closeCode?: number;
  closeReason?: string;

  on(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.set(event, handler);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = MockWs.CLOSED;
    const handler = this.handlers.get("close");
    if (handler) {
      handler(code, Buffer.from(reason ?? ""));
    }
  }

  // Simulate receiving a message
  receive(frame: Record<string, unknown>) {
    const handler = this.handlers.get("message");
    if (handler) {
      handler(JSON.stringify(frame));
    }
  }

  // Simulate connection open
  simulateOpen() {
    const handler = this.handlers.get("open");
    if (handler) {
      handler();
    }
  }
}

// Mock the ws module
vi.mock("ws", () => {
  return {
    default: class {
      static OPEN = 1;
      static CLOSED = 3;
      readyState = 1;
      handlers = new Map();
      sent: string[] = [];
      closeCode?: number;
      closeReason?: string;

      constructor() {
        const instance = new MockWs();
        // Copy handler registration to mock
        this.on = instance.on.bind(instance);
        this.send = instance.send.bind(instance);
        this.close = instance.close.bind(instance);
        Object.defineProperty(this, "readyState", {
          get: () => instance.readyState,
          set: (v) => {
            instance.readyState = v;
          },
        });
        Object.defineProperty(this, "sent", {
          get: () => instance.sent,
        });
        // Store so tests can access
        mockWsInstances.push(instance);
        // Also store reference on this
        (this as Record<string, unknown>).__mock = instance;
      }

      on(_e: string, _h: unknown) {}
      send(_d: string) {}
      close(_c?: number, _r?: string) {}
    },
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HandsWorker", () => {
  const defaultOpts = {
    brainUrl: "ws://localhost:18789",
    secret: "test-secret-123",
    maxReconnectAttempts: 1,
  };

  const noopExecutor: ToolExecutor = async () => ({ content: "ok" });

  beforeEach(() => {
    mockWsInstances.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates in disconnected state", () => {
    const worker = new HandsWorker({ ...defaultOpts, toolExecutor: noopExecutor });
    expect(worker.getState()).toBe("disconnected");
    expect(worker.isConnected()).toBe(false);
  });

  it("start transitions to connecting state", () => {
    const worker = new HandsWorker({ ...defaultOpts, toolExecutor: noopExecutor });
    worker.start();
    expect(worker.getState()).toBe("connecting");
    worker.stop();
  });

  it("stop transitions to stopped state", () => {
    const worker = new HandsWorker({ ...defaultOpts, toolExecutor: noopExecutor });
    worker.start();
    worker.stop();
    expect(worker.getState()).toBe("stopped");
  });

  it("does not restart if stopped", () => {
    const worker = new HandsWorker({ ...defaultOpts, toolExecutor: noopExecutor });
    worker.stop();
    worker.start();
    expect(worker.getState()).toBe("stopped");
  });

  it("sends register message on connection open", () => {
    const worker = new HandsWorker({ ...defaultOpts, toolExecutor: noopExecutor });
    worker.start();
    expect(mockWsInstances).toHaveLength(1);

    const ws = mockWsInstances[0];
    ws.simulateOpen();

    expect(ws.sent).toHaveLength(1);
    const msg = JSON.parse(ws.sent[0]);
    expect(msg.type).toBe("req");
    expect(msg.method).toBe(WORKER_METHODS.REGISTER);
    expect(msg.params.secret).toBe("test-secret-123");
    expect(msg.params.capabilities).toContain("read");
    expect(msg.params.capabilities).toContain("exec");

    worker.stop();
  });

  it("transitions to connected on successful register ack", () => {
    const connected = vi.fn();
    const worker = new HandsWorker({ ...defaultOpts, toolExecutor: noopExecutor });
    worker.on("connected", connected);
    worker.start();

    const ws = mockWsInstances[0];
    ws.simulateOpen();

    // Simulate server ack
    ws.receive({ type: "res", id: "register", ok: true, payload: {} });

    expect(worker.getState()).toBe("connected");
    expect(worker.isConnected()).toBe(true);
    expect(connected).toHaveBeenCalledTimes(1);

    worker.stop();
  });

  it("stops on auth failure", () => {
    const authFailed = vi.fn();
    const worker = new HandsWorker({ ...defaultOpts, toolExecutor: noopExecutor });
    worker.on("authFailed", authFailed);
    worker.start();

    const ws = mockWsInstances[0];
    ws.simulateOpen();
    ws.receive({ type: "res", id: "register", ok: false });

    expect(worker.getState()).toBe("stopped");
    expect(authFailed).toHaveBeenCalledTimes(1);

    worker.stop();
  });

  it("executes dispatched task and sends result", async () => {
    const executor: ToolExecutor = async (tool, params) => {
      return { content: { tool, echo: params.input } };
    };

    const worker = new HandsWorker({ ...defaultOpts, toolExecutor: executor });
    worker.start();

    const ws = mockWsInstances[0];
    ws.simulateOpen();
    ws.receive({ type: "res", id: "register", ok: true, payload: {} });

    // Dispatch a task
    ws.receive({
      type: "event",
      event: WORKER_EVENTS.TASK_DISPATCH,
      payload: {
        taskId: "task-1",
        tool: "read",
        params: { input: "hello" },
        timeout: 5000,
      },
    });

    // Wait for async execution
    await new Promise((r) => setTimeout(r, 50));

    // Should have sent register + result
    expect(ws.sent.length).toBeGreaterThanOrEqual(2);
    const resultMsg = JSON.parse(ws.sent[ws.sent.length - 1]);
    expect(resultMsg.method).toBe(WORKER_METHODS.TASK_RESULT);
    expect(resultMsg.params.taskId).toBe("task-1");
    expect(resultMsg.params.status).toBe("completed");
    expect(resultMsg.params.result).toEqual({ tool: "read", echo: "hello" });

    worker.stop();
  });

  it("sends failed result on executor error", async () => {
    const executor: ToolExecutor = async () => {
      throw new Error("kaboom");
    };

    const worker = new HandsWorker({ ...defaultOpts, toolExecutor: executor });
    worker.start();

    const ws = mockWsInstances[0];
    ws.simulateOpen();
    ws.receive({ type: "res", id: "register", ok: true, payload: {} });

    ws.receive({
      type: "event",
      event: WORKER_EVENTS.TASK_DISPATCH,
      payload: { taskId: "task-err", tool: "exec", params: {}, timeout: 5000 },
    });

    await new Promise((r) => setTimeout(r, 50));

    const resultMsg = JSON.parse(ws.sent[ws.sent.length - 1]);
    expect(resultMsg.params.taskId).toBe("task-err");
    expect(resultMsg.params.status).toBe("failed");
    expect(resultMsg.params.error).toBe("kaboom");

    worker.stop();
  });

  it("cancels a running task", async () => {
    let abortSignalRef: AbortSignal | undefined;
    const executor: ToolExecutor = async (_tool, _params, signal) => {
      abortSignalRef = signal;
      // Simulate a long-running task
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve({ content: "done" }), 10_000);
        signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve({ content: null, error: "aborted" });
        });
      });
    };

    const worker = new HandsWorker({ ...defaultOpts, toolExecutor: executor });
    worker.start();

    const ws = mockWsInstances[0];
    ws.simulateOpen();
    ws.receive({ type: "res", id: "register", ok: true, payload: {} });

    // Dispatch task
    ws.receive({
      type: "event",
      event: WORKER_EVENTS.TASK_DISPATCH,
      payload: { taskId: "task-cancel", tool: "exec", params: {}, timeout: 30_000 },
    });

    // Give it a moment to start
    await new Promise((r) => setTimeout(r, 20));

    // Cancel the task
    ws.receive({
      type: "event",
      event: WORKER_EVENTS.TASK_CANCEL,
      payload: { taskId: "task-cancel" },
    });

    // Verify abort signal was triggered
    await new Promise((r) => setTimeout(r, 50));
    expect(abortSignalRef?.aborted).toBe(true);

    worker.stop();
  });

  it("emits taskStart and taskEnd events", async () => {
    const taskStart = vi.fn();
    const taskEnd = vi.fn();

    const worker = new HandsWorker({ ...defaultOpts, toolExecutor: noopExecutor });
    worker.on("taskStart", taskStart);
    worker.on("taskEnd", taskEnd);
    worker.start();

    const ws = mockWsInstances[0];
    ws.simulateOpen();
    ws.receive({ type: "res", id: "register", ok: true, payload: {} });

    ws.receive({
      type: "event",
      event: WORKER_EVENTS.TASK_DISPATCH,
      payload: { taskId: "task-ev", tool: "ls", params: {}, timeout: 5000 },
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(taskStart).toHaveBeenCalledWith({ taskId: "task-ev", tool: "ls" });
    expect(taskEnd).toHaveBeenCalledWith({ taskId: "task-ev", tool: "ls", status: "completed" });

    worker.stop();
  });

  it("uses custom capabilities", () => {
    const worker = new HandsWorker({
      ...defaultOpts,
      capabilities: ["read", "write"],
      toolExecutor: noopExecutor,
    });
    worker.start();

    const ws = mockWsInstances[0];
    ws.simulateOpen();

    const msg = JSON.parse(ws.sent[0]);
    expect(msg.params.capabilities).toEqual(["read", "write"]);

    worker.stop();
  });

  it("handles executor returning error field", async () => {
    const executor: ToolExecutor = async () => {
      return { content: null, error: "tool not available" };
    };

    const worker = new HandsWorker({ ...defaultOpts, toolExecutor: executor });
    worker.start();

    const ws = mockWsInstances[0];
    ws.simulateOpen();
    ws.receive({ type: "res", id: "register", ok: true, payload: {} });

    ws.receive({
      type: "event",
      event: WORKER_EVENTS.TASK_DISPATCH,
      payload: { taskId: "task-soft-err", tool: "unknown", params: {}, timeout: 5000 },
    });

    await new Promise((r) => setTimeout(r, 50));

    const resultMsg = JSON.parse(ws.sent[ws.sent.length - 1]);
    expect(resultMsg.params.status).toBe("failed");
    expect(resultMsg.params.error).toBe("tool not available");

    worker.stop();
  });

  it("ignores malformed messages", () => {
    const worker = new HandsWorker({ ...defaultOpts, toolExecutor: noopExecutor });
    worker.start();

    const ws = mockWsInstances[0];
    ws.simulateOpen();

    // Send invalid JSON
    const handler = ws.handlers.get("message");
    expect(() => handler?.("not json")).not.toThrow();

    worker.stop();
  });
});
