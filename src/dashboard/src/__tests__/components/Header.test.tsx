import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import type { CosmicWeather } from "../../types";
import { Header } from "../../components/layout/Header";

const mockWeather: CosmicWeather = {
  gate: { timestamp: "", number: 42, metrics: {}, summary: "" },
  lunar: { timestamp: "", phase: "Waxing", metrics: {}, summary: "" },
  solar: { timestamp: "", kpIndex: 3, metrics: {}, summary: "" },
  card: { timestamp: "", currentPlanet: "Jupiter", summary: "" },
  transits: { timestamp: "", metrics: {}, summary: "" },
  synthesis: { overallResonance: 0.7, resonanceType: "HARMONIC", narrative: "Good day", confidence: 0.85 },
};

// Mock the cosmic store — zustand selectors receive the full state object
vi.mock("../../stores/cosmic", () => ({
  useCosmicStore: vi.fn((selector: (s: { weather: CosmicWeather }) => unknown) =>
    selector({ weather: mockWeather }),
  ),
}));

describe("Header component", () => {
  it("renders the header element", () => {
    const { container } = render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );
    expect(container.querySelector("header")).toBeInTheDocument();
  });

  it("renders date display", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    // Should show today's date in some format
    const today = new Date();
    const month = today.toLocaleString("en-US", { month: "short" });
    expect(screen.getByText(new RegExp(month))).toBeInTheDocument();
  });

  it("displays cosmic indicators from store", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Gate 42/)).toBeInTheDocument();
  });
});
