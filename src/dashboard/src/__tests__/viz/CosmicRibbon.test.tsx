import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CosmicRibbon } from "../../components/viz/CosmicRibbon";

describe("CosmicRibbon", () => {
  it("renders with all data points", () => {
    render(
      <CosmicRibbon
        card="7♥"
        moonPhase="Waxing Gibbous"
        moonIllumination={0.82}
        kpIndex={3}
        gate="Gate 44"
        resonance={0.75}
      />,
    );
    expect(screen.getByTestId("cosmic-ribbon")).toBeInTheDocument();
    expect(screen.getByTestId("ribbon-card")).toHaveTextContent("7♥");
    expect(screen.getByTestId("ribbon-moon")).toHaveTextContent("Waxing Gibbous 82%");
    expect(screen.getByTestId("ribbon-kp")).toHaveTextContent("3");
    expect(screen.getByTestId("ribbon-gate")).toHaveTextContent("Gate 44");
    expect(screen.getByTestId("ribbon-resonance")).toHaveTextContent("75%");
  });

  it("returns null when no data provided", () => {
    const { container } = render(<CosmicRibbon />);
    expect(container.firstChild).toBeNull();
  });

  it("renders with partial data", () => {
    render(<CosmicRibbon card="K♠" kpIndex={5} />);
    expect(screen.getByTestId("ribbon-card")).toHaveTextContent("K♠");
    expect(screen.getByTestId("ribbon-kp")).toHaveTextContent("5");
    expect(screen.queryByTestId("ribbon-moon")).toBeNull();
  });

  it("applies color class for high Kp", () => {
    render(<CosmicRibbon kpIndex={7} />);
    const kp = screen.getByTestId("ribbon-kp");
    expect(kp.className).toContain("text-negative");
  });

  it("applies color class for low Kp", () => {
    render(<CosmicRibbon kpIndex={2} />);
    const kp = screen.getByTestId("ribbon-kp");
    expect(kp.className).toContain("text-positive");
  });
});
