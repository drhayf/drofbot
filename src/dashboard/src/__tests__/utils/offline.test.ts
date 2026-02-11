import { describe, it, expect, vi } from "vitest";
import { isOnline, onConnectionChange, formatStaleness } from "../../utils/offline";

describe("Offline utilities", () => {
  it("isOnline returns boolean", () => {
    expect(typeof isOnline()).toBe("boolean");
  });

  describe("onConnectionChange", () => {
    it("subscribes to online/offline events", () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      const callback = vi.fn();
      const unsub = onConnectionChange(callback);

      expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith("offline", expect.any(Function));

      unsub();
      addSpy.mockRestore();
    });

    it("unsubscribes when cleanup is called", () => {
      const removeSpy = vi.spyOn(window, "removeEventListener");
      const callback = vi.fn();
      const unsub = onConnectionChange(callback);
      unsub();

      expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));
      removeSpy.mockRestore();
    });
  });

  describe("formatStaleness", () => {
    it("returns 'No data loaded' for null", () => {
      expect(formatStaleness(null)).toBe("No data loaded");
    });

    it("returns 'Updated just now' for recent timestamps", () => {
      expect(formatStaleness(Date.now() - 5000)).toBe("Updated just now");
    });

    it("returns minutes ago for timestamps within an hour", () => {
      expect(formatStaleness(Date.now() - 5 * 60 * 1000)).toBe("Updated 5m ago");
    });

    it("returns hours ago for timestamps within a day", () => {
      expect(formatStaleness(Date.now() - 3 * 60 * 60 * 1000)).toBe("Updated 3h ago");
    });

    it("returns days ago for older timestamps", () => {
      expect(formatStaleness(Date.now() - 48 * 60 * 60 * 1000)).toBe("Updated 2d ago");
    });
  });
});
