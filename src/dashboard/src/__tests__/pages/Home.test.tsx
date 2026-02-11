import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Home from "../../pages/Home";

// Mock viz components
vi.mock("../../components/viz", () => ({
  CosmicRibbon: (props: Record<string, unknown>) => (
    <div data-testid="cosmic-ribbon">{String(props.card ?? "")}</div>
  ),
  RankBadge: (props: Record<string, unknown>) => (
    <div data-testid="rank-badge">{String(props.rankId)}</div>
  ),
  XPBar: () => <div data-testid="xp-bar" />,
  StreakIndicator: () => <div data-testid="streak-indicator" />,
  FrequencyBand: () => <div data-testid="frequency-band" />,
  ConfidenceGauge: () => <div data-testid="confidence-gauge" />,
  ResonanceBar: () => <div data-testid="resonance-bar" />,
}));

vi.mock("../../stores/cosmic", () => ({
  useCosmicStore: vi.fn(() => ({
    weather: {
      card: { timestamp: "", name: "Ace of Hearts", summary: "" },
      gate: { timestamp: "", number: 42, line: 3, metrics: {}, summary: "" },
      lunar: { timestamp: "", phase: "Full Moon", illumination: 0.98, metrics: {}, summary: "" },
      solar: { timestamp: "", kpIndex: 3, metrics: {}, summary: "" },
      transits: { timestamp: "", metrics: {}, summary: "" },
      synthesis: {
        overallResonance: 0.8,
        resonanceType: "HARMONIC",
        narrative: "A harmonious day",
      },
    },
    isLoading: false,
    fetch: vi.fn(),
  })),
}));

vi.mock("../../stores/progression", () => ({
  useProgressionStore: vi.fn(() => ({
    stats: {
      level: 5,
      xp: 100,
      xpToNextLevel: 200,
      rank: "D",
      streakDays: 3,
      syncRate: 0.8,
      levelProgress: 0.5,
    },
    quests: [
      {
        id: "q-1",
        title: "Morning meditation",
        status: "ACTIVE",
        difficulty: "EASY",
        xpReward: 30,
      },
    ],
    fetchStats: vi.fn(),
    fetchQuests: vi.fn(),
  })),
}));

vi.mock("../../stores/intelligence", () => ({
  useIntelligenceStore: vi.fn(() => ({
    hypotheses: [
      {
        id: "h-1",
        statement: "Test hypothesis",
        status: "TESTING",
        type: "BEHAVIORAL",
        confidence: 0.85,
        category: "behavior",
        evidenceRecords: [],
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-15T00:00:00Z",
        lastEvidenceAt: "2025-01-15T00:00:00Z",
      },
    ],
    fetchHypotheses: vi.fn(),
  })),
}));

vi.mock("../../stores/journal", () => ({
  useJournalStore: vi.fn(() => ({
    entries: [
      {
        id: "e-1",
        content: "Today was interesting",
        createdAt: "2025-01-15T10:00:00Z",
        tags: ["dream"],
      },
    ],
    fetchEntries: vi.fn(),
  })),
}));

describe("Home page", () => {
  it("renders Observatory heading", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText("Observatory")).toBeInTheDocument();
  });

  it("shows Today's Weather with narrative", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText("Today's Weather")).toBeInTheDocument();
    expect(screen.getByText("A harmonious day")).toBeInTheDocument();
  });

  it("shows active hypotheses section", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText("Active Hypotheses")).toBeInTheDocument();
    expect(screen.getByText("Test hypothesis")).toBeInTheDocument();
  });

  it("shows quest board preview", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText("Quest Board")).toBeInTheDocument();
    expect(screen.getByText("Morning meditation")).toBeInTheDocument();
  });

  it("shows recent journal entries", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText("Recent Journal")).toBeInTheDocument();
    expect(screen.getByText("Today was interesting")).toBeInTheDocument();
  });

  it("shows progression with level", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText("Progression")).toBeInTheDocument();
    expect(screen.getByText("Lv. 5")).toBeInTheDocument();
  });

  it("renders cosmic ribbon viz", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("cosmic-ribbon")).toBeInTheDocument();
  });

  it("renders rank badge viz", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("rank-badge")).toBeInTheDocument();
  });
});
