import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const CSS_PATH = path.resolve(__dirname, "../../index.css");

describe("Dark theme CSS", () => {
  it("defines dark theme CSS variables", () => {
    const css = fs.readFileSync(CSS_PATH, "utf-8");
    expect(css).toContain('[data-theme="dark"]');
    // Dark theme should swap ground colors to dark values
    expect(css).toContain("--ground-1: #1a1816");
    expect(css).toContain("--ink-1: #f0ede6");
    expect(css).toContain("--surface-raised: #252320");
  });

  it("defines focus-visible styles for keyboard accessibility", () => {
    const css = fs.readFileSync(CSS_PATH, "utf-8");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline");
    expect(css).toContain("var(--accent)");
  });

  it("defines toast animations", () => {
    const css = fs.readFileSync(CSS_PATH, "utf-8");
    expect(css).toContain("@keyframes toast-in");
    expect(css).toContain("@keyframes toast-out");
    expect(css).toContain(".animate-toast-in");
    expect(css).toContain(".animate-toast-out");
  });

  it("prevents iOS zoom on input focus for mobile", () => {
    const css = fs.readFileSync(CSS_PATH, "utf-8");
    expect(css).toContain("font-size: 16px");
    expect(css).toContain("max-width: 639px");
  });
});
