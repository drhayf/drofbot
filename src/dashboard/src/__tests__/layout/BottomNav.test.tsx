import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { BottomNav } from "../../components/layout/BottomNav";

describe("BottomNav component", () => {
  it("renders all navigation items", () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Journal")).toBeInTheDocument();
    expect(screen.getByText("Quests")).toBeInTheDocument();
    expect(screen.getByText("Cosmos")).toBeInTheDocument();
    expect(screen.getByText("Mirror")).toBeInTheDocument();
    expect(screen.getByText("Ascent")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders as a nav element with correct aria label", () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(nav).toBeInTheDocument();
  });

  it("applies safe area padding for iOS", () => {
    // jsdom doesn't support env() CSS — verify the source component includes safe-area padding
    const fs = require("node:fs");
    const path = require("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../components/layout/BottomNav.tsx"),
      "utf-8",
    );
    expect(src).toContain("safe-area-inset-bottom");
  });

  it("hides on md+ breakpoints via CSS class", () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("md:hidden");
  });

  it("has 44px minimum touch targets", () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole("link");
    for (const link of links) {
      expect(link.className).toContain("min-w-[44px]");
      expect(link.className).toContain("min-h-[44px]");
    }
  });

  it("highlights active route", () => {
    render(
      <MemoryRouter initialEntries={["/journal"]}>
        <BottomNav />
      </MemoryRouter>,
    );
    const journalLink = screen.getByText("Journal").closest("a");
    expect(journalLink?.className).toContain("text-accent");
  });
});
