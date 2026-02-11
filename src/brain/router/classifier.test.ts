import { describe, expect, it } from "vitest";
import { classifyTool, canExecuteInCloud, requiresWorker } from "./classifier.js";

describe("Tool Classifier", () => {
  describe("classifyTool", () => {
    // --- Local tools ---
    it.each(["read", "write", "edit", "exec", "process", "apply_patch", "grep", "find", "ls"])(
      'classifies "%s" as local',
      (tool) => {
        expect(classifyTool(tool)).toBe("local");
      },
    );

    // --- Cloud tools ---
    it.each([
      "memory_store",
      "memory_search_structured",
      "memory_search",
      "memory_get",
      "web_search",
      "web_fetch",
      "message",
      "sessions_list",
      "sessions_history",
      "sessions_send",
      "sessions_spawn",
      "session_status",
      "agents_list",
      "cron",
      "nodes",
      "canvas",
      "tts",
    ])('classifies "%s" as cloud', (tool) => {
      expect(classifyTool(tool)).toBe("cloud");
    });

    // --- Hybrid tools ---
    it.each(["browser", "image", "gateway"])('classifies "%s" as hybrid', (tool) => {
      expect(classifyTool(tool)).toBe("hybrid");
    });

    // --- Channel login tools ---
    it("classifies channel login tools as local", () => {
      expect(classifyTool("whatsapp_login")).toBe("local");
      expect(classifyTool("telegram_login")).toBe("local");
    });

    // --- Unknown tools default to local for safety ---
    it("classifies unknown tools as local", () => {
      expect(classifyTool("some_unknown_tool")).toBe("local");
    });

    // --- Case-insensitive ---
    it("is case-insensitive", () => {
      expect(classifyTool("READ")).toBe("local");
      expect(classifyTool("Web_Search")).toBe("cloud");
      expect(classifyTool("BROWSER")).toBe("hybrid");
    });
  });

  describe("canExecuteInCloud", () => {
    it("returns true for cloud tools", () => {
      expect(canExecuteInCloud("web_search")).toBe(true);
      expect(canExecuteInCloud("memory_store")).toBe(true);
    });

    it("returns true for hybrid tools", () => {
      expect(canExecuteInCloud("browser")).toBe(true);
      expect(canExecuteInCloud("image")).toBe(true);
    });

    it("returns false for local-only tools", () => {
      expect(canExecuteInCloud("exec")).toBe(false);
      expect(canExecuteInCloud("write")).toBe(false);
    });
  });

  describe("requiresWorker", () => {
    it("returns true for local-only tools", () => {
      expect(requiresWorker("exec")).toBe(true);
      expect(requiresWorker("read")).toBe(true);
      expect(requiresWorker("process")).toBe(true);
    });

    it("returns false for cloud and hybrid tools", () => {
      expect(requiresWorker("web_search")).toBe(false);
      expect(requiresWorker("browser")).toBe(false);
    });
  });
});
