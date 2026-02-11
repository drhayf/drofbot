import { describe, it, expect } from "vitest";
import {
  TIMING,
  EASING,
  gaugeTransition,
  staggerDelay,
  transitionClasses,
} from "../../utils/animations";

describe("Animation utilities", () => {
  it("exports timing constants", () => {
    expect(TIMING.fast).toBe(150);
    expect(TIMING.normal).toBe(200);
    expect(TIMING.gauge).toBe(400);
    expect(TIMING.stagger).toBe(50);
    expect(TIMING.toastDismiss).toBe(3000);
    expect(TIMING.pageFade).toBe(150);
  });

  it("exports easing curves", () => {
    expect(EASING.default).toContain("cubic-bezier");
    expect(EASING.easeOut).toContain("cubic-bezier");
    expect(EASING.easeIn).toContain("cubic-bezier");
  });

  it("generates gauge transition style", () => {
    const style = gaugeTransition();
    expect(style.transition).toContain(`${TIMING.gauge}ms`);
    expect(style.transition).toContain(EASING.easeOut);
  });

  it("generates gauge transition with custom property", () => {
    const style = gaugeTransition("width");
    expect(style.transition).toContain("width");
  });

  it("generates stagger delay for indexed items", () => {
    const style0 = staggerDelay(0);
    const style3 = staggerDelay(3);
    expect(style0.animationDelay).toBe("0ms");
    expect(style3.animationDelay).toBe("150ms");
  });

  it("supports base delay in stagger", () => {
    const style = staggerDelay(2, 100);
    expect(style.animationDelay).toBe("200ms");
  });

  it("exports transition class helpers", () => {
    expect(transitionClasses.cardHover).toContain("hover:border-accent/30");
    expect(transitionClasses.pageFade).toBe("animate-fade-in");
    expect(transitionClasses.toastEnter).toBe("animate-toast-in");
    expect(transitionClasses.toastExit).toBe("animate-toast-out");
  });
});
