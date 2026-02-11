import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Shell from "../../components/layout/Shell";

// Mock store-dependent components
vi.mock("../../stores/cosmic", () => ({
  useCosmicStore: vi.fn(() => ({
    currentWeather: null,
  })),
}));

vi.mock("../../utils/offline", () => ({
  isOnline: () => true,
  onConnectionChange: () => () => {},
}));

describe("Shell responsive layout", () => {
  it("renders desktop sidebar with Drofbot branding", () => {
    render(
      <MemoryRouter>
        <Shell>
          <div>content</div>
        </Shell>
      </MemoryRouter>,
    );
    expect(screen.getByText("Drofbot")).toBeInTheDocument();
  });

  it("renders children in main content area", () => {
    render(
      <MemoryRouter>
        <Shell>
          <div>Test Content</div>
        </Shell>
      </MemoryRouter>,
    );
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("renders BottomNav for mobile", () => {
    render(
      <MemoryRouter>
        <Shell>
          <div>content</div>
        </Shell>
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(nav).toBeInTheDocument();
    // BottomNav has md:hidden class
    expect(nav.className).toContain("md:hidden");
  });

  it("has desktop sidebar hidden on mobile", () => {
    const { container } = render(
      <MemoryRouter>
        <Shell>
          <div>content</div>
        </Shell>
      </MemoryRouter>,
    );
    const aside = container.querySelector("aside");
    expect(aside).toBeInTheDocument();
    expect(aside?.className).toContain("hidden md:flex");
  });

  it("applies page-enter animation class to content wrapper", () => {
    const { container } = render(
      <MemoryRouter>
        <Shell>
          <div>content</div>
        </Shell>
      </MemoryRouter>,
    );
    const contentWrapper = container.querySelector(".page-enter");
    expect(contentWrapper).toBeInTheDocument();
  });

  it("adds bottom padding for mobile nav clearance", () => {
    const { container } = render(
      <MemoryRouter>
        <Shell>
          <div>content</div>
        </Shell>
      </MemoryRouter>,
    );
    const contentWrapper = container.querySelector(".page-enter");
    expect(contentWrapper?.className).toContain("pb-24");
    expect(contentWrapper?.className).toContain("md:pb-6");
  });
});
