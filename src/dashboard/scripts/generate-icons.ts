/**
 * Generate PNG icons from the master SVG.
 * Uses sharp for crisp rasterization at multiple sizes.
 *
 * Usage: npx tsx scripts/generate-icons.ts
 * Requires: npm i -D sharp
 */
import fs from "node:fs";
import path from "node:path";

const ICONS_DIR = path.resolve(import.meta.dirname, "../public/icons");
const SVG_PATH = path.join(ICONS_DIR, "icon.svg");

/**
 * Create a complete SVG string for the D monogram at any size.
 * Matches the master icon.svg design: deep sage background with
 * radial gradient, subtle orbital arcs, warm paper D letterform.
 */
function createIconSvg(size: number, opts?: { maskable?: boolean }): string {
  const padding = opts?.maskable ? Math.round(size * 0.1) : 0;
  const innerSize = size - padding * 2;
  const fontSize = Math.round(innerSize * 0.585);
  const cx = size / 2;
  const cy = size / 2 + Math.round(fontSize * 0.06);
  const rx = Math.round(size * 0.1875); // ~96/512 ratio

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="65%"><stop offset="0%" stop-color="#345f50"/><stop offset="100%" stop-color="#1e3a30"/></radialGradient>
    <radialGradient id="v" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="0.25"/></radialGradient>
    <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f8f6f1"/><stop offset="100%" stop-color="#e8e4db"/></linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#v)"/>
  <circle cx="${cx}" cy="${cx}" r="${Math.round(size * 0.39)}" fill="none" stroke="#f8f6f1" stroke-opacity="0.09" stroke-width="0.8" />
  <circle cx="${cx}" cy="${cx}" r="${Math.round(size * 0.31)}" fill="none" stroke="#f8f6f1" stroke-opacity="0.06" stroke-width="0.6" />
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="Georgia, serif" font-weight="400" font-size="${fontSize}" fill="url(#lg)" letter-spacing="${Math.round(-fontSize * 0.02)}" opacity="0.95">D</text>
</svg>`;
}

interface IconSpec {
  name: string;
  size: number;
  maskable?: boolean;
}

const ICONS: IconSpec[] = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable.png", size: 512, maskable: true },
  { name: "apple-touch-icon.png", size: 180 },
];

async function main() {
  let sharp: typeof import("sharp") | undefined;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    // sharp not available — write SVGs as fallback
    console.log("sharp not available; writing SVG placeholders instead of PNGs");
    for (const icon of ICONS) {
      const svg = createIconSvg(icon.size, { maskable: icon.maskable });
      const svgName = icon.name.replace(".png", ".svg");
      fs.writeFileSync(path.join(ICONS_DIR, svgName), svg);
      console.log(`  wrote ${svgName} (${icon.size}×${icon.size})`);
    }
    return;
  }

  for (const icon of ICONS) {
    const svg = Buffer.from(createIconSvg(icon.size, { maskable: icon.maskable }));
    const png = await sharp(svg).png().toBuffer();
    fs.writeFileSync(path.join(ICONS_DIR, icon.name), png);
    console.log(`  wrote ${icon.name} (${icon.size}×${icon.size})`);
  }

  // Also write the favicon SVG (compact version)
  const faviconSvg = createIconSvg(32);
  fs.writeFileSync(path.join(ICONS_DIR, "favicon.svg"), faviconSvg);
  console.log("  wrote favicon.svg");

  console.log("\nDone — all icons generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
