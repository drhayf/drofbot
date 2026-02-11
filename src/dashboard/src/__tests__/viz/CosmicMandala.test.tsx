import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CosmicMandala } from "../../components/viz/CosmicMandala";

const mockSystems = [
  {
    name: "cardology",
    displayName: "Cardology",
    summary: "7 of Hearts",
    element: "FIRE",
    intensity: 0.8,
  },
  {
    name: "iching",
    displayName: "I-Ching",
    summary: "Gate 44 Line 3",
    element: "EARTH",
    intensity: 0.6,
  },
  {
    name: "transits",
    displayName: "Transits",
    summary: "Venus trine Mars",
    element: "WATER",
    intensity: 0.7,
  },
  { name: "solar", displayName: "Solar", summary: "Kp 3", element: "FIRE", intensity: 0.4 },
  {
    name: "lunar",
    displayName: "Lunar",
    summary: "Waxing Gibbous 82%",
    element: "WATER",
    intensity: 0.5,
  },
  {
    name: "synthesis",
    displayName: "Synthesis",
    summary: "Harmonic alignment",
    element: "ETHER",
    intensity: 0.9,
  },
];

describe("CosmicMandala", () => {
  it("renders with system segments", () => {
    render(<CosmicMandala systems={mockSystems} />);
    expect(screen.getByTestId("cosmic-mandala")).toBeInTheDocument();
  });

  it("renders empty state when no systems", () => {
    render(<CosmicMandala systems={[]} />);
    expect(screen.getByText("No cosmic data")).toBeInTheDocument();
  });

  it("renders a segment for each system", () => {
    render(<CosmicMandala systems={mockSystems} />);
    for (const sys of mockSystems) {
      expect(screen.getByTestId(`mandala-segment-${sys.name}`)).toBeInTheDocument();
    }
  });

  it("shows resonance percentage in center", () => {
    render(<CosmicMandala systems={mockSystems} overallResonance={0.72} />);
    expect(screen.getByTestId("mandala-resonance")).toHaveTextContent("72%");
  });

  it("shows tooltip on hover", () => {
    render(<CosmicMandala systems={mockSystems} />);
    const segment = screen.getByTestId("mandala-segment-cardology");
    fireEvent.mouseEnter(segment);
    expect(screen.getByTestId("mandala-tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("mandala-tooltip")).toHaveTextContent("Cardology");
  });

  it("hides tooltip on mouse leave", () => {
    render(<CosmicMandala systems={mockSystems} />);
    const segment = screen.getByTestId("mandala-segment-cardology");
    fireEvent.mouseEnter(segment);
    expect(screen.getByTestId("mandala-tooltip")).toBeInTheDocument();
    fireEvent.mouseLeave(segment);
    expect(screen.queryByTestId("mandala-tooltip")).toBeNull();
  });

  it("calls onSegmentSelect when segment is clicked", () => {
    const handler = vi.fn();
    render(<CosmicMandala systems={mockSystems} onSegmentSelect={handler} />);
    const segment = screen.getByTestId("mandala-segment-iching");
    fireEvent.click(segment);
    expect(handler).toHaveBeenCalledWith(mockSystems[1]);
  });

  it("renders elemental balance ring when provided", () => {
    const balance = { FIRE: 0.3, WATER: 0.25, EARTH: 0.2, AIR: 0.15, ETHER: 0.1 };
    render(<CosmicMandala systems={mockSystems} elementalBalance={balance} />);
    expect(screen.getByTestId("mandala-element-fire")).toBeInTheDocument();
    expect(screen.getByTestId("mandala-element-water")).toBeInTheDocument();
  });
});
