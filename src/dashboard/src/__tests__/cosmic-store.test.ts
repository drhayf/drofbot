// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCosmicStore } from "../stores/cosmic";

describe("Cosmic store", () => {
  beforeEach(() => {
    useCosmicStore.setState({
      weather: null,
      isLoading: false,
      error: null,
      lastFetched: null,
    });
    vi.restoreAllMocks();
  });

  it("initial state is null", () => {
    const state = useCosmicStore.getState();
    expect(state.weather).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("fetch populates weather from API", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      const responses: Record<string, unknown> = {
        "/api/cosmic/current": {
          timestamp: new Date().toISOString(),
          systems: {},
          harmony: {
            overallResonance: 0.75,
            resonanceType: "HARMONIC",
            guidance: "A harmonious day",
            elementalBalance: { FIRE: 0.3, WATER: 0.2 },
          },
        },
        "/api/cosmic/card": {
          card: { timestamp: new Date().toISOString(), name: "Ace", summary: "Test" },
        },
        "/api/cosmic/gate": {
          gate: {
            timestamp: new Date().toISOString(),
            sunGate: 42,
            sunLine: 3,
            gateName: "Increase",
            summary: "Test",
            metrics: {},
          },
        },
        "/api/cosmic/solar": {
          solar: { timestamp: new Date().toISOString(), kpIndex: 3, summary: "Quiet", metrics: {} },
        },
        "/api/cosmic/lunar": {
          lunar: {
            timestamp: new Date().toISOString(),
            phaseName: "Full",
            illumination: 1.0,
            summary: "Full Moon",
            metrics: {},
          },
        },
        "/api/cosmic/transits": {
          transits: {
            timestamp: new Date().toISOString(),
            skyAspects: [{ planets: "Sun-Moon", aspect: "opposition", orb: 0.5 }],
            summary: "Calm",
            metrics: {},
          },
        },
      };
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responses[url] || {}),
      });
    });

    await useCosmicStore.getState().fetch();

    const state = useCosmicStore.getState();
    expect(state.weather).not.toBeNull();
    expect(state.weather!.card!.name).toBe("Ace");
    // Gate fields are mapped from API shape (sunGate → number, gateName → name)
    expect(state.weather!.gate!.number).toBe(42);
    expect(state.weather!.gate!.name).toBe("Increase");
    // Lunar fields mapped (phaseName → phase)
    expect(state.weather!.lunar!.phase).toBe("Full");
    // Transits mapped (skyAspects → active)
    expect(state.weather!.transits!.active).toHaveLength(1);
    expect(state.weather!.transits!.active![0].planet).toBe("Sun-Moon");
    expect(state.weather!.synthesis!.overallResonance).toBe(0.75);
    expect(state.weather!.synthesis!.narrative).toBe("A harmonious day");
    expect(state.isLoading).toBe(false);
    expect(state.lastFetched).toBeGreaterThan(0);
  });

  it("fetch skips if fetched recently", async () => {
    useCosmicStore.setState({ lastFetched: Date.now() });
    globalThis.fetch = vi.fn();

    await useCosmicStore.getState().fetch();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fetch handles all endpoints failing gracefully", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    await useCosmicStore.getState().fetch();
    // With Promise.allSettled, all-rejected endpoints result in null weather
    // (no data available) but no thrown error since each endpoint degrades independently
    expect(useCosmicStore.getState().weather).toBeNull();
    expect(useCosmicStore.getState().isLoading).toBe(false);
  });

  it("fetch shows partial data when some endpoints fail", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      // Card endpoint fails (503), others succeed
      if (url === "/api/cosmic/card") {
        return Promise.resolve({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          json: () => Promise.resolve({ error: "Cardology system not available" }),
        });
      }
      const responses: Record<string, unknown> = {
        "/api/cosmic/current": {
          timestamp: new Date().toISOString(),
          systems: {},
          harmony: null,
        },
        "/api/cosmic/gate": {
          gate: {
            timestamp: new Date().toISOString(),
            sunGate: 49,
            gateName: "Revolution",
            summary: "Test",
            metrics: {},
          },
        },
        "/api/cosmic/solar": {
          solar: { timestamp: new Date().toISOString(), kpIndex: 3, summary: "Quiet", metrics: {} },
        },
        "/api/cosmic/lunar": {
          lunar: {
            timestamp: new Date().toISOString(),
            phaseName: "Last Quarter",
            summary: "Quarter Moon",
            metrics: {},
          },
        },
        "/api/cosmic/transits": {
          transits: {
            timestamp: new Date().toISOString(),
            skyAspects: [],
            summary: "Calm",
            metrics: {},
          },
        },
      };
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responses[url] || {}),
      });
    });

    await useCosmicStore.getState().fetch();
    const state = useCosmicStore.getState();
    // Weather should exist with partial data
    expect(state.weather).not.toBeNull();
    // Card is null (503), but other systems loaded
    expect(state.weather!.card).toBeNull();
    expect(state.weather!.gate!.number).toBe(49);
    expect(state.weather!.lunar!.phase).toBe("Last Quarter");
    expect(state.isLoading).toBe(false);
  });
});
