import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StreakIndicator } from "../../components/viz/StreakIndicator";

describe("StreakIndicator", () => {
  it("renders with streak days", () => {
    render(<StreakIndicator days={7} />);
    expect(screen.getByTestId("streak-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("streak-days")).toHaveTextContent("7 days");
  });

  it("uses singular for 1 day", () => {
    render(<StreakIndicator days={1} />);
    expect(screen.getByTestId("streak-days")).toHaveTextContent("1 day");
  });

  it("renders compact mode", () => {
    render(<StreakIndicator days={5} compact />);
    expect(screen.getByTestId("streak-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("streak-indicator")).toHaveTextContent("5d");
  });

  it("handles zero streak", () => {
    render(<StreakIndicator days={0} />);
    expect(screen.getByTestId("streak-days")).toHaveTextContent("0 days");
  });
});
