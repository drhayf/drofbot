import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import JournalEntry from "../../pages/JournalEntry";

vi.mock("../../components/viz", () => ({
  CosmicRibbon: (props: Record<string, unknown>) => (
    <div data-testid="cosmic-ribbon">{String(props.card ?? "")}</div>
  ),
}));

const mockGetEntry = vi.fn();

vi.mock("../../stores/journal", () => ({
  useJournalStore: vi.fn(() => ({
    getEntry: mockGetEntry,
  })),
}));

function renderWithRoute(id = "e-1") {
  return render(
    <MemoryRouter initialEntries={[`/journal/${id}`]}>
      <Routes>
        <Route path="/journal/:id" element={<JournalEntry />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("JournalEntry page", () => {
  it("shows entry content after loading", async () => {
    mockGetEntry.mockResolvedValue({
      id: "e-1",
      content: "Deep reflection on the morning gate",
      createdAt: "2025-01-15T10:00:00Z",
      mood: "reflective",
      tags: ["insight", "morning"],
      cosmicContext: { card: "Ace of Hearts", moonPhase: "Full Moon" },
      matchedHypotheses: [],
    });
    renderWithRoute();
    expect(await screen.findByText("Deep reflection on the morning gate")).toBeInTheDocument();
  });

  it("shows mood badge", async () => {
    mockGetEntry.mockResolvedValue({
      id: "e-1",
      content: "Some content",
      createdAt: "2025-01-15T10:00:00Z",
      mood: "energized",
      tags: [],
      cosmicContext: null,
      matchedHypotheses: [],
    });
    renderWithRoute();
    expect(await screen.findByText("energized")).toBeInTheDocument();
  });

  it("shows cosmic context section", async () => {
    mockGetEntry.mockResolvedValue({
      id: "e-1",
      content: "Cosmic day",
      createdAt: "2025-01-15T10:00:00Z",
      tags: [],
      cosmicContext: { card: "King of Spades", moonPhase: "New Moon" },
      matchedHypotheses: [],
    });
    renderWithRoute();
    expect(await screen.findByText("Cosmic Context")).toBeInTheDocument();
    expect(screen.getByTestId("cosmic-ribbon")).toBeInTheDocument();
  });

  it("shows connected hypotheses when present", async () => {
    mockGetEntry.mockResolvedValue({
      id: "e-1",
      content: "Pattern day",
      createdAt: "2025-01-15T10:00:00Z",
      tags: [],
      cosmicContext: null,
      matchedHypotheses: ["h-1"],
    });
    renderWithRoute();
    expect(await screen.findByText("Connected Hypotheses")).toBeInTheDocument();
    expect(screen.getByText("h-1")).toBeInTheDocument();
  });

  it("shows memory classification section", async () => {
    mockGetEntry.mockResolvedValue({
      id: "e-1",
      content: "Classified entry",
      createdAt: "2025-01-15T10:00:00Z",
      tags: ["dream", "insight"],
      cosmicContext: null,
      matchedHypotheses: [],
    });
    renderWithRoute();
    expect(await screen.findByText("Memory Classification")).toBeInTheDocument();
  });

  it("shows not found when entry is null", async () => {
    mockGetEntry.mockResolvedValue(null);
    renderWithRoute("nonexistent");
    expect(await screen.findByText("Entry not found")).toBeInTheDocument();
  });
});
