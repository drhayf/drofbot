#!/usr/bin/env node
/**
 * Fix ALL broken imports in moved files by:
 * 1. For each file in a moved directory, check every import
 * 2. If the import doesn't resolve from the current location,
 *    compute what it was from the ORIGINAL location (before the move)
 * 3. Figure out where that target is NOW, then compute new relative path
 *
 * This handles:
 * - Peer imports incorrectly rewritten (src/web/ files)
 * - Depth adjustment (files moved 1 level deeper)
 * - Target directory renames (config → shared/config, etc.)
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative, dirname, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

// Map of new location → old location (relative to repo root)
const MOVED_DIRS = [
  { newPath: "src/brain/agent-runner", oldPath: "src/agents" },
  { newPath: "src/brain/memory", oldPath: "src/memory" },
  { newPath: "src/brain/cron", oldPath: "src/cron" },
  { newPath: "src/shared/config", oldPath: "src/config" },
  { newPath: "src/shared/sessions", oldPath: "src/sessions" },
  { newPath: "src/shared/routing", oldPath: "src/routing" },
  { newPath: "src/channels/telegram", oldPath: "src/telegram" },
  { newPath: "src/channels/discord", oldPath: "src/discord" },
  { newPath: "src/channels/slack", oldPath: "src/slack" },
  { newPath: "src/channels/signal", oldPath: "src/signal" },
  { newPath: "src/channels/imessage", oldPath: "src/imessage" },
  { newPath: "src/channels/web", oldPath: "src/web" },
  { newPath: "src/channels/shared/web-shared", oldPath: "src/channels/web" },
  { newPath: "src/channels/shared/allowlists", oldPath: "src/channels/allowlists" },
  { newPath: "src/channels/shared/plugins", oldPath: "src/channels/plugins" },
  // For channels shared .ts files (moved from src/channels/*.ts to src/channels/shared/*.ts)
  // This is trickier - individual files, not a directory
];

// Individual file moves (channels shared files)
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
  // test files
  "ack-reactions.test",
  "channel-config.test",
  "chat-type.test",
  "command-gating.test",
  "conversation-label.test",
  "location.test",
  "mention-gating.test",
  "registry.test",
  "sender-identity.test",
  "targets.test",
  "typing.test",
];

// Build old→new path mapping for files
function buildFileMoveMap() {
  const map = new Map(); // old abs path (without ext) → new abs path (without ext)

  for (const { newPath, oldPath } of MOVED_DIRS) {
    const newFull = join(ROOT, newPath);
    if (!existsSync(newFull)) continue;
    collectFiles(newFull, (file) => {
      const relInNew = relative(newFull, file).replace(/\\/g, "/");
      const oldFile = join(ROOT, oldPath, relInNew);
      const key = file.replace(/\.tsx?$/, "");
      const oldKey = oldFile.replace(/\.tsx?$/, "");
      map.set(oldKey.replace(/\\/g, "/"), key.replace(/\\/g, "/"));
    });
  }

  // Add channels shared individual file moves
  for (const name of CHANNELS_SHARED_FILES) {
    const ext = name.endsWith(".test") ? ".test.ts" : ".ts";
    const baseName = name.replace(".test", "");
    const oldPath = join(ROOT, "src/channels", `${name}.ts`).replace(/\\/g, "/");
    const newPath = join(ROOT, "src/channels/shared", `${name}.ts`).replace(/\\/g, "/");
    map.set(oldPath.replace(/\.ts$/, ""), newPath.replace(/\.ts$/, ""));
  }

  return map;
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

function fileExists(basePath) {
  return (
    existsSync(basePath + ".ts") ||
    existsSync(basePath + ".tsx") ||
    existsSync(join(basePath, "index.ts")) ||
    existsSync(join(basePath, "index.tsx"))
  );
}

function resolveImportAbs(fromFile, importPath) {
  const cleaned = importPath.replace(/\.js$/, "");
  return resolve(dirname(fromFile), cleaned).replace(/\\/g, "/");
}

let totalFixed = 0;
let totalFiles = 0;
const warnings = [];

function fixFileImports(filePath, fileOldPath) {
  let content = readFileSync(filePath, "utf-8");
  const importRegex = /(?:from\s+['"])([^'"]+)(?:['"])|(?:import\s*\(\s*['"])([^'"]+)(?:['"])/g;
  const replacements = [];

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2];
    if (!importPath.startsWith(".")) continue; // skip non-relative

    // Check if import resolves from current location
    const currentTarget = resolveImportAbs(filePath, importPath);
    if (fileExists(currentTarget)) continue; // Already correct

    // Import doesn't resolve. Try from ORIGINAL location.
    const originalTarget = resolveImportAbs(fileOldPath, importPath);

    // But wait — the fix-imports script may have already changed the directory component
    // of the import. So we also need to try the ORIGINAL ORIGINAL import
    // (before fix-imports changed it).
    // We'll try multiple approaches:

    let newImportPath = null;

    // Approach 1: The import path was correct from old location, target didn't move
    if (fileExists(originalTarget)) {
      // Target exists at old location (not moved). Compute relative from new location.
      const ext = importPath.endsWith(".js") ? ".js" : "";
      const relative_ = relative(dirname(filePath), originalTarget).replace(/\\/g, "/");
      newImportPath = (relative_.startsWith(".") ? relative_ : "./" + relative_) + ext;
    }

    // Approach 2: The import path was modified by fix-imports (dir component changed),
    // but the original raw import from old location would work differently.
    // Try to "undo" known directory renames and resolve from old location.
    if (!newImportPath) {
      const undoMappings = [
        ["brain/agent-runner/", "agents/"],
        ["shared/config/", "config/"],
        ["shared/sessions/", "sessions/"],
        ["shared/routing/", "routing/"],
        ["brain/memory/", "memory/"],
        ["brain/cron/", "cron/"],
        ["channels/telegram/", "telegram/"],
        ["channels/discord/", "discord/"],
        ["channels/slack/", "slack/"],
        ["channels/signal/", "signal/"],
        ["channels/imessage/", "imessage/"],
        ["channels/web/", "web/"],
        ["channels/shared/web-shared/", "channels/web/"],
        ["channels/shared/allowlists/", "channels/allowlists/"],
        ["channels/shared/plugins/", "channels/plugins/"],
        ["channels/shared/", "channels/"],
      ];

      for (const [newDir, oldDir] of undoMappings) {
        if (importPath.includes(newDir)) {
          const undone = importPath.replace(newDir, oldDir);
          const undoneTarget = resolveImportAbs(fileOldPath, undone);
          if (fileExists(undoneTarget)) {
            // Found the original target. Now where is it NOW?
            const undoneTargetNorm = undoneTarget.replace(/\\/g, "/");
            // Look up in our move map
            const nowTarget = fileMoveMap.get(undoneTargetNorm);
            if (nowTarget && fileExists(nowTarget)) {
              const ext = importPath.endsWith(".js") ? ".js" : "";
              const relative_ = relative(dirname(filePath), nowTarget).replace(/\\/g, "/");
              newImportPath = (relative_.startsWith(".") ? relative_ : "./" + relative_) + ext;
            } else if (fileExists(undoneTarget)) {
              // Target didn't move, compute from new file location
              const ext = importPath.endsWith(".js") ? ".js" : "";
              const relative_ = relative(dirname(filePath), undoneTarget).replace(/\\/g, "/");
              newImportPath = (relative_.startsWith(".") ? relative_ : "./" + relative_) + ext;
            }
            break;
          }
        }
      }
    }

    // Approach 3: Try the raw original import (before fix-imports changed it)
    // by computing what the original file had from its old location
    if (!newImportPath) {
      // The import was from old file location. The fix-imports may have changed it.
      // Let's try the ORIGINAL import: resolve from old location, strip any mapping.
      // We already tried this in approach 1. Let's try without the mapped path.

      // Try undoing ALL possible transformations
      const undoAllMappings = [
        ["shared/web-shared/", ""], // These were peer imports in channels/web/
        ["brain/agent-runner/", "agents/"],
        ["shared/config/", "config/"],
        ["shared/sessions/", "sessions/"],
        ["shared/routing/", "routing/"],
        ["brain/memory/", "memory/"],
        ["brain/cron/", "cron/"],
        ["channels/telegram/", "telegram/"],
        ["channels/discord/", "discord/"],
        ["channels/slack/", "slack/"],
        ["channels/signal/", "signal/"],
        ["channels/imessage/", "imessage/"],
        ["channels/web/", "web/"],
        ["channels/shared/", "channels/"],
      ];

      for (const [mappedDir, origDir] of undoAllMappings) {
        if (!importPath.includes(mappedDir)) continue;
        let undone;
        if (origDir === "") {
          // For peer imports that were wrongly prefixed
          // e.g., "../shared/web-shared/session.js" → "./session.js"
          undone = importPath.replace(/\.\.\/shared\/web-shared\//, "./");
        } else {
          undone = importPath.replace(mappedDir, origDir);
        }
        const undoneTarget = resolveImportAbs(fileOldPath, undone);
        if (fileExists(undoneTarget)) {
          // Original target found! Now where is it?
          const undoneTargetNorm = undoneTarget.replace(/\\/g, "/");
          const nowTarget = fileMoveMap.get(undoneTargetNorm);
          const actualTarget = nowTarget || undoneTargetNorm;
          if (fileExists(actualTarget)) {
            const ext = importPath.endsWith(".js") ? ".js" : "";
            const relative_ = relative(dirname(filePath), actualTarget).replace(/\\/g, "/");
            newImportPath = (relative_.startsWith(".") ? relative_ : "./" + relative_) + ext;
          }
          break;
        }
      }
    }

    if (newImportPath && newImportPath !== importPath) {
      replacements.push({ old: importPath, new: newImportPath });
    } else if (!newImportPath) {
      warnings.push(`  ${relative(ROOT, filePath)}: ${importPath}`);
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

// Build the move map
const fileMoveMap = buildFileMoveMap();
console.log(`Built file move map with ${fileMoveMap.size} entries.`);

// Process all files in moved directories
for (const { newPath, oldPath } of MOVED_DIRS) {
  const newFull = join(ROOT, newPath);
  const oldFull = join(ROOT, oldPath);
  if (!existsSync(newFull)) continue;

  console.log(`\nProcessing ${newPath} (was ${oldPath})...`);

  collectFiles(newFull, (file) => {
    const relInNew = relative(newFull, file).replace(/\\/g, "/");
    const oldFile = join(oldFull, relInNew);
    const fixed = fixFileImports(file, oldFile);
    if (fixed) {
      console.log(`  Fixed: ${relative(ROOT, file)}`);
    }
  });
}

// Also check channels/shared individual files
console.log(`\nProcessing channels/shared individual files...`);
for (const name of CHANNELS_SHARED_FILES) {
  const newFile = join(ROOT, "src/channels/shared", `${name}.ts`);
  const oldFile = join(ROOT, "src/channels", `${name}.ts`);
  if (!existsSync(newFile)) continue;
  const fixed = fixFileImports(newFile, oldFile);
  if (fixed) {
    console.log(`  Fixed: src/channels/shared/${name}.ts`);
  }
}

console.log(`\nDone! Fixed ${totalFixed} imports across ${totalFiles} files.`);

if (warnings.length > 0) {
  // Deduplicate
  const unique = [...new Set(warnings)];
  console.log(`\n${unique.length} unresolved imports (may be test helpers or non-critical):`);
  for (const w of unique.slice(0, 30)) {
    console.log(w);
  }
  if (unique.length > 30) {
    console.log(`  ... and ${unique.length - 30} more`);
  }
}
