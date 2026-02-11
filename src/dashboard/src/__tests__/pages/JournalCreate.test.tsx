import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import JournalCreate from "../../pages/JournalCreate";

vi.mock("../../components/viz", () => ({
  CosmicRibbon: (props: Record<string, unknown>) => (
    <div data-testid="cosmic-ribbon">{String(props.card ?? "")}</div>
  ),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockCreateEntry = vi.fn();

vi.mock("../../stores/journal", () => ({
  useJournalStore: vi.fn(() => ({
    createEntry: mockCreateEntry,
  })),
}));

vi.mock("../../stores/cosmic", () => ({
  useCosmicStore: vi.fn(() => ({
    weather: {
      card: { name: "Queen of Diamonds" },
      lunar: { phase: "Waxing Gibbous", illumination: 0.75 },
      solar: { kpIndex: 2 },
      gate: { number: 12, line: 4 },
      synthesis: { overallResonance: 0.65 },
    },
  })),
}));

describe("JournalCreate page", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockCreateEntry.mockClear();
  });

  it("renders New Entry heading", () => {
    render(
      <MemoryRouter>
        <JournalCreate />
      </MemoryRouter>,
    );
    expect(screen.getByText("New Entry")).toBeInTheDocument();
  });

  it("shows live cosmic weather ribbon", () => {
    render(
      <MemoryRouter>
        <JournalCreate />
      </MemoryRouter>,
    );
    expect(screen.getByText("Current Cosmic Weather")).toBeInTheDocument();
    expect(screen.getByTestId("cosmic-ribbon")).toBeInTheDocument();
  });

  it("has content textarea and save button", () => {
    render(
      <MemoryRouter>
        <JournalCreate />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/What's on your mind/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Entry/i })).toBeInTheDocument();
  });

  it("disables save when content is empty", () => {
    render(
      <MemoryRouter>
        <JournalCreate />
      </MemoryRouter>,
    );
    const button = screen.getByRole("button", { name: /Save Entry/i });
    expect(button).toBeDisabled();
  });

  it("enables save when content is entered", () => {
    render(
      <MemoryRouter>
        <JournalCreate />
      </MemoryRouter>,
    );
    const textarea = screen.getByLabelText(/What's on your mind/i);
    fireEvent.change(textarea, { target: { value: "A new journal entry" } });
    const button = screen.getByRole("button", { name: /Save Entry/i });
    expect(button).not.toBeDisabled();
  });

  it("shows error on failed save", async () => {
    mockCreateEntry.mockResolvedValue(null);
    render(
      <MemoryRouter>
        <JournalCreate />
      </MemoryRouter>,
    );
    const textarea = screen.getByLabelText(/What's on your mind/i);
    fireEvent.change(textarea, { target: { value: "Something" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Entry/i }));
    await waitFor(() => {
      expect(screen.getByText(/Failed to save entry/i)).toBeInTheDocument();
    });
  });
});
