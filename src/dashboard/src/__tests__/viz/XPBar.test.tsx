import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { XPBar } from "../../components/viz/XPBar";

describe("XPBar", () => {
  it("renders with current and total XP", () => {
    render(<XPBar currentXP={500} xpToNext={500} />);
    expect(screen.getByTestId("xp-bar")).toBeInTheDocument();
    expect(screen.getByTestId("xp-values")).toHaveTextContent("500 / 1,000");
  });

  it("shows level label", () => {
    render(<XPBar currentXP={300} xpToNext={700} level={5} />);
    expect(screen.getByText("Level 5")).toBeInTheDocument();
  });

  it("renders progressbar with correct percentage", () => {
    render(<XPBar currentXP={250} xpToNext={750} />);
    const fill = screen.getByTestId("xp-fill");
    expect(fill).toHaveAttribute("role", "progressbar");
    expect(fill).toHaveAttribute("aria-valuenow", "25");
  });

  it("handles zero XP gracefully", () => {
    render(<XPBar currentXP={0} xpToNext={0} />);
    const fill = screen.getByTestId("xp-fill");
    expect(fill).toHaveAttribute("aria-valuenow", "0");
  });
});
