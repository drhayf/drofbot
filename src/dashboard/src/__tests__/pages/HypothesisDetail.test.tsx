import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import HypothesisDetail from "../../pages/HypothesisDetail";

vi.mock("../../components/viz", () => ({
  ConfidenceGauge: (props: Record<string, unknown>) => (
    <div data-testid="confidence-gauge">{Math.round((props.confidence as number) * 100)}%</div>
  ),
  CosmicRibbon: (props: Record<string, unknown>) => (
    <div data-testid="cosmic-ribbon">{String(props.card ?? "")}</div>
  ),
}));

const mockGetHypothesis = vi.fn();
const mockConfirmHypothesis = vi.fn();
const mockRejectHypothesis = vi.fn();

vi.mock("../../stores/intelligence", () => ({
  useIntelligenceStore: vi.fn(() => ({
    getHypothesis: mockGetHypothesis,
    confirmHypothesis: mockConfirmHypothesis,
    rejectHypothesis: mockRejectHypothesis,
  })),
}));

function renderWithRoute(id = "h-1") {
  return render(
    <MemoryRouter initialEntries={[`/intelligence/${id}`]}>
      <Routes>
        <Route path="/intelligence/:id" element={<HypothesisDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("HypothesisDetail page", () => {
  it("shows hypothesis title after loading", async () => {
    mockGetHypothesis.mockResolvedValue({
      id: "h-1",
      statement: "Morning energy peaks",
      category: "You seem more productive in mornings",
      type: "BEHAVIORAL",
      status: "TESTING",
      confidence: 0.82,
      evidenceRecords: [],
      createdAt: "2025-01-10T08:00:00Z",
      updatedAt: "2025-01-10T08:00:00Z",
      lastEvidenceAt: "2025-01-10T08:00:00Z",
    });
    renderWithRoute();
    expect(await screen.findByText("Morning energy peaks")).toBeInTheDocument();
  });

  it("shows confidence gauge", async () => {
    mockGetHypothesis.mockResolvedValue({
      id: "h-1",
      statement: "Test hypothesis",
      category: "Test description",
      type: "BEHAVIORAL",
      status: "TESTING",
      confidence: 0.85,
      evidenceRecords: [],
      createdAt: "2025-01-10T08:00:00Z",
      updatedAt: "2025-01-10T08:00:00Z",
      lastEvidenceAt: "2025-01-10T08:00:00Z",
    });
    renderWithRoute();
    await screen.findByText("Test hypothesis");
    expect(screen.getByTestId("confidence-gauge")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("shows confidence breakdown section", async () => {
    mockGetHypothesis.mockResolvedValue({
      id: "h-1",
      statement: "Breakdown test",
      category: "Testing breakdown",
      type: "BEHAVIORAL",
      status: "TESTING",
      confidence: 0.7,
      evidenceRecords: [
        {
          id: "e-1",
          evidenceType: "journal",
          source: "journal",
          description: "Evidence 1",
          timestamp: "2025-01-10T08:00:00Z",
          baseWeight: 1,
          sourceReliability: 1,
          recencyMultiplier: 1,
          positionFactor: 1,
          effectiveWeight: 1,
        },
      ],
      createdAt: "2025-01-10T08:00:00Z",
      updatedAt: "2025-01-10T08:00:00Z",
      lastEvidenceAt: "2025-01-10T08:00:00Z",
    });
    renderWithRoute();
    await screen.findByText("Breakdown test");
    expect(screen.getByText("Confidence Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Evidence Frequency")).toBeInTheDocument();
    expect(screen.getByText("Recency")).toBeInTheDocument();
    expect(screen.getByText("Cosmic Correlation")).toBeInTheDocument();
  });

  it("shows confirm/reject buttons for TESTING status", async () => {
    mockGetHypothesis.mockResolvedValue({
      id: "h-1",
      statement: "Actionable hypothesis",
      category: "Needs confirmation",
      type: "BEHAVIORAL",
      status: "TESTING",
      confidence: 0.9,
      evidenceRecords: [],
      createdAt: "2025-01-10T08:00:00Z",
      updatedAt: "2025-01-10T08:00:00Z",
      lastEvidenceAt: "2025-01-10T08:00:00Z",
    });
    renderWithRoute();
    await screen.findByText("Actionable hypothesis");
    expect(screen.getByText("Confirm Hypothesis")).toBeInTheDocument();
    expect(screen.getByText("Reject Hypothesis")).toBeInTheDocument();
  });

  it("shows evidence chain when evidence exists", async () => {
    mockGetHypothesis.mockResolvedValue({
      id: "h-1",
      statement: "Evidenced hypothesis",
      category: "Has evidence",
      type: "BEHAVIORAL",
      status: "TESTING",
      confidence: 0.8,
      evidenceRecords: [
        {
          id: "e-1",
          evidenceType: "journal",
          source: "journal",
          description: "First observation",
          timestamp: "2025-01-10T08:00:00Z",
          baseWeight: 1,
          sourceReliability: 1,
          recencyMultiplier: 1,
          positionFactor: 1,
          effectiveWeight: 1,
        },
        {
          id: "e-2",
          evidenceType: "pattern",
          source: "pattern",
          description: "Second observation",
          timestamp: "2025-01-12T10:00:00Z",
          baseWeight: 1,
          sourceReliability: 1,
          recencyMultiplier: 1,
          positionFactor: 1,
          effectiveWeight: 1,
        },
      ],
      createdAt: "2025-01-10T08:00:00Z",
      updatedAt: "2025-01-12T10:00:00Z",
      lastEvidenceAt: "2025-01-12T10:00:00Z",
    });
    renderWithRoute();
    expect(await screen.findByText(/Evidence Chain/)).toBeInTheDocument();
    expect(screen.getByText("First observation")).toBeInTheDocument();
    expect(screen.getByText("Second observation")).toBeInTheDocument();
  });

  it("shows not found when hypothesis is null", async () => {
    mockGetHypothesis.mockResolvedValue(null);
    renderWithRoute("nonexistent");
    expect(await screen.findByText("Hypothesis not found")).toBeInTheDocument();
  });
});
