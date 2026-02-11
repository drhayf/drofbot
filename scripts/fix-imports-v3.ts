#!/usr/bin/env node
/**
 * Fix remaining broken imports by forward-mapping old paths through the move map.
 *
 * For each broken import:
 * 1. Determine the ORIGINAL file path (before restructure)
 * 2. Resolve the import relative to the ORIGINAL file path → get old absolute target
 * 3. Look up old absolute target in the directory move map → get new target location
 * 4. Compute new relative import from CURRENT file to NEW target
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, relative, dirname, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");

// Map of NEW directory → OLD directory (relative to repo root, no trailing slash)
const DIR_MOVES = [
  { newDir: "src/brain/agent-runner", oldDir: "src/agents" },
  { newDir: "src/brain/memory", oldDir: "src/memory" },
  { newDir: "src/brain/cron", oldDir: "src/cron" },
  { newDir: "src/shared/config", oldDir: "src/config" },
  { newDir: "src/shared/sessions", oldDir: "src/sessions" },
  { newDir: "src/shared/routing", oldDir: "src/routing" },
  { newDir: "src/channels/telegram", oldDir: "src/telegram" },
  { newDir: "src/channels/discord", oldDir: "src/discord" },
  { newDir: "src/channels/slack", oldDir: "src/slack" },
  { newDir: "src/channels/signal", oldDir: "src/signal" },
  { newDir: "src/channels/imessage", oldDir: "src/imessage" },
  { newDir: "src/channels/web", oldDir: "src/web" },
  { newDir: "src/channels/shared/web-shared", oldDir: "src/channels/web" },
  { newDir: "src/channels/shared/allowlists", oldDir: "src/channels/allowlists" },
  { newDir: "src/channels/shared/plugins", oldDir: "src/channels/plugins" },
];

// Individual channels shared files: old was src/channels/NAME.ts, new is src/channels/shared/NAME.ts
const CHANNELS_SHARED_FILES = [
  "ack-reactions",
  "allowlist-match",
  "channel-config",
  "chat-type",
  "command-gating",
  "conversation-label",
  "dock",
  "location",
  "logging",
  "mention-gating",
  "registry",
  "reply-prefix",
  "sender-identity",
  "sender-label",
  "session",
  "targets",
  "typing",
];

// Build a mapping: oldAbsPath (no ext) → newAbsPath (no ext) for DIRECTORIES
// Given an old path like "src/config/foo/bar", returns "src/shared/config/foo/bar"
function mapOldToNew(oldPathFromRoot) {
  // Try individual channel shared files first
  for (const name of CHANNELS_SHARED_FILES) {
    const oldPrefix = `src/channels/${name}`;
    if (oldPathFromRoot === oldPrefix || oldPathFromRoot.startsWith(oldPrefix + "/")) {
      return "src/channels/shared" + oldPathFromRoot.slice("src/channels".length);
    }
  }

  // Sort by longest oldDir first for specificity
  const sorted = [...DIR_MOVES].sort((a, b) => b.oldDir.length - a.oldDir.length);
  for (const { newDir, oldDir } of sorted) {
    if (oldPathFromRoot === oldDir || oldPathFromRoot.startsWith(oldDir + "/")) {
      return newDir + oldPathFromRoot.slice(oldDir.length);
    }
  }
  return null; // Not in a moved directory
}

function fileExists(basePath) {
  return (
    existsSync(basePath + ".ts") ||
    existsSync(basePath + ".tsx") ||
    existsSync(join(basePath, "index.ts")) ||
    existsSync(join(basePath, "index.tsx"))
  );
}

function collectFiles(dir, cb) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      collectFiles(full, cb);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      cb(full);
    }
  }
}

let totalFixed = 0;
let totalFiles = 0;
const unresolvedImports = [];

function fixFileImports(filePath, oldFilePath) {
  let content = readFileSync(filePath, "utf-8");
  const importRegex = /(?:from\s+['"])([^'"]+)(?:['"])|(?:import\s*\(\s*['"])([^'"]+)(?:['"])/g;
  const replacements = [];

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2];
    if (!importPath.startsWith(".")) continue;

    // Check if import already resolves correctly
    const cleaned = importPath.replace(/\.js$/, "");
    const currentResolved = resolve(dirname(filePath), cleaned).replace(/\\/g, "/");
    if (fileExists(currentResolved)) continue;

    // Import doesn't resolve. Compute what it WOULD HAVE resolved to from old location.
    const oldResolved = resolve(dirname(oldFilePath), cleaned).replace(/\\/g, "/");
    const oldRelToRoot = relative(ROOT, oldResolved).replace(/\\/g, "/");

    // Check if the old target still exists (wasn't moved)
    if (fileExists(oldResolved)) {
      // Target didn't move, just recompute relative path from new file location
      const ext = importPath.endsWith(".js") ? ".js" : "";
      let relPath = relative(dirname(filePath), oldResolved).replace(/\\/g, "/");
      if (!relPath.startsWith(".")) relPath = "./" + relPath;
      replacements.push({ old: importPath, new: relPath + ext });
      continue;
    }

    // Target was also moved. Map old path to new.
    const newTargetRel = mapOldToNew(oldRelToRoot);
    if (newTargetRel) {
      const newTargetAbs = join(ROOT, newTargetRel).replace(/\\/g, "/");
      if (fileExists(newTargetAbs)) {
        const ext = importPath.endsWith(".js") ? ".js" : "";
        let relPath = relative(dirname(filePath), newTargetAbs).replace(/\\/g, "/");
        if (!relPath.startsWith(".")) relPath = "./" + relPath;
        replacements.push({ old: importPath, new: relPath + ext });
        continue;
      }
    }

    // Still can't resolve — record warning
    unresolvedImports.push(
      `  ${relative(ROOT, filePath).replace(/\\/g, "/")}: ${importPath} → old target: ${oldRelToRoot}`,
    );
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

// Process all files in moved directories
for (const { newDir, oldDir } of DIR_MOVES) {
  const newFull = join(ROOT, newDir);
  const oldFull = join(ROOT, oldDir);
  if (!existsSync(newFull)) continue;

  console.log(`Processing ${newDir} (was ${oldDir})...`);

  collectFiles(newFull, (file) => {
    const relInNew = relative(newFull, file).replace(/\\/g, "/");
    const oldFile = join(oldFull, relInNew).replace(/\\/g, "/");
    const fixed = fixFileImports(file, oldFile);
    if (fixed) {
      console.log(`  Fixed: ${relative(ROOT, file).replace(/\\/g, "/")}`);
    }
  });
}

// Also check channels/shared individual files
console.log(`\nProcessing channels/shared individual files...`);
for (const name of CHANNELS_SHARED_FILES) {
  for (const suffix of [".ts", ".test.ts"]) {
    const baseName = suffix === ".test.ts" ? `${name}.test` : name;
    const newFile = join(
      ROOT,
      "src/channels/shared",
      `${baseName}${suffix === ".test.ts" ? "" : ""}`,
    );
    const newFilePath = join(ROOT, "src/channels/shared", `${baseName}.ts`);
    const oldFilePath = join(ROOT, "src/channels", `${baseName}.ts`);
    if (!existsSync(newFilePath)) continue;
    const fixed = fixFileImports(newFilePath, oldFilePath);
    if (fixed) {
      console.log(`  Fixed: src/channels/shared/${baseName}.ts`);
    }
  }
}

console.log(`\n=== Done! Fixed ${totalFixed} imports across ${totalFiles} files. ===`);

if (unresolvedImports.length > 0) {
  const unique = [...new Set(unresolvedImports)];
  console.log(`\n${unique.length} still unresolved:`);
  for (const w of unique.slice(0, 50)) {
    console.log(w);
  }
  if (unique.length > 50) {
    console.log(`  ... and ${unique.length - 50} more`);
  }
}
