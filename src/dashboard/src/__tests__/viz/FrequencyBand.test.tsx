import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FrequencyBand } from "../../components/viz/FrequencyBand";

describe("FrequencyBand", () => {
  it("renders with frequency level", () => {
    render(<FrequencyBand frequency="GIFT" />);
    expect(screen.getByTestId("frequency-band")).toBeInTheDocument();
  });

  it("highlights active frequency label", () => {
    render(<FrequencyBand frequency="SHADOW" />);
    const label = screen.getByTestId("frequency-label-shadow");
    expect(label).toHaveClass("font-semibold");
  });

  it("highlights GIFT segment when active", () => {
    render(<FrequencyBand frequency="GIFT" />);
    const label = screen.getByTestId("frequency-label-gift");
    expect(label).toHaveClass("font-semibold");
  });

  it("shows percentage when provided", () => {
    render(<FrequencyBand frequency="SIDDHI" percentage={85} />);
    expect(screen.getByTestId("frequency-percentage")).toHaveTextContent("85%");
  });

  it("hides percentage when not provided", () => {
    render(<FrequencyBand frequency="SHADOW" />);
    expect(screen.queryByTestId("frequency-percentage")).toBeNull();
  });

  it("renders all three segments", () => {
    render(<FrequencyBand frequency="GIFT" />);
    expect(screen.getByTestId("frequency-segment-shadow")).toBeInTheDocument();
    expect(screen.getByTestId("frequency-segment-gift")).toBeInTheDocument();
    expect(screen.getByTestId("frequency-segment-siddhi")).toBeInTheDocument();
  });

  it("uses custom labels", () => {
    render(
      <FrequencyBand frequency="GIFT" labels={{ shadow: "Fear", gift: "Love", siddhi: "Grace" }} />,
    );
    expect(screen.getByTestId("frequency-label-shadow")).toHaveTextContent("Fear");
    expect(screen.getByTestId("frequency-label-gift")).toHaveTextContent("Love");
    expect(screen.getByTestId("frequency-label-siddhi")).toHaveTextContent("Grace");
  });
});
