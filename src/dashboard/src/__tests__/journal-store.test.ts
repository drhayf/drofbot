import { describe, it, expect, vi, beforeEach } from "vitest";
import { useJournalStore } from "../stores/journal";

describe("Journal store", () => {
  beforeEach(() => {
    useJournalStore.setState({
      entries: [],
      total: 0,
      page: 1,
      isLoading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  it("initial state has empty entries", () => {
    expect(useJournalStore.getState().entries).toEqual([]);
    expect(useJournalStore.getState().total).toBe(0);
  });

  it("fetchEntries populates entries and total", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          entries: [{ id: "e-1", content: "Test entry", createdAt: new Date().toISOString() }],
          total: 1,
        }),
    });

    await useJournalStore.getState().fetchEntries();

    const state = useJournalStore.getState();
    expect(state.entries).toHaveLength(1);
    expect(state.total).toBe(1);
    expect(state.page).toBe(1);
  });

  it("fetchEntries with page number", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ entries: [], total: 50 }),
    });

    await useJournalStore.getState().fetchEntries(3);
    expect(useJournalStore.getState().page).toBe(3);
    const fetchUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(fetchUrl).toContain("page=3");
  });

  it("createEntry submits and refetches", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // create
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              id: "e-new",
              matchedHypotheses: [],
              timestamp: "2025-01-01T00:00:00Z",
            }),
        });
      }
      // refetch
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ entries: [{ id: "e-new" }], total: 1 }),
      });
    });

    const entry = await useJournalStore.getState().createEntry({ content: "New entry" });
    expect(entry).toBeDefined();
    expect(entry!.id).toBe("e-new");
  });

  it("sets error on fetch failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline"));

    await useJournalStore.getState().fetchEntries();
    expect(useJournalStore.getState().error).toBe("offline");
  });
});
