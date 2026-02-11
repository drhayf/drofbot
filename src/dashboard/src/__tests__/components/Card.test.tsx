import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Card, CardHeader, CardContent } from "../../components/shared/Card";

describe("Card component", () => {
  it("renders children", () => {
    render(<Card>Test content</Card>);
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("adds hover styles when hoverable", () => {
    const { container } = render(<Card hoverable>Content</Card>);
    expect(container.firstChild).toHaveClass("hover:shadow-card-hover");
  });

  it("adds cursor-pointer when onClick provided", () => {
    const { container } = render(<Card onClick={() => {}}>Content</Card>);
    expect(container.firstChild).toHaveClass("cursor-pointer");
  });
});

describe("CardHeader component", () => {
  it("renders children with border", () => {
    render(<CardHeader>Header text</CardHeader>);
    const header = screen.getByText("Header text");
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass("border-b");
  });
});

describe("CardContent component", () => {
  it("renders children with padding", () => {
    render(<CardContent>Body text</CardContent>);
    const content = screen.getByText("Body text");
    expect(content).toBeInTheDocument();
    expect(content).toHaveClass("px-5", "py-4");
  });
});
