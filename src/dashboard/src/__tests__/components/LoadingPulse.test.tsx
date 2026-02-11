import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { LoadingPulse } from "../../components/shared/LoadingPulse";

describe("LoadingPulse component", () => {
  it("renders three pulse dots", () => {
    const { container } = render(<LoadingPulse />);
    const dots = container.querySelectorAll(".loading-pulse");
    expect(dots).toHaveLength(3);
  });

  it("applies custom className", () => {
    const { container } = render(<LoadingPulse className="my-class" />);
    expect(container.firstChild).toHaveClass("my-class");
  });

  it("dots have staggered animation delays", () => {
    const { container } = render(<LoadingPulse />);
    const dots = container.querySelectorAll(".loading-pulse");
    expect((dots[0] as HTMLElement).style.animationDelay).toBe("0ms");
    expect((dots[1] as HTMLElement).style.animationDelay).toBe("150ms");
    expect((dots[2] as HTMLElement).style.animationDelay).toBe("300ms");
  });
});
