import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearToken } from "../../api/client";
import Login from "../../pages/Login";
import { useAuthStore } from "../../stores/auth";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

describe("Login page", () => {
  beforeEach(() => {
    clearToken();
    useAuthStore.setState({ isAuthenticated: false, isLoading: false, error: null });
    mockNavigate.mockClear();
  });

  it("renders login form", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByText("Drofbot")).toBeInTheDocument();
    expect(screen.getByLabelText(/Dashboard Token/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
  });

  it("disables submit when token is empty", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: /Sign In/i });
    expect(button).toBeDisabled();
  });

  it("enables submit when token is entered", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText(/Dashboard Token/i);
    fireEvent.change(input, { target: { value: "test-token" } });

    const button = screen.getByRole("button", { name: /Sign In/i });
    expect(button).not.toBeDisabled();
  });

  it("displays error message on failed login", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText(/Dashboard Token/i);
    fireEvent.change(input, { target: { value: "bad-token" } });
    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid token")).toBeInTheDocument();
    });
  });

  it("shows env var hint", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.getByText(/DROFBOT_DASHBOARD_TOKEN/)).toBeInTheDocument();
  });
});
