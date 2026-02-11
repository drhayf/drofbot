import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { Nav } from "../../components/layout/Nav";

describe("Nav component", () => {
  it("renders all 7 navigation items", () => {
    render(
      <MemoryRouter>
        <Nav orientation="vertical" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Observatory")).toBeInTheDocument();
    expect(screen.getByText("Chronicle")).toBeInTheDocument();
    expect(screen.getByText("The Path")).toBeInTheDocument();
    expect(screen.getByText("Weather")).toBeInTheDocument();
    expect(screen.getByText("The Mirror")).toBeInTheDocument();
    expect(screen.getByText("The Ascent")).toBeInTheDocument();
    expect(screen.getByText("The Forge")).toBeInTheDocument();
  });

  it("renders vertical layout as nav element", () => {
    const { container } = render(
      <MemoryRouter>
        <Nav orientation="vertical" />
      </MemoryRouter>,
    );
    // Vertical renders a <nav> with flex-1 layout
    expect(container.querySelector("nav")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("flex-1");
  });

  it("renders horizontal layout as div", () => {
    const { container } = render(
      <MemoryRouter>
        <Nav orientation="horizontal" />
      </MemoryRouter>,
    );
    // Horizontal renders a <div> with flex justify-around
    expect(container.querySelector("nav")).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass("flex", "justify-around");
  });

  it("links point to correct routes", () => {
    render(
      <MemoryRouter>
        <Nav orientation="vertical" />
      </MemoryRouter>,
    );

    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/");
    expect(hrefs).toContain("/journal");
    expect(hrefs).toContain("/quests");
    expect(hrefs).toContain("/cosmos");
    expect(hrefs).toContain("/intelligence");
    expect(hrefs).toContain("/progression");
    expect(hrefs).toContain("/settings");
  });
});
