import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  TaskDispatchSchema,
  TaskCancelSchema,
  WorkerAckSchema,
  WorkerRegisterSchema,
  WorkerHeartbeatSchema,
  TaskProgressSchema,
  TaskResultSchema,
  WORKER_EVENTS,
  WORKER_METHODS,
} from "./worker.js";

describe("Worker Protocol Schemas", () => {
  describe("TaskDispatch", () => {
    it("validates a well-formed task dispatch", () => {
      const msg = {
        taskId: "abc-123",
        tool: "read",
        params: { path: "/tmp/file.txt" },
        priority: 5,
        timeout: 60000,
      };
      expect(Value.Check(TaskDispatchSchema, msg)).toBe(true);
    });

    it("validates without optional timeout", () => {
      const msg = {
        taskId: "abc-123",
        tool: "exec",
        params: { command: "ls -la" },
        priority: 1,
      };
      expect(Value.Check(TaskDispatchSchema, msg)).toBe(true);
    });

    it("rejects missing taskId", () => {
      const msg = {
        tool: "read",
        params: {},
        priority: 5,
      };
      expect(Value.Check(TaskDispatchSchema, msg)).toBe(false);
    });

    it("rejects priority outside range", () => {
      const msg = {
        taskId: "abc",
        tool: "read",
        params: {},
        priority: 0,
      };
      expect(Value.Check(TaskDispatchSchema, msg)).toBe(false);
    });
  });

  describe("TaskCancel", () => {
    it("validates a cancel message", () => {
      expect(Value.Check(TaskCancelSchema, { taskId: "abc" })).toBe(true);
    });

    it("rejects empty taskId", () => {
      expect(Value.Check(TaskCancelSchema, { taskId: "" })).toBe(false);
    });
  });

  describe("WorkerAck", () => {
    it("validates ack with zero queued tasks", () => {
      expect(Value.Check(WorkerAckSchema, { queuedTasks: 0 })).toBe(true);
    });

    it("validates ack with queued tasks", () => {
      expect(Value.Check(WorkerAckSchema, { queuedTasks: 5 })).toBe(true);
    });

    it("rejects negative queued tasks", () => {
      expect(Value.Check(WorkerAckSchema, { queuedTasks: -1 })).toBe(false);
    });
  });

  describe("WorkerRegister", () => {
    it("validates a valid worker registration", () => {
      const msg = {
        secret: "my-secret-123",
        capabilities: ["read", "write", "exec"],
        hostname: "my-laptop",
        platform: "darwin",
      };
      expect(Value.Check(WorkerRegisterSchema, msg)).toBe(true);
    });

    it("rejects empty secret", () => {
      const msg = {
        secret: "",
        capabilities: ["read"],
        hostname: "my-laptop",
        platform: "darwin",
      };
      expect(Value.Check(WorkerRegisterSchema, msg)).toBe(false);
    });

    it("rejects missing hostname", () => {
      const msg = {
        secret: "secret",
        capabilities: [],
        platform: "linux",
      };
      expect(Value.Check(WorkerRegisterSchema, msg)).toBe(false);
    });
  });

  describe("WorkerHeartbeat", () => {
    it("validates a heartbeat message", () => {
      const msg = {
        uptime: 3600.5,
        load: 1.5,
        activeTasks: 2,
      };
      expect(Value.Check(WorkerHeartbeatSchema, msg)).toBe(true);
    });

    it("rejects negative uptime", () => {
      const msg = { uptime: -1, load: 0, activeTasks: 0 };
      expect(Value.Check(WorkerHeartbeatSchema, msg)).toBe(false);
    });
  });

  describe("TaskProgress", () => {
    it("validates a progress report", () => {
      const msg = {
        taskId: "task-1",
        progress: 50,
        message: "Halfway done",
      };
      expect(Value.Check(TaskProgressSchema, msg)).toBe(true);
    });

    it("validates without optional message", () => {
      const msg = {
        taskId: "task-1",
        progress: 100,
      };
      expect(Value.Check(TaskProgressSchema, msg)).toBe(true);
    });

    it("rejects progress over 100", () => {
      const msg = {
        taskId: "task-1",
        progress: 101,
      };
      expect(Value.Check(TaskProgressSchema, msg)).toBe(false);
    });
  });

  describe("TaskResult", () => {
    it("validates a completed task result", () => {
      const msg = {
        taskId: "task-1",
        status: "completed",
        result: { content: "file contents" },
        duration: 1500,
      };
      expect(Value.Check(TaskResultSchema, msg)).toBe(true);
    });

    it("validates a failed task result", () => {
      const msg = {
        taskId: "task-1",
        status: "failed",
        error: "File not found",
        duration: 200,
      };
      expect(Value.Check(TaskResultSchema, msg)).toBe(true);
    });

    it("rejects invalid status", () => {
      const msg = {
        taskId: "task-1",
        status: "cancelled",
        duration: 100,
      };
      expect(Value.Check(TaskResultSchema, msg)).toBe(false);
    });

    it("rejects missing duration", () => {
      const msg = {
        taskId: "task-1",
        status: "completed",
      };
      expect(Value.Check(TaskResultSchema, msg)).toBe(false);
    });
  });

  describe("Protocol constants", () => {
    it("defines worker event names", () => {
      expect(WORKER_EVENTS.TASK_DISPATCH).toBe("worker.task.dispatch");
      expect(WORKER_EVENTS.TASK_CANCEL).toBe("worker.task.cancel");
      expect(WORKER_EVENTS.WORKER_ACK).toBe("worker.ack");
    });

    it("defines worker method names", () => {
      expect(WORKER_METHODS.REGISTER).toBe("worker.register");
      expect(WORKER_METHODS.HEARTBEAT).toBe("worker.heartbeat");
      expect(WORKER_METHODS.TASK_PROGRESS).toBe("worker.task.progress");
      expect(WORKER_METHODS.TASK_RESULT).toBe("worker.task.result");
    });
  });
});
