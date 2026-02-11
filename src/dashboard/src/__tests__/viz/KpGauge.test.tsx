import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { KpGauge } from "../../components/viz/KpGauge";

describe("KpGauge", () => {
  it("renders with a Kp value", () => {
    render(<KpGauge value={3} />);
    expect(screen.getByTestId("kp-gauge")).toBeInTheDocument();
    expect(screen.getByTestId("kp-value")).toHaveTextContent("3");
  });

  it("shows default severity label", () => {
    render(<KpGauge value={1} />);
    expect(screen.getByTestId("kp-severity")).toHaveTextContent("Quiet");
  });

  it("shows custom label when provided", () => {
    render(<KpGauge value={5} label="G1 Minor" />);
    expect(screen.getByTestId("kp-severity")).toHaveTextContent("G1 Minor");
  });

  it("clamps value to 0-9 range", () => {
    render(<KpGauge value={12} />);
    expect(screen.getByTestId("kp-value")).toHaveTextContent("9");
  });

  it("clamps negative values to 0", () => {
    render(<KpGauge value={-2} />);
    expect(screen.getByTestId("kp-value")).toHaveTextContent("0");
  });

  it("renders SVG with aria label", () => {
    render(<KpGauge value={7} />);
    const svg = screen.getByRole("img");
    expect(svg).toHaveAttribute("aria-label", "Kp Index: 7, Strong Storm");
  });
});
