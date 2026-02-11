import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ResonanceBar } from "../../components/viz/ResonanceBar";

describe("ResonanceBar", () => {
  it("renders with score percentage", () => {
    render(<ResonanceBar score={0.72} />);
    expect(screen.getByTestId("resonance-bar")).toBeInTheDocument();
    expect(screen.getByTestId("resonance-value")).toHaveTextContent("72%");
  });

  it("shows resonance type label", () => {
    render(<ResonanceBar score={0.85} resonanceType="HARMONIC" />);
    expect(screen.getByTestId("resonance-type")).toHaveTextContent("Harmonic");
  });

  it("renders progressbar with correct aria values", () => {
    render(<ResonanceBar score={0.5} />);
    const fill = screen.getByTestId("resonance-fill");
    expect(fill).toHaveAttribute("role", "progressbar");
    expect(fill).toHaveAttribute("aria-valuenow", "50");
  });

  it("sets fill width to 0% when loading", () => {
    render(<ResonanceBar score={0.8} isLoading />);
    const fill = screen.getByTestId("resonance-fill");
    expect(fill.style.width).toBe("0%");
  });

  it("clamps score to 0-1 range", () => {
    render(<ResonanceBar score={1.5} />);
    expect(screen.getByTestId("resonance-value")).toHaveTextContent("100%");
  });
});
