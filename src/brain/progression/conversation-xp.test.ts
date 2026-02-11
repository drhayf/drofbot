/**
 * Tests for the Conversation XP Calculator.
 */

import { describe, expect, it } from "vitest";
import { calculateConversationXP, type ConversationXPContext } from "./conversation-xp.js";

function makeContext(overrides: Partial<ConversationXPContext> = {}): ConversationXPContext {
  return {
    userMessage: "Tell me about my cosmic blueprint",
    assistantResponse: "Based on your birth data, here's what I can see...",
    memoriesStored: [],
    hypothesisUpdated: false,
    toolsUsed: [],
    conversationCount: 5, // Not a milestone
    ...overrides,
  };
}

describe("calculateConversationXP", () => {
  // ── Tier 1: Presence ──

  it("awards base presence XP for any interaction", () => {
    const result = calculateConversationXP(makeContext());
    const presence = result.breakdown.find((b) => b.source === "presence");

    expect(presence).toBeDefined();
    expect(presence!.xp).toBeGreaterThanOrEqual(2);
    expect(presence!.xp).toBeLessThanOrEqual(5);
  });

  it("awards minimal XP for very short messages", () => {
    const result = calculateConversationXP(makeContext({ userMessage: "hi" }));
    expect(result.totalXP).toBe(2); // Just presence base
  });

  // ── Tier 2: Substance ──

  it("awards substance XP when episodic memory is stored", () => {
    const result = calculateConversationXP(
      makeContext({ memoriesStored: [{ bank: "episodic" }] }),
    );
    const substance = result.breakdown.find((b) => b.source === "substance:episodic");

    expect(substance).toBeDefined();
    expect(substance!.xp).toBe(5);
  });

  it("awards substance knowledge XP for non-episodic banks", () => {
    const result = calculateConversationXP(
      makeContext({ memoriesStored: [{ bank: "semantic" }] }),
    );
    const knowledge = result.breakdown.find((b) => b.source === "substance:knowledge");

    expect(knowledge).toBeDefined();
    expect(knowledge!.xp).toBe(10);
  });

  it("awards nothing extra when no memories stored", () => {
    const result = calculateConversationXP(makeContext());
    const substance = result.breakdown.filter((b) => b.source.startsWith("substance"));
    expect(substance).toHaveLength(0);
  });

  // ── Tier 3: Depth ──

  it("awards depth XP for semantic memory storage", () => {
    const result = calculateConversationXP(
      makeContext({ memoriesStored: [{ bank: "semantic" }] }),
    );
    const depth = result.breakdown.find((b) => b.source === "depth:semantic");

    expect(depth).toBeDefined();
    expect(depth!.xp).toBe(10);
  });

  it("awards depth XP for relational memory storage", () => {
    const result = calculateConversationXP(
      makeContext({ memoriesStored: [{ bank: "relational" }] }),
    );
    const depth = result.breakdown.find((b) => b.source === "depth:relational");

    expect(depth).toBeDefined();
    expect(depth!.xp).toBe(10);
  });

  it("awards depth XP for hypothesis updates", () => {
    const result = calculateConversationXP(makeContext({ hypothesisUpdated: true }));
    const depth = result.breakdown.find((b) => b.source === "depth:hypothesis");

    expect(depth).toBeDefined();
    expect(depth!.xp).toBe(15);
  });

  it("awards depth XP for profile tool usage", () => {
    const result = calculateConversationXP(
      makeContext({ toolsUsed: ["profile_explore"] }),
    );
    const depth = result.breakdown.find((b) => b.source === "depth:profile");

    expect(depth).toBeDefined();
    expect(depth!.xp).toBe(15);
  });

  it("awards depth XP for cosmic tool usage", () => {
    const result = calculateConversationXP(
      makeContext({ toolsUsed: ["cosmic_synthesis", "transit_calculate"] }),
    );
    const depth = result.breakdown.find((b) => b.source === "depth:cosmic");

    expect(depth).toBeDefined();
    expect(depth!.xp).toBe(5);
  });

  it("stacks multiple depth bonuses", () => {
    const result = calculateConversationXP(
      makeContext({
        memoriesStored: [{ bank: "semantic" }, { bank: "relational" }, { bank: "episodic" }],
        hypothesisUpdated: true,
        toolsUsed: ["cosmic_synthesis", "profile_save"],
      }),
    );

    // Presence + substance:episodic + substance:knowledge + depth:semantic + depth:relational
    // + depth:hypothesis + depth:cosmic + depth:profile
    const sources = result.breakdown.map((b) => b.source);
    expect(sources).toContain("presence");
    expect(sources).toContain("substance:episodic");
    expect(sources).toContain("substance:knowledge");
    expect(sources).toContain("depth:semantic");
    expect(sources).toContain("depth:relational");
    expect(sources).toContain("depth:hypothesis");
    expect(sources).toContain("depth:cosmic");
    expect(sources).toContain("depth:profile");

    // Total: 2 + 5 + 10 + 10 + 10 + 15 + 5 + 15 = 72
    expect(result.totalXP).toBe(72);
  });

  // ── Tier 4: Milestones ──

  it("awards 50 XP for first conversation", () => {
    const result = calculateConversationXP(makeContext({ conversationCount: 1 }));
    const milestone = result.breakdown.find((b) => b.source.includes("milestone"));

    expect(milestone).toBeDefined();
    expect(milestone!.xp).toBe(50);
    expect(result.milestones).toContain("First conversation ever!");
  });

  it("awards 25 XP for 10th conversation", () => {
    const result = calculateConversationXP(makeContext({ conversationCount: 10 }));
    const milestone = result.breakdown.find((b) => b.source.includes("milestone"));

    expect(milestone).toBeDefined();
    expect(milestone!.xp).toBe(25);
    expect(result.milestones[0]).toContain("10 conversations reached");
  });

  it("awards 100 XP for 100th conversation", () => {
    const result = calculateConversationXP(makeContext({ conversationCount: 100 }));
    const milestone = result.breakdown.find((b) => b.source.includes("milestone"));

    expect(milestone).toBeDefined();
    expect(milestone!.xp).toBe(100);
  });

  it("awards no milestone for non-milestone counts", () => {
    const result = calculateConversationXP(makeContext({ conversationCount: 7 }));
    const milestone = result.breakdown.filter((b) => b.source.includes("milestone"));

    expect(milestone).toHaveLength(0);
    expect(result.milestones).toHaveLength(0);
  });

  // ── Edge cases ──

  it("handles empty messages gracefully", () => {
    const result = calculateConversationXP(
      makeContext({ userMessage: "", assistantResponse: "" }),
    );
    expect(result.totalXP).toBeGreaterThanOrEqual(2);
  });

  it("returns correct breakdown structure", () => {
    const result = calculateConversationXP(makeContext());
    expect(result.totalXP).toEqual(
      result.breakdown.reduce((sum, b) => sum + b.xp, 0),
    );
  });
});
