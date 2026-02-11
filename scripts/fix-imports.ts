#!/usr/bin/env node
/**
 * Drofbot Phase 1 — Import Path Fixer
 *
 * After moving directories, this script fixes all TypeScript import paths.
 * It takes a mapping of old directory prefixes → new directory prefixes
 * and rewrites all import/export statements in .ts files accordingly.
 *
 * Usage: node --import tsx scripts/fix-imports.ts
 */

import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");

// Map of old dir path (relative to src/) → new dir path (relative to src/)
// These represent the directory RENAMES that have already been performed on disk.
// ORDER MATTERS: more specific prefixes must come before less specific ones.
const DIR_MOVES: Array<[string, string]> = [
  // agents subdirs first (more specific)
  ["agents/pi-embedded-runner/", "brain/agent-runner/pi-embedded-runner/"],
  ["agents/pi-embedded-helpers/", "brain/agent-runner/pi-embedded-helpers/"],
  ["agents/pi-extensions/", "brain/agent-runner/pi-extensions/"],
  ["agents/auth-profiles/", "brain/agent-runner/auth-profiles/"],
  ["agents/cli-runner/", "brain/agent-runner/cli-runner/"],
  ["agents/sandbox/", "brain/agent-runner/sandbox/"],
  ["agents/schema/", "brain/agent-runner/schema/"],
  ["agents/skills/", "brain/agent-runner/skills/"],
  ["agents/tools/", "brain/agent-runner/tools/"],
  ["agents/test-helpers/", "brain/agent-runner/test-helpers/"],
  // agents root files
  ["agents/", "brain/agent-runner/"],
  // memory → brain/memory
  ["memory/", "brain/memory/"],
  // cron subdirs
  ["cron/service/", "brain/cron/service/"],
  ["cron/isolated-agent/", "brain/cron/isolated-agent/"],
  ["cron/", "brain/cron/"],
  // channel adapters
  ["telegram/", "channels/telegram/"],
  ["discord/", "channels/discord/"],
  ["slack/", "channels/slack/"],
  ["signal/", "channels/signal/"],
  ["imessage/", "channels/imessage/"],
  ["web/", "channels/web/"],
  // channels shared (old channels/ root files moved to channels/shared/)
  ["channels/allowlists/", "channels/shared/allowlists/"],
  ["channels/plugins/", "channels/shared/plugins/"],
  ["channels/web/", "channels/shared/web-shared/"],
  ["channels/ack-reactions", "channels/shared/ack-reactions"],
  ["channels/allowlist-match", "channels/shared/allowlist-match"],
  ["channels/channel-config", "channels/shared/channel-config"],
  ["channels/chat-type", "channels/shared/chat-type"],
  ["channels/command-gating", "channels/shared/command-gating"],
  ["channels/conversation-label", "channels/shared/conversation-label"],
  ["channels/dock", "channels/shared/dock"],
  ["channels/location", "channels/shared/location"],
  ["channels/logging", "channels/shared/logging"],
  ["channels/mention-gating", "channels/shared/mention-gating"],
  ["channels/registry", "channels/shared/registry"],
  ["channels/reply-prefix", "channels/shared/reply-prefix"],
  ["channels/sender-identity", "channels/shared/sender-identity"],
  ["channels/sender-label", "channels/shared/sender-label"],
  ["channels/session", "channels/shared/session"],
  ["channels/targets", "channels/shared/targets"],
  ["channels/typing", "channels/shared/typing"],
  // config → shared/config
  ["config/", "shared/config/"],
  // sessions → shared/sessions
  ["sessions/", "shared/sessions/"],
  // routing → shared/routing
  ["routing/", "shared/routing/"],
];

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "vendor")
        continue;
      results.push(...getAllTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".mts")) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Given a file's absolute path and a relative import string,
 * resolve the absolute path of the imported module.
 */
function resolveImportTarget(filePath: string, importPath: string): string {
  const dir = path.dirname(filePath);
  // Strip .js extension that TS uses
  let resolved = path.resolve(dir, importPath);
  if (resolved.endsWith(".js")) {
    resolved = resolved.slice(0, -3) + ".ts";
  }
  return resolved;
}

