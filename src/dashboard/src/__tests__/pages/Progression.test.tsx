import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Progression from "../../pages/Progression";
import { useProgressionStore } from "../../stores/progression";

vi.mock("../../components/viz", () => ({
  RankBadge: (props: Record<string, unknown>) => (
    <div data-testid="rank-badge">
      {String(props.rankId)} {String(props.title)}
    </div>
  ),
  XPBar: (props: Record<string, unknown>) => (
    <div data-testid="xp-bar">
      {String(props.currentXP)}/{String(props.xpToNext)} XP
    </div>
  ),
  StreakIndicator: (props: Record<string, unknown>) => (
    <div data-testid="streak-indicator">{String(props.days)} day streak</div>
  ),
  FrequencyBand: (props: Record<string, unknown>) => (
    <div data-testid="frequency-band">{String(props.frequency)}</div>
  ),
  ResonanceBar: (props: Record<string, unknown>) => (
    <div data-testid="resonance-bar">{String(props.resonanceType ?? "")}</div>
  ),
}));

vi.mock("../../stores/progression", () => ({
  useProgressionStore: vi.fn(() => ({
    stats: {
      level: 12,
      xp: 450,
      xpToNextLevel: 600,
      rank: "B",
      streakDays: 7,
      bestStreak: 14,
      syncRate: 0.72,
      totalEntries: 85,
      totalHypothesesConfirmed: 12,
      totalPatternsDetected: 28,
    },
    quests: [
      { id: "q-1", title: "Morning meditation", status: "COMPLETED" },
      { id: "q-2", title: "Evening reflection", status: "ACTIVE" },
      { id: "q-3", title: "Weekly review", status: "COMPLETED" },
    ],
    isLoading: false,
    fetchStats: vi.fn(),
    fetchQuests: vi.fn(),
  })),
}));

describe("Progression page", () => {
  it("renders The Ascent heading", () => {
    render(
      <MemoryRouter>
        <Progression />
      </MemoryRouter>,
    );
    expect(screen.getByText("The Ascent")).toBeInTheDocument();
  });

  it("shows level and rank information", () => {
    render(
      <MemoryRouter>
        <Progression />
      </MemoryRouter>,
    );
    expect(screen.getByText("Level 12")).toBeInTheDocument();
    expect(screen.getByText(/Integrating — Rank B/)).toBeInTheDocument();
  });

  it("renders rank badge and XP bar viz components", () => {
    render(
      <MemoryRouter>
        <Progression />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("rank-badge")).toBeInTheDocument();
    expect(screen.getByTestId("xp-bar")).toBeInTheDocument();
  });

  it("shows streak indicator with best streak", () => {
    render(
      <MemoryRouter>
        <Progression />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("streak-indicator")).toBeInTheDocument();
    expect(screen.getByText("Best: 14 days")).toBeInTheDocument();
  });

  it("shows frequency band and sync rate", () => {
    render(
      <MemoryRouter>
        <Progression />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("frequency-band")).toBeInTheDocument();
    expect(screen.getByTestId("resonance-bar")).toBeInTheDocument();
    expect(screen.getByText("Sync Rate")).toBeInTheDocument();
  });

  it("shows stats grid with correct values", () => {
    render(
      <MemoryRouter>
        <Progression />
      </MemoryRouter>,
    );
    expect(screen.getByText("Journal Entries")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("Quests Completed")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 completed quests
    expect(screen.getByText("Hypotheses Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Patterns Detected")).toBeInTheDocument();
  });

  it("shows empty state when no stats", () => {
    vi.mocked(useProgressionStore).mockReturnValueOnce({
      stats: null,
      quests: [],
      isLoading: false,
      fetchStats: vi.fn(),
      fetchQuests: vi.fn(),
    } as unknown as ReturnType<typeof useProgressionStore>);
    render(
      <MemoryRouter>
        <Progression />
      </MemoryRouter>,
    );
    expect(screen.getByText("No progression data")).toBeInTheDocument();
  });
});
