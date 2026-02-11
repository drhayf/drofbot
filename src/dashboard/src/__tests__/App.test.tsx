import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { setToken, clearToken } from "../api/client";
import App from "../App";
import { useAuthStore } from "../stores/auth";

// Mock all page components to avoid heavy rendering
vi.mock("../pages/Home", () => ({ default: () => <div>Home Page</div> }));
vi.mock("../pages/Journal", () => ({ default: () => <div>Journal Page</div> }));
vi.mock("../pages/JournalEntry", () => ({ default: () => <div>Journal Entry</div> }));
vi.mock("../pages/JournalCreate", () => ({ default: () => <div>Journal Create</div> }));
vi.mock("../pages/Quests", () => ({ default: () => <div>Quests Page</div> }));
vi.mock("../pages/Cosmos", () => ({ default: () => <div>Cosmos Page</div> }));
vi.mock("../pages/Intelligence", () => ({ default: () => <div>Intelligence Page</div> }));
vi.mock("../pages/HypothesisDetail", () => ({ default: () => <div>Hypothesis Detail</div> }));
vi.mock("../pages/Progression", () => ({ default: () => <div>Progression Page</div> }));
vi.mock("../pages/Settings", () => ({ default: () => <div>Settings Page</div> }));
vi.mock("../pages/Login", () => ({ default: () => <div>Login Page</div> }));
vi.mock("../components/layout/Shell", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="shell">{children}</div>
  ),
}));

describe("App routing", () => {
  beforeEach(() => {
    clearToken();
    useAuthStore.setState({ isAuthenticated: false, isLoading: false, error: null });
    // Reset jsdom location so BrowserRouter starts fresh each test
    window.history.pushState({}, "", "/");
  });

  it("redirects to login when not authenticated", () => {
    // App includes its own BrowserRouter, so don't wrap in MemoryRouter
    render(<App />);
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders login page at /login", () => {
    // App includes its own BrowserRouter, so don't wrap in MemoryRouter
    render(<App />);
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders home page when authenticated", () => {
    setToken("test-token");
    useAuthStore.setState({ isAuthenticated: true });

    render(<App />);
    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });

  it("renders shell wrapper when authenticated", () => {
    setToken("test-token");
    useAuthStore.setState({ isAuthenticated: true });

    render(<App />);
    expect(screen.getByTestId("shell")).toBeInTheDocument();
  });
});