/**
 * Given the source file's abs path and the target's abs path,
 * produce a relative import string.
 */
function makeRelativeImport(fromFile: string, toFile: string): string {
  let rel = path.relative(path.dirname(fromFile), toFile);
  // Ensure forward slashes
  rel = rel.replace(/\\/g, "/");
  // Ensure starts with ./ or ../
  if (!rel.startsWith(".")) {
    rel = "./" + rel;
  }
  // Replace .ts with .js
  if (rel.endsWith(".ts")) {
    rel = rel.slice(0, -3) + ".js";
  }
  return rel;
}

/**
 * Check if an absolute file path fell under any of the OLD directories.
 * If so, return the NEW absolute path.
 */
function getNewPath(absPath: string): string | null {
  const relToSrc = path.relative(SRC, absPath).replace(/\\/g, "/");
  for (const [oldPrefix, newPrefix] of DIR_MOVES) {
    if (relToSrc.startsWith(oldPrefix)) {
      const rest = relToSrc.slice(oldPrefix.length);
      return path.join(SRC, newPrefix, rest);
    }
  }
  return null;
}

/**
 * Fix imports in a single file.
 * Returns the number of imports fixed.
 */
function fixImportsInFile(filePath: string): number {
  let content = fs.readFileSync(filePath, "utf8");
  let fixCount = 0;

  // Match import/export from statements with relative paths
  // Covers: from '...' , from "..." , import('...') , import("...")
  const importRegex = /(from\s+['"])(\.\.?\/[^'"]+)(['"])/g;
  const dynamicRegex = /(import\s*\(\s*['"])(\.\.?\/[^'"]+)(['"]\s*\))/g;

  function fixMatch(match: string, prefix: string, importPath: string, suffix: string): string {
    if (!importPath || !importPath.startsWith(".")) return match;

    // Resolve what this import points to
    const targetAbs = resolveImportTarget(filePath, importPath);
    const relToSrc = path.relative(SRC, targetAbs).replace(/\\/g, "/");

    // Check if the target has moved
    let newTargetAbs: string | null = null;

    // Try with .ts extension
    newTargetAbs = getNewPath(targetAbs);
    if (!newTargetAbs) {
      // Try the path as-is (might be a directory import)
      const asDir = targetAbs + "/";
      const dirCheck = getNewPath(targetAbs + "/index.ts");
      if (dirCheck) {
        newTargetAbs = dirCheck;
      }
    }

    if (!newTargetAbs) return match; // Target hasn't moved

    // Calculate new relative import from THIS file's location to the NEW target location
    const newImport = makeRelativeImport(filePath, newTargetAbs);

    if (newImport !== importPath) {
      fixCount++;
      return `${prefix}${newImport}${suffix}`;
    }
    return match;
  }

  let newContent = content.replace(importRegex, fixMatch);
  newContent = newContent.replace(dynamicRegex, fixMatch);

  if (fixCount > 0) {
    fs.writeFileSync(filePath, newContent, "utf8");
  }

  return fixCount;
}

// Also need to check if THIS file has moved
function getActualFilePath(filePath: string): string {
  // The file is already at its new location on disk
  return filePath;
}

console.log("Scanning for TypeScript files...");
const allFiles = [
  ...getAllTsFiles(SRC),
  ...getAllTsFiles(path.resolve("test")),
  ...getAllTsFiles(path.resolve("extensions")),
];
console.log(`Found ${allFiles.length} TypeScript files`);

let totalFixes = 0;
let filesFixed = 0;

for (const file of allFiles) {
  const fixes = fixImportsInFile(file);
  if (fixes > 0) {
    totalFixes += fixes;
    filesFixed++;
    if (filesFixed % 50 === 0) {
      console.log(`  Progress: ${filesFixed} files, ${totalFixes} imports fixed...`);
    }
  }
}

console.log(`\nDone! Fixed ${totalFixes} imports across ${filesFixed} files.`);
