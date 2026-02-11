import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PeriodProgress } from "../../components/viz/PeriodProgress";

describe("PeriodProgress", () => {
  it("renders with day and total", () => {
    render(<PeriodProgress currentDay={15} totalDays={52} />);
    expect(screen.getByTestId("period-progress")).toBeInTheDocument();
    expect(screen.getByTestId("period-day")).toHaveTextContent("Day 15/52");
  });

  it("shows period label", () => {
    render(<PeriodProgress currentDay={10} totalDays={52} periodLabel="Mercury Period" />);
    expect(screen.getByTestId("period-label")).toHaveTextContent("Mercury Period");
  });

  it("shows days remaining", () => {
    render(<PeriodProgress currentDay={40} totalDays={52} daysRemaining={12} />);
    expect(screen.getByTestId("period-remaining")).toHaveTextContent("12 days remaining");
  });

  it("renders progressbar with aria attributes", () => {
    render(<PeriodProgress currentDay={26} totalDays={52} />);
    const fill = screen.getByTestId("period-fill");
    expect(fill).toHaveAttribute("role", "progressbar");
    expect(fill).toHaveAttribute("aria-valuenow", "50");
  });

  it("renders position marker", () => {
    render(<PeriodProgress currentDay={26} totalDays={52} />);
    expect(screen.getByTestId("period-marker")).toBeInTheDocument();
  });

  it("uses cyclePercentage when provided", () => {
    render(<PeriodProgress currentDay={10} totalDays={52} cyclePercentage={0.75} />);
    const fill = screen.getByTestId("period-fill");
    expect(fill).toHaveAttribute("aria-valuenow", "75");
  });
});
