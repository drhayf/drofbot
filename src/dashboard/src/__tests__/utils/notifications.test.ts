import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isPushSupported,
  getPermissionState,
  requestPermission,
  registerServiceWorker,
} from "../../utils/notifications";

describe("Notification utilities", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("detects push support", () => {
    // jsdom has navigator.serviceWorker as undefined by default
    const result = isPushSupported();
    expect(typeof result).toBe("boolean");
  });

  it("returns permission state", () => {
    const state = getPermissionState();
    // In jsdom Notification is not defined — should return "unsupported"
    expect(state).toBe("unsupported");
  });

  it("returns denied when Notification API unavailable", async () => {
    const result = await requestPermission();
    expect(result).toBe("denied");
  });

  it("registerServiceWorker returns null when SW not supported", async () => {
    // jsdom doesn't have navigator.serviceWorker
    const result = await registerServiceWorker();
    expect(result).toBeNull();
  });
});
