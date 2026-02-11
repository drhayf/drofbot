import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Settings from "../../pages/Settings";

const mockUpdate = vi.fn();
const mockUpdateBriefings = vi.fn();

// Stable references to prevent infinite useEffect re-render loops
const mockPreferences = {
  theme: "light",
  density: "comfortable",
  animations: true,
  notifications: true,
  activeSystems: ["cardology", "astrology"],
};
const mockBriefings = {
  morningTime: "08:00",
  eveningTime: "20:00",
  channels: ["telegram"],
  systems: [],
};

vi.mock("../../stores/preferences", () => ({
  usePreferencesStore: vi.fn(() => ({
    preferences: mockPreferences,
    briefings: mockBriefings,
    isLoading: false,
    fetch: vi.fn(),
    fetchBriefings: vi.fn(),
    update: mockUpdate,
    updateBriefings: mockUpdateBriefings,
  })),
}));

describe("Settings page", () => {
  it("renders The Forge heading", () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );
    expect(screen.getByText("The Forge")).toBeInTheDocument();
  });

  it("shows Display section with theme selector", () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );
    expect(screen.getByText("Display")).toBeInTheDocument();
    expect(screen.getByLabelText("Theme")).toBeInTheDocument();
    expect(screen.getByLabelText("Density")).toBeInTheDocument();
    expect(screen.getByLabelText("Animations")).toBeInTheDocument();
  });

  it("shows Cosmic Systems section with toggle buttons", () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );
    expect(screen.getByText("Cosmic Systems")).toBeInTheDocument();
    // System names appear twice: Cosmic Systems + Briefing systems
    expect(screen.getAllByText("cardology").length).toBe(2);
    expect(screen.getAllByText("iching").length).toBe(2);
    expect(screen.getAllByText("astrology").length).toBe(2);
  });

  it("shows Briefing Schedule section", () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );
    expect(screen.getByText("Briefing Schedule")).toBeInTheDocument();
    expect(screen.getByLabelText("Morning")).toBeInTheDocument();
    expect(screen.getByLabelText("Evening")).toBeInTheDocument();
  });

  it("shows briefing channel toggles", () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );
    expect(screen.getByText("Briefing channels")).toBeInTheDocument();
    expect(screen.getByText("telegram")).toBeInTheDocument();
    expect(screen.getByText("discord")).toBeInTheDocument();
  });

  it("shows Notifications section", () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByLabelText("Enable notifications")).toBeInTheDocument();
  });

  it("shows Save Changes button", () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>,
    );
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });
});
