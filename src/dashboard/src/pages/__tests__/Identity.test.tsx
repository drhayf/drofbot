import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Identity } from "../../pages/Identity";
import { useIdentityStore } from "../../stores/identity";

// Mock the store
vi.mock("../../stores/identity", () => ({
  useIdentityStore: vi.fn(),
}));

// Mock child components to simplify testing
vi.mock("../../components/identity", () => ({
  IdentityCore: () => <div data-testid="identity-core">Core</div>,
  IdentityEvolution: () => <div data-testid="identity-evolution">Evolution</div>,
  IdentityJourney: () => <div data-testid="identity-journey">Journey</div>,
  IdentityMemory: () => <div data-testid="identity-memory">Memory</div>,
  IdentityPatterns: () => <div data-testid="identity-patterns">Patterns</div>,
  IdentityPortrait: () => <div data-testid="identity-portrait">Portrait</div>,
  IdentityRelationship: () => <div data-testid="identity-relationship">Relationship</div>,
  IdentityVoice: () => <div data-testid="identity-voice">Voice</div>,
}));

describe("Identity Page", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useIdentityStore as any).mockReturnValue({
      fetch: mockFetch,
      isLoading: false,
      error: null,
      lastFetched: Date.now(),
      depthOfUnderstanding: 50,
      milestones: [],
      profile: {},
      vault: {},
      relationship: {},
      voice: {},
      hypotheses: [],
      patterns: [],
      memory: {},
      progression: { stats: {}, quests: [] },
    });
  });

  it("renders all sections when data is loaded", () => {
    render(<Identity />);
    
    expect(screen.getByText("The Reflection")).toBeInTheDocument();
    expect(screen.getByTestId("identity-core")).toBeInTheDocument();
    expect(screen.getByTestId("identity-evolution")).toBeInTheDocument();
    expect(screen.getByTestId("identity-portrait")).toBeInTheDocument();
  });

  it("calls fetch on mount", () => {
    render(<Identity />);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("shows loading state when loading and no data", () => {
    (useIdentityStore as any).mockReturnValue({
      fetch: mockFetch,
      isLoading: true,
      lastFetched: null,
      error: null,
    });

    render(<Identity />);
    // LoadingPulse usually has an aria-busy or similar, or just check that content isn't there
    expect(screen.queryByTestId("identity-core")).not.toBeInTheDocument();
  });

  it("shows error state", () => {
    (useIdentityStore as any).mockReturnValue({
      fetch: mockFetch,
      isLoading: false,
      lastFetched: null,
      error: new Error("Failed"),
    });

    render(<Identity />);
    expect(screen.getByText("Failed to load identity data")).toBeInTheDocument();
  });
});
