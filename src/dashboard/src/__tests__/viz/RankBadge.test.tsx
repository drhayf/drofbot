import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RankBadge } from "../../components/viz/RankBadge";

describe("RankBadge", () => {
  it("renders rank id and title", () => {
    render(<RankBadge rankId="E" title="Awakening" />);
    expect(screen.getByTestId("rank-badge")).toBeInTheDocument();
    expect(screen.getByTestId("rank-id")).toHaveTextContent("E");
    expect(screen.getByTestId("rank-title")).toHaveTextContent("Awakening");
  });

  it("shows level when provided", () => {
    render(<RankBadge rankId="C" title="Aligning" level={12} />);
    expect(screen.getByTestId("rank-title")).toHaveTextContent("Lv.12");
  });

  it("hides title in compact mode", () => {
    render(<RankBadge rankId="SS" title="Sovereign" compact />);
    expect(screen.getByTestId("rank-id")).toHaveTextContent("SS");
    expect(screen.queryByTestId("rank-title")).toBeNull();
  });

  it("renders all rank levels", () => {
    const ranks = ["E", "D", "C", "B", "A", "S", "SS"] as const;
    for (const r of ranks) {
      const { unmount } = render(<RankBadge rankId={r} title="Test" />);
      expect(screen.getByTestId("rank-id")).toHaveTextContent(r);
      unmount();
    }
  });
});
