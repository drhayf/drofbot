import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Intelligence from "../../pages/Intelligence";

vi.mock("../../components/viz", () => ({
  ConfidenceGauge: (props: Record<string, unknown>) => (
    <div data-testid="confidence-gauge">{Math.round((props.confidence as number) * 100)}%</div>
  ),
}));

vi.mock("../../stores/intelligence", () => ({
  useIntelligenceStore: vi.fn(() => ({
    hypotheses: [
      {
        id: "h-1",
        statement: "Morning energy pattern",
        category: "You seem more focused in the morning",
        status: "TESTING",
        type: "BEHAVIORAL",
        confidence: 0.85,
        evidenceRecords: [
          { id: "e-1", evidenceType: "journal" },
          { id: "e-2", evidenceType: "pattern" },
        ],
        createdAt: "2025-01-10T08:00:00Z",
        updatedAt: "2025-01-10T08:00:00Z",
        lastEvidenceAt: "2025-01-10T08:00:00Z",
      },
      {
        id: "h-2",
        statement: "Music preference shift",
        category: "Preference for ambient music",
        status: "CONFIRMED",
        type: "PREFERENCE",
        confidence: 0.92,
        evidenceRecords: [{ id: "e-3", evidenceType: "journal" }],
        createdAt: "2025-01-08T12:00:00Z",
        updatedAt: "2025-01-08T12:00:00Z",
        lastEvidenceAt: "2025-01-08T12:00:00Z",
      },
    ],
    patterns: [
      {
        id: "p-1",
        type: "BEHAVIORAL",
        statement: "Regular evening journaling",
        confidence: 0.7,
        status: "TESTING",
        evidenceCount: 12,
        category: "behavioral",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-10T00:00:00Z",
      },
    ],
    isLoading: false,
    fetchHypotheses: vi.fn(),
    fetchPatterns: vi.fn(),
    confirmHypothesis: vi.fn(),
    rejectHypothesis: vi.fn(),
  })),
}));

describe("Intelligence page", () => {
  it("renders The Mirror heading", () => {
    render(
      <MemoryRouter>
        <Intelligence />
      </MemoryRouter>,
    );
    expect(screen.getByText("The Mirror")).toBeInTheDocument();
  });

  it("shows Hypothesis Board section", () => {
    render(
      <MemoryRouter>
        <Intelligence />
      </MemoryRouter>,
    );
    expect(screen.getByText("Hypothesis Board")).toBeInTheDocument();
  });

  it("shows hypothesis titles", () => {
    render(
      <MemoryRouter>
        <Intelligence />
      </MemoryRouter>,
    );
    expect(screen.getByText("Morning energy pattern")).toBeInTheDocument();
    // "Music preference shift" appears twice: hypothesis board + confirmed profile
    expect(screen.getAllByText("Music preference shift").length).toBeGreaterThanOrEqual(1);
  });

  it("shows confirm/reject buttons for TESTING hypotheses", () => {
    render(
      <MemoryRouter>
        <Intelligence />
      </MemoryRouter>,
    );
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("shows status badges", () => {
    render(
      <MemoryRouter>
        <Intelligence />
      </MemoryRouter>,
    );
    expect(screen.getByText("TESTING")).toBeInTheDocument();
    expect(screen.getByText("CONFIRMED")).toBeInTheDocument();
  });

  it("shows confidence percentages", () => {
    render(
      <MemoryRouter>
        <Intelligence />
      </MemoryRouter>,
    );
    expect(screen.getByText(/85% confidence/)).toBeInTheDocument();
    expect(screen.getByText(/92% confidence/)).toBeInTheDocument();
  });

  it("shows Pattern Feed section", () => {
    render(
      <MemoryRouter>
        <Intelligence />
      </MemoryRouter>,
    );
    expect(screen.getByText("Pattern Feed")).toBeInTheDocument();
    expect(screen.getByText("Regular evening journaling")).toBeInTheDocument();
  });

  it("shows Your Profile section from confirmed hypotheses", () => {
    render(
      <MemoryRouter>
        <Intelligence />
      </MemoryRouter>,
    );
    expect(screen.getByText("Your Profile")).toBeInTheDocument();
  });
});
