/**
 * Tests for the Memory Classifier.
 */

import { describe, expect, it, vi } from "vitest";

// Mock LLM dependencies
const mockCompleteSimple = vi.fn();

vi.mock("@mariozechner/pi-ai", () => ({
  completeSimple: (...args: unknown[]) => mockCompleteSimple(...args),
}));

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../agent-runner/model-auth.js", () => ({
  getApiKeyForModel: async () => "test-key",
  requireApiKey: (key: string) => key,
}));

vi.mock("../agent-runner/model-selection.js", () => ({
  resolveDefaultModelForAgent: () => ({ provider: "openai", model: "gpt-4o-mini" }),
}));

vi.mock("../agent-runner/pi-embedded-runner/model.js", () => ({
  resolveModel: () => ({
    model: {
      id: "gpt-4o-mini",
      apiId: "gpt-4o-mini",
      provider: { id: "openai" },
    },
    error: null,
  }),
}));

import { MemoryClassifier, type ClassificationResult } from "./classifier.js";

function mockLLMResponse(json: ClassificationResult): void {
  mockCompleteSimple.mockResolvedValue({
    content: [{ type: "text", text: JSON.stringify(json) }],
  });
}

describe("MemoryClassifier", () => {
  const classifier = new MemoryClassifier();
  const defaultOptions = {
    cfg: { session: { mainKey: "main" } } as never,
  };

  it("classifies a preference into semantic bank", async () => {
    mockLLMResponse({
      shouldStore: true,
      banks: [
        {
          bank: "semantic",
          content: "User prefers TypeScript for all projects",
          metadata: { category: "preference", confidence: 0.9 },
        },
      ],
    });

    const result = await classifier.classify(
      "I always use TypeScript for my projects",
      defaultOptions,
    );

    expect(result.shouldStore).toBe(true);
    expect(result.banks).toHaveLength(1);
    expect(result.banks[0].bank).toBe("semantic");
    expect(result.banks[0].content).toBe("User prefers TypeScript for all projects");
  });

  it("classifies into multiple banks", async () => {
    mockLLMResponse({
      shouldStore: true,
      banks: [
        {
          bank: "episodic",
          content: "User deployed app to production on 2024-01-15",
          metadata: {},
        },
        {
          bank: "procedural",
          content: "Deployment workflow: build, test, deploy to fly.io",
          metadata: { steps: ["build", "test", "deploy"] },
        },
      ],
    });

    const result = await classifier.classify(
      "I deployed my app to production today using fly.io",
      defaultOptions,
    );

    expect(result.shouldStore).toBe(true);
    expect(result.banks).toHaveLength(2);
    expect(result.banks.map((b) => b.bank)).toEqual(["episodic", "procedural"]);
  });

  it("returns shouldStore=false for trivial content", async () => {
    mockLLMResponse({ shouldStore: false, banks: [] });

    const result = await classifier.classify("Hello!", defaultOptions);

    expect(result.shouldStore).toBe(false);
    expect(result.banks).toEqual([]);
  });

  it("handles markdown-wrapped JSON response", async () => {
    mockCompleteSimple.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '```json\n{"shouldStore":true,"banks":[{"bank":"semantic","content":"User likes cats","metadata":{}}]}\n```',
        },
      ],
    });

    const result = await classifier.classify("I love cats", defaultOptions);

    expect(result.shouldStore).toBe(true);
    expect(result.banks[0].content).toBe("User likes cats");
  });

  it("rejects invalid bank names", async () => {
    mockCompleteSimple.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"shouldStore":true,"banks":[{"bank":"invalid_bank","content":"test","metadata":{}}]}',
        },
      ],
    });

    const result = await classifier.classify("test", defaultOptions);

    // The invalid bank should be filtered out, resulting in shouldStore=false
    expect(result.shouldStore).toBe(false);
    expect(result.banks).toEqual([]);
  });

  it("handles LLM errors gracefully", async () => {
    mockCompleteSimple.mockRejectedValue(new Error("API rate limit exceeded"));

    const result = await classifier.classify("some text", defaultOptions);

    expect(result.shouldStore).toBe(false);
    expect(result.banks).toEqual([]);
  });

  it("handles malformed JSON response", async () => {
    mockCompleteSimple.mockResolvedValue({
      content: [{ type: "text", text: "not valid json at all" }],
    });

    const result = await classifier.classify("test", defaultOptions);

    expect(result.shouldStore).toBe(false);
    expect(result.banks).toEqual([]);
  });
});
