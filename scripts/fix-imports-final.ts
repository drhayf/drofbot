#!/usr/bin/env node
/**
 * Final import fix pass: for each unresolvable import, find the actual target
 * file by name and compute the correct relative path.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, relative, dirname, resolve, basename } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

// Build index of ALL .ts files: baseName (without ext) → absolute paths
const fileIndex = new Map(); // name → [abs paths]

function indexFiles(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") {
      indexFiles(full);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      const base = entry.name.replace(/\.tsx?$/, "");
      if (!fileIndex.has(base)) fileIndex.set(base, []);
      fileIndex.get(base).push(full.replace(/\\/g, "/"));
    }
  }
}

indexFiles(SRC);
// Also index test/ and extensions/
indexFiles(join(ROOT, "test"));
indexFiles(join(ROOT, "extensions"));

function fileExists(basePath) {
  const normalized = basePath.replace(/\\/g, "/");
  return (
    existsSync(normalized + ".ts") ||
    existsSync(normalized + ".tsx") ||
    existsSync(join(normalized, "index.ts")) ||
    existsSync(join(normalized, "index.tsx"))
  );
}

function collectTsFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist") {
      results.push(...collectTsFiles(full));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

let totalFixed = 0;
let totalFiles = 0;
const stillBroken = [];

function findCorrectTarget(importPath, fromFile) {
  // Extract the target filename from the import path
  const cleaned = importPath.replace(/\.js$/, "");
  const targetBase = basename(cleaned);
  const targetDir = dirname(cleaned); // relative import dir component

  // Get the original import's intended target path components
  // e.g., "../shared/logging/subsystem" → look for "subsystem" in "logging/" dirs
  const pathParts = cleaned.split("/").filter((p) => p !== "." && p !== "..");

  // Try to find matching files
  const candidates = fileIndex.get(targetBase) || [];
  if (candidates.length === 0) return null;

  if (candidates.length === 1) {
    return candidates[0].replace(/\.tsx?$/, "");
  }

  // Multiple candidates — score them by path similarity
  const importPathParts = pathParts;
  let bestScore = -1;
  let bestCandidate = null;

  for (const cand of candidates) {
    const candRel = relative(ROOT, cand)
      .replace(/\\/g, "/")
      .replace(/\.tsx?$/, "");
    const candParts = candRel.split("/");

    // Count matching path components from the end
    let score = 0;
    for (let i = 1; i <= Math.min(importPathParts.length, candParts.length); i++) {
      if (importPathParts[importPathParts.length - i] === candParts[candParts.length - i]) {
        score += i; // Weight later matches higher
      }
    }

    // Bonus for being in the same area of the tree
    const fromRel = relative(ROOT, fromFile).replace(/\\/g, "/");
    const commonPrefix = getCommonPrefix(fromRel, candRel);
    score += commonPrefix.split("/").length;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = cand;
    }
  }

  return bestCandidate?.replace(/\.tsx?$/, "") || null;
}

function getCommonPrefix(a, b) {
  const aParts = a.split("/");
  const bParts = b.split("/");
  let common = [];
  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    if (aParts[i] === bParts[i]) common.push(aParts[i]);
    else break;
  }
  return common.join("/");
}

function fixFile(filePath) {
  let content = readFileSync(filePath, "utf-8");
  const importRegex = /(?:from\s+['"])([^'"]+)(?:['"])|(?:import\s*\(\s*['"])([^'"]+)(?:['"])/g;
  const replacements = [];

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2];
    if (!importPath.startsWith(".")) continue;

    const cleaned = importPath.replace(/\.js$/, "");
    const resolved = resolve(dirname(filePath), cleaned).replace(/\\/g, "/");
    if (fileExists(resolved)) continue;

    // Import is broken — find the correct target
    const correctTarget = findCorrectTarget(importPath, filePath);
    if (!correctTarget) {
      // Check for .json files
      const jsonPath = resolve(dirname(filePath), cleaned + ".json");
      if (existsSync(jsonPath)) continue;

      stillBroken.push(`${relative(ROOT, filePath).replace(/\\/g, "/")}: ${importPath}`);
      continue;
    }

    const ext = importPath.endsWith(".js") ? ".js" : "";
    let relPath = relative(dirname(filePath), correctTarget).replace(/\\/g, "/");
    if (!relPath.startsWith(".")) relPath = "./" + relPath;
    const newImport = relPath + ext;

    if (newImport !== importPath) {
      replacements.push({ old: importPath, new: newImport });
    }
  }

  if (replacements.length === 0) return false;

  for (const r of replacements) {
    content = content.replaceAll(`"${r.old}"`, `"${r.new}"`);
    content = content.replaceAll(`'${r.old}'`, `'${r.new}'`);
  }

  writeFileSync(filePath, content, "utf-8");
  totalFixed += replacements.length;
  totalFiles++;
  return true;
}

// Process ALL .ts files in src/ and extensions/
console.log("Scanning all TypeScript files...");
const allFiles = [...collectTsFiles(SRC), ...collectTsFiles(join(ROOT, "extensions"))];
console.log(`Found ${allFiles.length} files, checking for broken imports...`);

let processed = 0;
for (const file of allFiles) {
  const fixed = fixFile(file);
  processed++;
  if (fixed) {
    console.log(`  Fixed: ${relative(ROOT, file).replace(/\\/g, "/")}`);
  }
  if (processed % 500 === 0) {
    console.log(`  Progress: ${processed}/${allFiles.length}`);
  }
}

console.log(`\n=== Done! Fixed ${totalFixed} imports across ${totalFiles} files. ===`);

if (stillBroken.length > 0) {
  const unique = [...new Set(stillBroken)];
  console.log(`\n${unique.length} still unresolved (may be test-only or generated):`);
  for (const w of unique.slice(0, 30)) {
    console.log(`  ${w}`);
  }
  if (unique.length > 30) {
    console.log(`  ... and ${unique.length - 30} more`);
  }
}
