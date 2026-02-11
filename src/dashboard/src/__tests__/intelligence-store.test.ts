import { describe, it, expect, vi, beforeEach } from "vitest";
import { useIntelligenceStore } from "../stores/intelligence";

describe("Intelligence store", () => {
  beforeEach(() => {
    useIntelligenceStore.setState({
      hypotheses: [],
      patterns: [],
      isLoading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  it("initial state has empty arrays", () => {
    expect(useIntelligenceStore.getState().hypotheses).toEqual([]);
    expect(useIntelligenceStore.getState().patterns).toEqual([]);
  });

  it("fetchHypotheses populates list", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          hypotheses: [
            {
              id: "h-1",
              type: "BEHAVIORAL",
              status: "TESTING",
              statement: "Test",
              category: "behavior",
              confidence: 0.8,
              evidenceRecords: [],
              createdAt: "2025-01-10T00:00:00Z",
              updatedAt: "2025-01-10T00:00:00Z",
              lastEvidenceAt: "2025-01-10T00:00:00Z",
            },
          ],
        }),
    });

    await useIntelligenceStore.getState().fetchHypotheses();
    expect(useIntelligenceStore.getState().hypotheses).toHaveLength(1);
    expect(useIntelligenceStore.getState().hypotheses[0].id).toBe("h-1");
  });

  it("fetchHypotheses passes status filter", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ hypotheses: [] }),
    });

    await useIntelligenceStore.getState().fetchHypotheses("CONFIRMED");
    const fetchUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(fetchUrl).toContain("status=CONFIRMED");
  });

  it("confirmHypothesis triggers refetch", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // confirm call
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ hypothesis: { id: "h-1", status: "CONFIRMED" } }),
        });
      }
      // refetch
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ hypotheses: [] }),
      });
    });

    await useIntelligenceStore.getState().confirmHypothesis("h-1");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("sets error on fetch failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network"));

    await useIntelligenceStore.getState().fetchHypotheses();
    expect(useIntelligenceStore.getState().error).toBe("network");
  });
});
