/**
 * Codebase Self-Knowledge
 *
 * Periodically scans Drofbot's own source and maintains a semantic
 * understanding of its own architecture in memory:
 *
 * - What capabilities exist (tools, channels, memory banks, council systems)
 * - What was recently changed (git log)
 * - Architecture summary
 * - Known limitations
 *
 * This enables Drofbot to accurately describe itself, propose improvements,
 * and understand its own capabilities when asked.
 */

// ─── Types ─────────────────────────────────────────────────────

export interface CodebaseSnapshot {
  /** High-level architecture summary */
  architecture: string;
  /** Known capabilities grouped by category */
  capabilities: CapabilityMap;
  /** Recent git changes (last N commits) */
  recentChanges: RecentChange[];
  /** Known limitations and gaps */
  limitations: string[];
  /** Timestamp of scan */
  scannedAt: Date;
}

export interface CapabilityMap {
  /** Registered council systems */
  councilSystems: string[];
  /** Available memory banks */
  memoryBanks: string[];
  /** Connected channels */
  channels: string[];
  /** Registered tools */
  tools: string[];
  /** Active extensions */
  extensions: string[];
  /** Brain subsystems */
  brainSystems: string[];
}

export interface RecentChange {
  hash: string;
  message: string;
  date: string;
  filesChanged: number;
}

// ─── Scanner Deps ──────────────────────────────────────────────

export interface CodebaseScanDeps {
  /** List files matching a glob pattern */
  glob: (pattern: string) => Promise<string[]>;
  /** Read file contents */
  readFile: (path: string) => Promise<string>;
  /** Run a command and return stdout */
  exec: (cmd: string) => Promise<string>;
  /** Store a snapshot in semantic memory */
  storeInMemory: (category: string, content: string) => Promise<void>;
}

// ─── Scanner ───────────────────────────────────────────────────

/**
 * Scan the codebase and produce a self-knowledge snapshot.
 * Designed to run as a low-frequency cron job (daily or on deploy).
 */
export async function scanCodebase(deps: CodebaseScanDeps): Promise<CodebaseSnapshot> {
  const [councilSystems, channels, extensions, recentChanges] = await Promise.all([
    discoverCouncilSystems(deps),
    discoverChannels(deps),
    discoverExtensions(deps),
    discoverRecentChanges(deps),
  ]);

  const capabilities: CapabilityMap = {
    councilSystems,
    memoryBanks: ["episodic", "semantic", "procedural", "relational"],
    channels,
    tools: [], // populated from tool registry at runtime
    extensions,
    brainSystems: [
      "council",
      "intelligence",
      "synthesis",
      "progression",
      "memory",
      "briefing",
      "identity",
    ],
  };

  const architecture = renderArchitecture(capabilities);
  const limitations = [
    "Astronomical calculations are approximate (no full ephemeris).",
    "Observer pattern detection requires 30+ days of data for accuracy.",
    "Token budget limits synthesis context to ~3200 chars.",
    "Cron briefings require at least one connected channel.",
  ];

  const snapshot: CodebaseSnapshot = {
    architecture,
    capabilities,
    recentChanges,
    limitations,
    scannedAt: new Date(),
  };

  // Persist to semantic memory
  await deps.storeInMemory("codebase_self_knowledge", renderSnapshot(snapshot));

  return snapshot;
}

// ─── Discovery Functions ───────────────────────────────────────

async function discoverCouncilSystems(deps: CodebaseScanDeps): Promise<string[]> {
  try {
    const files = await deps.glob("src/brain/council/systems/*.ts");
    return files
      .map((f) => {
        const match = f.match(/systems\/(.+)\.ts$/);
        return match ? match[1] : null;
      })
      .filter((s): s is string => s !== null && !s.endsWith(".test"));
  } catch {
    return [];
  }
}

async function discoverChannels(deps: CodebaseScanDeps): Promise<string[]> {
  try {
    const dirs = await deps.glob("extensions/*/package.json");
    const channelDirs: string[] = [];
    for (const d of dirs) {
      const match = d.match(/extensions\/([^/]+)\//);
      if (match) channelDirs.push(match[1]);
    }
    return channelDirs;
  } catch {
    return [];
  }
}

async function discoverExtensions(deps: CodebaseScanDeps): Promise<string[]> {
  try {
    const files = await deps.glob("extensions/*/package.json");
    const names: string[] = [];
    for (const f of files) {
      try {
        const content = await deps.readFile(f);
        const pkg = JSON.parse(content) as { name?: string };
        if (pkg.name) names.push(pkg.name);
      } catch {
        // skip unparseable
      }
    }
    return names;
  } catch {
    return [];
  }
}

async function discoverRecentChanges(deps: CodebaseScanDeps): Promise<RecentChange[]> {
  try {
    const log = await deps.exec('git log --oneline --format="%H|%s|%ci|%d" -10');
    return log
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => {
        const parts = line.split("|");
        return {
          hash: (parts[0] ?? "").slice(0, 8),
          message: parts[1] ?? "",
          date: parts[2] ?? "",
          filesChanged: 0, // would require extra git call
        };
      });
  } catch {
    return [];
  }
}

// ─── Rendering ─────────────────────────────────────────────────

function renderArchitecture(caps: CapabilityMap): string {
  const lines: string[] = [];
  lines.push("Drofbot Architecture:");
  lines.push(
    `- Council: ${caps.councilSystems.length} systems (${caps.councilSystems.join(", ")})`,
  );
  lines.push(`- Memory: ${caps.memoryBanks.join(", ")}`);
  lines.push(`- Brain: ${caps.brainSystems.join(", ")}`);
  lines.push(`- Channels: ${caps.channels.length} extensions`);
  lines.push(`- Extensions: ${caps.extensions.length} total`);
  return lines.join("\n");
}

export function renderSnapshot(snapshot: CodebaseSnapshot): string {
  const lines: string[] = [];
  lines.push(snapshot.architecture);
  lines.push("");

  if (snapshot.recentChanges.length > 0) {
    lines.push("Recent changes:");
    for (const c of snapshot.recentChanges.slice(0, 5)) {
      lines.push(`  ${c.hash} ${c.message}`);
    }
    lines.push("");
  }

  if (snapshot.limitations.length > 0) {
    lines.push("Known limitations:");
    for (const l of snapshot.limitations) {
      lines.push(`  - ${l}`);
    }
  }

  return lines.join("\n").trim();
}
