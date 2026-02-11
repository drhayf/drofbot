import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import Cosmos from "../../pages/Cosmos";

vi.mock("../../components/viz", () => ({
  CosmicMandala: (props: Record<string, unknown>) => (
    <div data-testid="cosmic-mandala">{(props.systems as unknown[])?.length ?? 0} systems</div>
  ),
  CardDisplay: (props: Record<string, unknown>) => (
    <div data-testid="card-display">{(props.card as { name?: string })?.name ?? ""}</div>
  ),
  MoonPhase: (props: Record<string, unknown>) => (
    <div data-testid="moon-phase">{String(props.phaseName ?? "")}</div>
  ),
  KpGauge: (props: Record<string, unknown>) => (
    <div data-testid="kp-gauge">Kp {String(props.value ?? 0)}</div>
  ),
  PeriodProgress: (props: Record<string, unknown>) => (
    <div data-testid="period-progress">
      Day {String(props.currentDay)}/{String(props.totalDays)}
    </div>
  ),
  ResonanceBar: (props: Record<string, unknown>) => (
    <div data-testid="resonance-bar">{String(props.resonanceType ?? "")}</div>
  ),
  FrequencyBand: (props: Record<string, unknown>) => (
    <div data-testid="frequency-band">{String(props.frequency ?? "")}</div>
  ),
}));

vi.mock("../../stores/cosmic", () => ({
  useCosmicStore: vi.fn(() => ({
    weather: {
      card: {
        timestamp: "2025-01-15T10:00:00Z",
        rank: 1,
        rankName: "Ace",
        suit: "Hearts",
        name: "Ace of Hearts",
        currentPlanet: "Mercury",
        currentDay: 5,
        totalDays: 52,
        daysRemaining: 47,
        summary: "Ace of Hearts in Mercury period",
      },
      gate: {
        timestamp: "2025-01-15T10:00:00Z",
        number: 42,
        line: 3,
        name: "Increase",
        geneKeys: { shadow: "Expectation", gift: "Detachment", siddhi: "Celebration" },
        profile: "4/6",
        metrics: {},
        summary: "Gate 42.3 – Increase",
      },
      solar: {
        timestamp: "2025-01-15T10:00:00Z",
        kpIndex: 4,
        solarWind: "350 km/s",
        geomagneticConditions: "Active",
        metrics: {},
        summary: "Active solar conditions",
      },
      lunar: {
        timestamp: "2025-01-15T10:00:00Z",
        phase: "Full Moon",
        illumination: 0.98,
        daysToNextPhase: 3,
        isVoidOfCourse: false,
        metrics: {},
        summary: "Full Moon",
      },
      transits: {
        timestamp: "2025-01-15T10:00:00Z",
        active: [
          { planet: "Venus", aspect: "Trine Jupiter" },
          { planet: "Mars", aspect: "Square Saturn" },
        ],
        retrogrades: ["Mercury"],
        metrics: {},
        summary: "Venus trine Jupiter, Mars square Saturn",
      },
      synthesis: {
        overallResonance: 0.8,
        resonanceType: "Harmonic",
        narrative: "A potent day for growth",
      },
    },
    isLoading: false,
    fetch: vi.fn(),
    fetchSynthesis: vi.fn(),
  })),
}));

describe("Cosmos page", () => {
  it("renders Cosmic Weather heading", () => {
    render(
      <MemoryRouter>
        <Cosmos />
      </MemoryRouter>,
    );
    expect(screen.getByText("Cosmic Weather")).toBeInTheDocument();
  });

  it("renders cosmic mandala", () => {
    render(
      <MemoryRouter>
        <Cosmos />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("cosmic-mandala")).toBeInTheDocument();
  });

  it("shows Cardology system panel", () => {
    render(
      <MemoryRouter>
        <Cosmos />
      </MemoryRouter>,
    );
    expect(screen.getByText("Cardology")).toBeInTheDocument();
    expect(screen.getByTestId("card-display")).toBeInTheDocument();
  });

  it("shows I-Ching / Human Design panel with Gene Keys", () => {
    render(
      <MemoryRouter>
        <Cosmos />
      </MemoryRouter>,
    );
    expect(screen.getByText("I-Ching / Human Design")).toBeInTheDocument();
    expect(screen.getByText("Gene Keys Spectrum")).toBeInTheDocument();
    expect(screen.getByTestId("frequency-band")).toBeInTheDocument();
  });

  it("shows Astrology panel with active transits", () => {
    render(
      <MemoryRouter>
        <Cosmos />
      </MemoryRouter>,
    );
    expect(screen.getByText("Astrology")).toBeInTheDocument();
    expect(screen.getByText("Venus")).toBeInTheDocument();
    expect(screen.getByText("Trine Jupiter")).toBeInTheDocument();
  });

  it("shows retrograde planets", () => {
    render(
      <MemoryRouter>
        <Cosmos />
      </MemoryRouter>,
    );
    expect(screen.getByText("Retrogrades")).toBeInTheDocument();
    expect(screen.getByText("Mercury")).toBeInTheDocument();
  });

  it("shows Solar Weather panel with KpGauge", () => {
    render(
      <MemoryRouter>
        <Cosmos />
      </MemoryRouter>,
    );
    expect(screen.getByText("Solar Weather")).toBeInTheDocument();
    expect(screen.getByTestId("kp-gauge")).toBeInTheDocument();
  });

  it("shows Lunar Cycle panel", () => {
    render(
      <MemoryRouter>
        <Cosmos />
      </MemoryRouter>,
    );
    expect(screen.getByText("Lunar Cycle")).toBeInTheDocument();
    expect(screen.getByTestId("moon-phase")).toBeInTheDocument();
  });

  it("shows Master Synthesis panel with narrative", () => {
    render(
      <MemoryRouter>
        <Cosmos />
      </MemoryRouter>,
    );
    expect(screen.getByText("Master Synthesis")).toBeInTheDocument();
    expect(screen.getByText("A potent day for growth")).toBeInTheDocument();
  });
});
