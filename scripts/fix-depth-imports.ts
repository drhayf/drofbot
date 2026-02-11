#!/usr/bin/env node
/**
 * Fix depth-relative imports for files that moved 1 level deeper.
 *
 * When dirs moved:
 *   src/agents/      → src/brain/agent-runner/    (+1 depth)
 *   src/config/      → src/shared/config/         (+1 depth)
 *   src/sessions/    → src/shared/sessions/       (+1 depth)
 *   src/routing/     → src/shared/routing/        (+1 depth)
 *   src/memory/      → src/brain/memory/          (+1 depth)
 *   src/cron/        → src/brain/cron/            (+1 depth)
 *   src/channels/*.ts → src/channels/shared/      (+1 depth)
 *   src/channels/allowlists/ → src/channels/shared/allowlists/  (+1)
 *   src/channels/plugins/    → src/channels/shared/plugins/     (+1)
 *   src/channels/web/        → src/channels/shared/web-shared/  (+1)
 *   src/telegram/    → src/channels/telegram/     (+1 depth)
 *   src/discord/     → src/channels/discord/      (+1 depth)
 *   src/slack/       → src/channels/slack/        (+1 depth)
 *   src/signal/      → src/channels/signal/       (+1 depth)
 *   src/imessage/    → src/channels/imessage/     (+1 depth)
 *   src/web/         → src/channels/web/          (+1 depth)
 *
 * Files inside moved directories have imports that point OUTSIDE the directory.
 * These imports need:
 *   1. One more ../ prepended (because file is now 1 level deeper)
 *   2. Path component updates for targets that ALSO moved
 *
 * The fix-imports.ts script already handled #2 (directory name changes),
 * but missed #1 (depth adjustment) for files in subdirectories of moved dirs.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative, dirname, resolve, posix } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

// Directories that moved (new location → old parent depth from src)
// These are directories whose files are now 1 level deeper than before.
// We need to check if imports from these files point outside and need adjustment.
const MOVED_DIRS = [
  { newPath: "src/brain/agent-runner", oldPath: "src/agents" },
  { newPath: "src/brain/memory", oldPath: "src/memory" },
  { newPath: "src/brain/cron", oldPath: "src/cron" },
  { newPath: "src/shared/config", oldPath: "src/config" },
  { newPath: "src/shared/sessions", oldPath: "src/sessions" },
  { newPath: "src/shared/routing", oldPath: "src/routing" },
  { newPath: "src/channels/shared", oldPath: "src/channels", filesOnly: true },
  { newPath: "src/channels/telegram", oldPath: "src/telegram" },
  { newPath: "src/channels/discord", oldPath: "src/discord" },
  { newPath: "src/channels/slack", oldPath: "src/slack" },
  { newPath: "src/channels/signal", oldPath: "src/signal" },
  { newPath: "src/channels/imessage", oldPath: "src/imessage" },
  { newPath: "src/channels/web", oldPath: "src/web" },
];

// These are the directory name mappings (what the fix-imports.ts already handled
// for top-level files but missed for deeper files)
const DIR_RENAMES = {
  agents: "brain/agent-runner",
  config: "shared/config",
  sessions: "shared/sessions",
  routing: "shared/routing",
  memory: "brain/memory",
  cron: "brain/cron",
  telegram: "channels/telegram",
  discord: "channels/discord",
  slack: "channels/slack",
  signal: "channels/signal",
  imessage: "channels/imessage",
  web: "channels/web",
};

function findTsFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...findTsFiles(full));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

// Get depth of a file relative to src/
function getDepthFromSrc(filePath) {
  const rel = relative(SRC, filePath);
  return rel.split(/[/\\]/).length - 1; // -1 because the filename itself doesn't count as depth
}

// For a file at the given path, resolve what an import path points to
function resolveImport(filePath, importPath) {
  const dir = dirname(filePath);
  // importPath is like "../foo/bar.js", resolve it relative to the file's directory
  const resolved = resolve(dir, importPath.replace(/\.js$/, ".ts"));
  return relative(ROOT, resolved).replace(/\\/g, "/");
}

// Check if an import path points outside the moved directory
function isExternalImport(filePath, importPath, movedDirNew) {
  if (!importPath.startsWith(".")) return false; // skip non-relative imports
  const resolved = resolve(dirname(filePath), importPath.replace(/\.js$/, ""));
  const relToMovedDir = relative(join(ROOT, movedDirNew), resolved);
  // If it starts with .., it's outside
  return relToMovedDir.startsWith("..");
}

// The main logic: for each file in a moved directory, check if its external imports
// have the correct depth. If the file moved from oldPath to newPath (1 level deeper),
// imports to things outside need one more ../
function fixFile(filePath, movedDir) {
  let content = readFileSync(filePath, "utf-8");
  let changed = false;

  // The file's relative position within the moved directory
  const relInNew = relative(join(ROOT, movedDir.newPath), filePath).replace(/\\/g, "/");

  // What was the file's old absolute position?
  const oldFilePath = join(ROOT, movedDir.oldPath, relInNew);

  // How many levels deeper is the new location vs old?
  const newDepth = movedDir.newPath.split("/").length;
  const oldDepth = movedDir.oldPath.split("/").length;
  const depthDiff = newDepth - oldDepth; // Should be 1

  if (depthDiff <= 0) return false;

  // Find all import/export from statements
  const importRegex = /(?:from\s+['"])([^'"]+)(?:['"])|(?:import\s*\(\s*['"])([^'"]+)(?:['"])/g;

  let match;
  const replacements = [];

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1] || match[2];
    if (!importPath.startsWith(".")) continue;

    // Check if this import points outside the moved directory
    if (!isExternalImport(filePath, importPath, movedDir.newPath)) continue;

    // This import goes outside our moved dir — does it need adjustment?
    // Calculate what it SHOULD resolve to:
    // From the old position, what did this import resolve to?
    const oldResolved = resolve(dirname(oldFilePath), importPath.replace(/\.js$/, ""));
    const oldResolvedRel = relative(ROOT, oldResolved).replace(/\\/g, "/");

    // Does the target still exist at oldResolvedRel? If so, the import just needs depth fix.
    // But maybe the target ALSO moved, and fix-imports already updated the path component.
    // We need to check if the current import resolves correctly.

    // Try to resolve the import from the NEW file position
    const newResolved = resolve(dirname(filePath), importPath.replace(/\.js$/, ""));
    const newResolvedRel = relative(ROOT, newResolved).replace(/\\/g, "/");

    // Check if the resolved file exists
    const tsPath = join(ROOT, newResolvedRel + ".ts");
    const tsxPath = join(ROOT, newResolvedRel + ".tsx");
    const indexPath = join(ROOT, newResolvedRel, "index.ts");

    if (existsSync(tsPath) || existsSync(tsxPath) || existsSync(indexPath)) {
      continue; // Import resolves correctly, no fix needed
    }

    // The import doesn't resolve. Try adding depthDiff more ../ and see if that helps.
    const extraDots = "../".repeat(depthDiff);
    let fixedPath;

    if (importPath.startsWith("../")) {
      fixedPath = extraDots + importPath.slice(3); // Replace first ../ with ../../
    } else if (importPath.startsWith("./")) {
      // This shouldn't need fixing for internal imports, but check
      fixedPath = extraDots + importPath.slice(2);
    } else {
      continue;
    }

    // Verify the fixed path resolves
    const fixedResolved = resolve(dirname(filePath), fixedPath.replace(/\.js$/, ""));
    const fixedResolvedRel = relative(ROOT, fixedResolved).replace(/\\/g, "/");
    const fixedTsPath = join(ROOT, fixedResolvedRel + ".ts");
    const fixedTsxPath = join(ROOT, fixedResolvedRel + ".tsx");
    const fixedIndexPath = join(ROOT, fixedResolvedRel, "index.ts");

    if (existsSync(fixedTsPath) || existsSync(fixedTsxPath) || existsSync(fixedIndexPath)) {
      replacements.push({ old: importPath, new: fixedPath });
    } else {
      // Maybe the target also moved AND the path component wasn't updated yet
      // Try mapping known directory renames in the fixed path
      let mappedPath = fixedPath;
      for (const [oldDir, newDir] of Object.entries(DIR_RENAMES)) {
        // Match patterns like ../oldDir/ or ../../oldDir/
        const regex = new RegExp(`((?:\\.\\./)+)${oldDir}/`);
        const m = mappedPath.match(regex);
        if (m) {
          mappedPath = mappedPath.replace(regex, `$1${newDir}/`);
          break;
        }
      }

      if (mappedPath !== fixedPath) {
        const mappedResolved = resolve(dirname(filePath), mappedPath.replace(/\.js$/, ""));
        const mappedResolvedRel = relative(ROOT, mappedResolved).replace(/\\/g, "/");
        const mappedTsPath = join(ROOT, mappedResolvedRel + ".ts");
        const mappedTsxPath = join(ROOT, mappedResolvedRel + ".tsx");
        const mappedIndexPath = join(ROOT, mappedResolvedRel, "index.ts");

        if (existsSync(mappedTsPath) || existsSync(mappedTsxPath) || existsSync(mappedIndexPath)) {
          replacements.push({ old: importPath, new: mappedPath });
        } else {
          console.log(
            `  WARNING: Cannot resolve import in ${relative(ROOT, filePath)}: ${importPath}`,
          );
          console.log(`    Tried: ${fixedPath} and ${mappedPath}`);
        }
      } else {
        console.log(
          `  WARNING: Cannot resolve import in ${relative(ROOT, filePath)}: ${importPath}`,
        );
        console.log(`    Tried: ${fixedPath}`);
      }
    }
  }

  if (replacements.length === 0) return false;

  for (const r of replacements) {
    content = content.replaceAll(`"${r.old}"`, `"${r.new}"`);
    content = content.replaceAll(`'${r.old}'`, `'${r.new}'`);
  }

  writeFileSync(filePath, content, "utf-8");
  return true;
}

// Main
let totalFixed = 0;
let totalFiles = 0;

for (const movedDir of MOVED_DIRS) {
  const fullNewPath = join(ROOT, movedDir.newPath);
  if (!existsSync(fullNewPath)) continue;

  const files = findTsFiles(fullNewPath);

  // For channels/shared, only process direct .ts files (not subdirs that are channel adapters)
  // Actually, we should process all files in the moved dir

  for (const file of files) {
    const didFix = fixFile(file, movedDir);
    if (didFix) {
      totalFiles++;
      console.log(`  Fixed: ${relative(ROOT, file)}`);
    }
  }
}

console.log(`\nDone! Fixed imports in ${totalFiles} files.`);
