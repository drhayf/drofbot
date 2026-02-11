import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToastContainer, showToast } from "../../components/layout/Toast";

describe("Toast component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when no toasts", () => {
    const { container } = render(<ToastContainer />);
    expect(container.innerHTML).toBe("");
  });

  it("shows a toast message when showToast is called", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Saved successfully", "success");
    });
    expect(screen.getByText("Saved successfully")).toBeInTheDocument();
  });

  it("auto-dismisses after toastDismiss timing", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Temporary message");
    });
    expect(screen.getByText("Temporary message")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // After dismiss timeout, starts exit animation
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("Temporary message")).not.toBeInTheDocument();
  });

  it("supports manual dismiss via close button", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Dismissible toast");
    });
    const btn = screen.getByLabelText("Dismiss");
    fireEvent.click(btn);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("Dismissible toast")).not.toBeInTheDocument();
  });

  it("applies variant classes", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Error occurred", "error");
    });
    const toast = screen.getByText("Error occurred").closest("div[class*='border']");
    expect(toast?.className).toContain("border-negative");
  });

  it("has polite aria-live for accessibility", () => {
    render(<ToastContainer />);
    act(() => {
      showToast("Accessible toast");
    });
    const container = screen.getByRole("status");
    expect(container).toHaveAttribute("aria-live", "polite");
  });
});
