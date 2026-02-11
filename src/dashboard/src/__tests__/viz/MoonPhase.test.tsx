import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MoonPhase } from "../../components/viz/MoonPhase";

describe("MoonPhase", () => {
  it("renders with phase name and illumination", () => {
    render(<MoonPhase illumination={0.75} phaseName="Waxing Gibbous" />);
    expect(screen.getByTestId("moon-phase")).toBeInTheDocument();
    expect(screen.getByTestId("moon-phase-name")).toHaveTextContent("Waxing Gibbous");
    expect(screen.getByTestId("moon-illumination")).toHaveTextContent("75%");
  });

  it("renders new moon at 0% illumination", () => {
    render(<MoonPhase illumination={0} phaseName="New Moon" />);
    expect(screen.getByTestId("moon-illumination")).toHaveTextContent("0%");
  });

  it("renders full moon at 100% illumination", () => {
    render(<MoonPhase illumination={1} phaseName="Full Moon" />);
    expect(screen.getByTestId("moon-illumination")).toHaveTextContent("100%");
  });

  it("clamps illumination to valid range", () => {
    render(<MoonPhase illumination={1.5} phaseName="Over" />);
    expect(screen.getByTestId("moon-illumination")).toHaveTextContent("100%");
  });

  it("shows days to next phase when provided", () => {
    render(<MoonPhase illumination={0.5} phaseName="First Quarter" daysToNextPhase={3} />);
    expect(screen.getByTestId("moon-next-phase")).toHaveTextContent("3d to next");
  });

  it("hides days to next phase when not provided", () => {
    render(<MoonPhase illumination={0.5} phaseName="First Quarter" />);
    expect(screen.queryByTestId("moon-next-phase")).toBeNull();
  });

  it("renders SVG with aria label", () => {
    render(<MoonPhase illumination={0.42} phaseName="Waxing Crescent" />);
    const svg = screen.getByRole("img");
    expect(svg).toHaveAttribute("aria-label", "Moon phase: Waxing Crescent, 42% illuminated");
  });
});
