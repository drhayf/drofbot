import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Quests from "../../pages/Quests";

vi.mock("../../components/viz", () => ({
  XPBar: (props: Record<string, unknown>) => (
    <div data-testid="xp-bar">
      {String(props.currentXP)}/{String(props.xpToNext)} XP
    </div>
  ),
}));

vi.mock("../../stores/progression", () => ({
  useProgressionStore: vi.fn(() => ({
    stats: {
      level: 8,
      xp: 350,
      xpToNextLevel: 500,
      rank: "C",
      totalQuests: 5,
      completedQuests: 2,
    },
    quests: [
      {
        id: "q-1",
        title: "Morning meditation",
        status: "ACTIVE",
        difficulty: "EASY",
        xpReward: 30,
        description: "Meditate for 10 minutes",
        createdAt: "2025-01-10T08:00:00Z",
      },
      {
        id: "q-2",
        title: "Journal review",
        status: "COMPLETED",
        difficulty: "MEDIUM",
        xpReward: 50,
        description: "Review past entries",
        createdAt: "2025-01-09T12:00:00Z",
        completedAt: "2025-01-12T14:00:00Z",
      },
      {
        id: "q-3",
        title: "Old quest",
        status: "EXPIRED",
        difficulty: "HARD",
        xpReward: 100,
        description: "An expired quest",
        createdAt: "2025-01-01T08:00:00Z",
      },
    ],
    isLoading: false,
    fetchStats: vi.fn(),
    fetchQuests: vi.fn(),
    completeQuest: vi.fn(),
    createQuest: vi.fn(),
  })),
}));

describe("Quests page", () => {
  it("renders The Path heading", () => {
    render(
      <MemoryRouter>
        <Quests />
      </MemoryRouter>,
    );
    expect(screen.getByText("The Path")).toBeInTheDocument();
  });

  it("shows level and rank", () => {
    render(
      <MemoryRouter>
        <Quests />
      </MemoryRouter>,
    );
    expect(screen.getByText("Lv. 8")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("renders XP bar viz component", () => {
    render(
      <MemoryRouter>
        <Quests />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("xp-bar")).toBeInTheDocument();
  });

  it("separates active, completed, and expired quests", () => {
    render(
      <MemoryRouter>
        <Quests />
      </MemoryRouter>,
    );
    expect(screen.getByText("Active Quests")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    // "Expired" appears as both a heading and badge
    expect(screen.getAllByText("Expired").length).toBeGreaterThanOrEqual(1);
  });

  it("shows quest details in active section", () => {
    render(
      <MemoryRouter>
        <Quests />
      </MemoryRouter>,
    );
    expect(screen.getByText("Morning meditation")).toBeInTheDocument();
    expect(screen.getByText("Meditate for 10 minutes")).toBeInTheDocument();
  });

  it("shows Complete button for active quests", () => {
    render(
      <MemoryRouter>
        <Quests />
      </MemoryRouter>,
    );
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("shows New Quest button", () => {
    render(
      <MemoryRouter>
        <Quests />
      </MemoryRouter>,
    );
    expect(screen.getByText("New Quest")).toBeInTheDocument();
  });

  it("shows sort controls", () => {
    render(
      <MemoryRouter>
        <Quests />
      </MemoryRouter>,
    );
    expect(screen.getByText("Newest")).toBeInTheDocument();
    expect(screen.getByText("XP Reward")).toBeInTheDocument();
    expect(screen.getByText("Difficulty")).toBeInTheDocument();
  });
});
