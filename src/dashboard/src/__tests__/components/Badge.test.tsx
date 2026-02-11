import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "../../components/shared/Badge";

describe("Badge component", () => {
  it("renders children text", () => {
    render(<Badge>Status</Badge>);
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("applies default variant classes", () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass("text-xs", "rounded-full");
  });

  it("applies success variant", () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("text-semantic-success");
  });

  it("applies error variant", () => {
    const { container } = render(<Badge variant="error">Error</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("text-semantic-error");
  });

  it("applies accent variant", () => {
    const { container } = render(<Badge variant="accent">Accent</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain("text-accent-deep");
  });

  it("renders dot indicator when dot prop is true", () => {
    const { container } = render(<Badge dot>Dot</Badge>);
    const dot = container.querySelector(".rounded-full.w-1\\.5");
    expect(dot).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<Badge className="extra">Badge</Badge>);
    expect(container.firstChild).toHaveClass("extra");
  });
});
