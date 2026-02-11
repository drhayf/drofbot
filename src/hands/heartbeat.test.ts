import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { HandsHeartbeat, type HeartbeatPayload } from "./heartbeat.js";

describe("HandsHeartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts and stops cleanly", () => {
    const hb = new HandsHeartbeat({
      getActiveTaskCount: () => 0,
      onHeartbeat: () => {},
    });

    expect(hb.isRunning()).toBe(false);
    hb.start();
    expect(hb.isRunning()).toBe(true);
    hb.stop();
    expect(hb.isRunning()).toBe(false);
  });

  it("does not fire immediately on start", () => {
    const onHeartbeat = vi.fn();
    const hb = new HandsHeartbeat({
      getActiveTaskCount: () => 0,
      onHeartbeat,
    });

    hb.start();
    expect(onHeartbeat).not.toHaveBeenCalled();
    hb.stop();
  });

  it("fires after one interval", () => {
    const onHeartbeat = vi.fn();
    const hb = new HandsHeartbeat({
      intervalSec: 5,
      getActiveTaskCount: () => 0,
      onHeartbeat,
    });

    hb.start();
    vi.advanceTimersByTime(5_000);
    expect(onHeartbeat).toHaveBeenCalledTimes(1);
    hb.stop();
  });

  it("fires multiple times", () => {
    const onHeartbeat = vi.fn();
    const hb = new HandsHeartbeat({
      intervalSec: 2,
      getActiveTaskCount: () => 0,
      onHeartbeat,
    });

    hb.start();
    vi.advanceTimersByTime(6_000);
    expect(onHeartbeat).toHaveBeenCalledTimes(3);
    hb.stop();
  });

  it("stops firing after stop()", () => {
    const onHeartbeat = vi.fn();
    const hb = new HandsHeartbeat({
      intervalSec: 1,
      getActiveTaskCount: () => 0,
      onHeartbeat,
    });

    hb.start();
    vi.advanceTimersByTime(2_000);
    expect(onHeartbeat).toHaveBeenCalledTimes(2);

    hb.stop();
    vi.advanceTimersByTime(5_000);
    expect(onHeartbeat).toHaveBeenCalledTimes(2); // No more calls
  });

  it("reports active task count", () => {
    let taskCount = 3;
    const payloads: HeartbeatPayload[] = [];
    const hb = new HandsHeartbeat({
      intervalSec: 1,
      getActiveTaskCount: () => taskCount,
      onHeartbeat: (p) => payloads.push(p),
    });

    hb.start();
    vi.advanceTimersByTime(1_000);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].activeTasks).toBe(3);

    taskCount = 0;
    vi.advanceTimersByTime(1_000);
    expect(payloads).toHaveLength(2);
    expect(payloads[1].activeTasks).toBe(0);

    hb.stop();
  });

  it("reports increasing uptime", () => {
    const payloads: HeartbeatPayload[] = [];
    const hb = new HandsHeartbeat({
      intervalSec: 5,
      getActiveTaskCount: () => 0,
      onHeartbeat: (p) => payloads.push(p),
    });

    hb.start();
    vi.advanceTimersByTime(5_000);
    vi.advanceTimersByTime(5_000);
    expect(payloads).toHaveLength(2);
    expect(payloads[1].uptime).toBeGreaterThan(payloads[0].uptime);

    hb.stop();
  });

  it("buildPayload returns memory info", () => {
    const hb = new HandsHeartbeat({
      getActiveTaskCount: () => 1,
      onHeartbeat: () => {},
    });

    hb.start();
    const payload = hb.buildPayload();
    expect(payload.memory).toBeDefined();
    expect(payload.memory!.free).toBeGreaterThan(0);
    expect(payload.memory!.total).toBeGreaterThan(0);
    expect(payload.activeTasks).toBe(1);
    hb.stop();
  });

  it("start is idempotent", () => {
    const onHeartbeat = vi.fn();
    const hb = new HandsHeartbeat({
      intervalSec: 1,
      getActiveTaskCount: () => 0,
      onHeartbeat,
    });

    hb.start();
    hb.start(); // Should not create a second timer
    vi.advanceTimersByTime(1_000);
    expect(onHeartbeat).toHaveBeenCalledTimes(1); // Not 2
    hb.stop();
  });

  it("stop is idempotent", () => {
    const hb = new HandsHeartbeat({
      getActiveTaskCount: () => 0,
      onHeartbeat: () => {},
    });

    hb.start();
    hb.stop();
    hb.stop(); // Should not throw
    expect(hb.isRunning()).toBe(false);
  });

  it("survives onHeartbeat errors", () => {
    let calls = 0;
    const hb = new HandsHeartbeat({
      intervalSec: 1,
      getActiveTaskCount: () => 0,
      onHeartbeat: () => {
        calls++;
        if (calls === 1) {
          throw new Error("boom");
        }
      },
    });

    hb.start();
    vi.advanceTimersByTime(1_000); // First call throws
    vi.advanceTimersByTime(1_000); // Second call should still fire
    expect(calls).toBe(2);
    hb.stop();
  });

  it("uses default 30s interval", () => {
    const onHeartbeat = vi.fn();
    const hb = new HandsHeartbeat({
      getActiveTaskCount: () => 0,
      onHeartbeat,
    });

    hb.start();
    vi.advanceTimersByTime(29_000);
    expect(onHeartbeat).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onHeartbeat).toHaveBeenCalledTimes(1);
    hb.stop();
  });
});
