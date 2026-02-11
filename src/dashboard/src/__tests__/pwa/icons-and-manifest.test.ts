import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const ICONS_DIR = path.resolve(__dirname, "../../../public/icons");

describe("PWA icon assets", () => {
  it("has the master SVG icon", () => {
    expect(fs.existsSync(path.join(ICONS_DIR, "icon.svg"))).toBe(true);
  });

  it("master SVG contains the D monogram", () => {
    const svg = fs.readFileSync(path.join(ICONS_DIR, "icon.svg"), "utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain(">D</text>");
    // Design identity: deep sage background with warm paper letterform
    expect(svg).toContain("#1e3a30");
    expect(svg).toContain("#f8f6f1");
    // Rounded corners for iOS home screen
    expect(svg).toContain('rx="96"');
  });

  it("SVG has correct viewBox of 512x512", () => {
    const svg = fs.readFileSync(path.join(ICONS_DIR, "icon.svg"), "utf-8");
    expect(svg).toContain('viewBox="0 0 512 512"');
  });
});

describe("PWA HTML meta tags", () => {
  it("index.html has required Apple PWA meta tags", () => {
    const html = fs.readFileSync(path.resolve(__dirname, "../../../index.html"), "utf-8");
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="default"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="Drofbot"');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain("viewport-fit=cover");
  });

  it("index.html has theme-color meta tag", () => {
    const html = fs.readFileSync(path.resolve(__dirname, "../../../index.html"), "utf-8");
    expect(html).toContain('name="theme-color" content="#f8f6f1"');
  });
});

describe("PWA manifest configuration", () => {
  it("vite config has correct manifest fields", () => {
    const config = fs.readFileSync(path.resolve(__dirname, "../../../vite.config.ts"), "utf-8");
    expect(config).toContain('"Drofbot"');
    expect(config).toContain('"standalone"');
    expect(config).toContain('"#f8f6f1"');
    expect(config).toContain("icon-192.png");
    expect(config).toContain("icon-512.png");
    expect(config).toContain("icon-maskable.png");
    expect(config).toContain('"maskable"');
  });
});
