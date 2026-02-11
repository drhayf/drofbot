import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ConfidenceGauge } from "../../components/viz/ConfidenceGauge";

describe("ConfidenceGauge", () => {
  it("renders with confidence percentage", () => {
    render(<ConfidenceGauge confidence={0.73} />);
    expect(screen.getByTestId("confidence-gauge")).toBeInTheDocument();
    expect(screen.getByTestId("confidence-value")).toHaveTextContent("73");
  });

  it("shows label when provided", () => {
    render(<ConfidenceGauge confidence={0.9} label="Confirmed" />);
    expect(screen.getByTestId("confidence-label")).toHaveTextContent("Confirmed");
  });

  it("hides label when not provided", () => {
    render(<ConfidenceGauge confidence={0.5} />);
    expect(screen.queryByTestId("confidence-label")).toBeNull();
  });

  it("clamps to 0 for negative confidence", () => {
    render(<ConfidenceGauge confidence={-0.5} />);
    expect(screen.getByTestId("confidence-value")).toHaveTextContent("0");
  });

  it("clamps to 100 for over-1 confidence", () => {
    render(<ConfidenceGauge confidence={2.0} />);
    expect(screen.getByTestId("confidence-value")).toHaveTextContent("100");
  });

  it("renders SVG arcs", () => {
    const { container } = render(<ConfidenceGauge confidence={0.6} />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(2); // background + value arc
  });
});
