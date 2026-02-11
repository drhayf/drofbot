import { describe, expect, it, beforeEach } from "vitest";
import {
  registerTaskOrigin,
  unregisterTaskOrigin,
  getTaskOrigin,
  formatProgressMessage,
  formatCompletionMessage,
  formatFailureMessage,
} from "./progress.js";

describe("TaskOriginRegistry", () => {
  const origin = {
    taskId: "task-abc-123",
    channel: "telegram",
    to: "12345678",
    sessionKey: "main",
    threadId: "thread-1",
  };

  beforeEach(() => {
    // Clean up any leftovers
    unregisterTaskOrigin("task-abc-123");
  });

  it("registers and retrieves a task origin", () => {
    registerTaskOrigin(origin);
    expect(getTaskOrigin("task-abc-123")).toEqual(origin);
  });

  it("returns undefined for unknown task", () => {
    expect(getTaskOrigin("nonexistent")).toBeUndefined();
  });

  it("unregisters a task origin", () => {
    registerTaskOrigin(origin);
    unregisterTaskOrigin("task-abc-123");
    expect(getTaskOrigin("task-abc-123")).toBeUndefined();
  });

  it("unregister is safe for unknown task", () => {
    expect(() => unregisterTaskOrigin("nonexistent")).not.toThrow();
  });
});

describe("formatProgressMessage", () => {
  it("formats progress with message", () => {
    const result = formatProgressMessage({ progress: 50, message: "Halfway done", taskId: "t1" });
    expect(result).toBe("[🔄 50%] Halfway done");
  });

  it("formats progress without message", () => {
    const result = formatProgressMessage({ progress: 25, taskId: "t1" });
    expect(result).toBe("[🔄 25%]");
  });

  it("formats completion with message", () => {
    const result = formatProgressMessage({ progress: 100, message: "All done!", taskId: "t1" });
    expect(result).toBe("[✅ Complete] All done!");
  });

  it("formats completion without message", () => {
    const result = formatProgressMessage({ progress: 100, taskId: "t1" });
    expect(result).toBe("[✅ Complete]");
  });

  it("handles zero progress", () => {
    const result = formatProgressMessage({ progress: 0, message: "Starting", taskId: "t1" });
    expect(result).toBe("[🔄 0%] Starting");
  });

  it("trims whitespace from message", () => {
    const result = formatProgressMessage({ progress: 10, message: "  spaced  ", taskId: "t1" });
    expect(result).toBe("[🔄 10%] spaced");
  });
});

describe("formatCompletionMessage", () => {
  it("formats completion", () => {
    const result = formatCompletionMessage("abcdefgh-1234", "read", 1500);
    expect(result).toBe("✅ Task abcdefgh… (read) completed in 1.5s");
  });

  it("formats fast completion", () => {
    const result = formatCompletionMessage("xyz12345-9999", "ls", 42);
    expect(result).toBe("✅ Task xyz12345… (ls) completed in 0.0s");
  });
});

describe("formatFailureMessage", () => {
  it("formats failure", () => {
    const result = formatFailureMessage("abcdefgh-1234", "exec", "command not found");
    expect(result).toBe("❌ Task abcdefgh… (exec) failed: command not found");
  });
});
