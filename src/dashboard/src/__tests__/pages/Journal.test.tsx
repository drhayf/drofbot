import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Journal from "../../pages/Journal";

vi.mock("../../components/viz", () => ({
  CosmicRibbon: () => <div data-testid="cosmic-ribbon" />,
}));

vi.mock("../../stores/journal", () => ({
  useJournalStore: vi.fn(() => ({
    entries: [
      {
        id: "e-1",
        content: "First entry content here",
        createdAt: new Date().toISOString(),
        mood: "reflective",
        tags: ["dream"],
        cosmicContext: { card: "Ace of Hearts" },
      },
      {
        id: "e-2",
        content: "Second entry from yesterday",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        mood: "energized",
        tags: ["insight"],
        cosmicContext: null,
      },
    ],
    total: 2,
    page: 1,
    isLoading: false,
    fetchEntries: vi.fn(),
  })),
}));

describe("Journal page", () => {
  it("renders Chronicle heading", () => {
    render(
      <MemoryRouter>
        <Journal />
      </MemoryRouter>,
    );
    expect(screen.getByText("Chronicle")).toBeInTheDocument();
  });

  it("shows entry count", () => {
    render(
      <MemoryRouter>
        <Journal />
      </MemoryRouter>,
    );
    expect(screen.getByText("2 entries")).toBeInTheDocument();
  });

  it("shows New Entry button", () => {
    render(
      <MemoryRouter>
        <Journal />
      </MemoryRouter>,
    );
    expect(screen.getByText("New Entry")).toBeInTheDocument();
  });

  it("renders entry content", () => {
    render(
      <MemoryRouter>
        <Journal />
      </MemoryRouter>,
    );
    expect(screen.getByText("First entry content here")).toBeInTheDocument();
    expect(screen.getByText("Second entry from yesterday")).toBeInTheDocument();
  });

  it("shows mood badges", () => {
    render(
      <MemoryRouter>
        <Journal />
      </MemoryRouter>,
    );
    expect(screen.getByText("reflective")).toBeInTheDocument();
    expect(screen.getByText("energized")).toBeInTheDocument();
  });

  it("shows filter buttons", () => {
    render(
      <MemoryRouter>
        <Journal />
      </MemoryRouter>,
    );
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Moon Phase")).toBeInTheDocument();
    expect(screen.getByText("Card Period")).toBeInTheDocument();
    expect(screen.getByText("Gate")).toBeInTheDocument();
  });

  it("groups entries by date", () => {
    render(
      <MemoryRouter>
        <Journal />
      </MemoryRouter>,
    );
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });
});
