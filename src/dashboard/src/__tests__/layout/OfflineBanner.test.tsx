import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OfflineBanner } from "../../components/layout/OfflineBanner";

describe("OfflineBanner component", () => {
  const originalOnline = navigator.onLine;

  beforeEach(() => {
    // Default to online
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalOnline,
      writable: true,
      configurable: true,
    });
  });

  it("renders nothing when online", () => {
    const { container } = render(<OfflineBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("shows offline message when offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<OfflineBanner />);
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
  });

  it("has alert role for accessibility", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<OfflineBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("responds to online/offline events", () => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
    const { container } = render(<OfflineBanner />);
    expect(container.innerHTML).toBe("");

    // Go offline
    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();

    // Come back online
    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
  });
});
