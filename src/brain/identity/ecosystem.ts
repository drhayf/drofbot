/**
 * Ecosystem Monitor
 *
 * Tracks the upstream OpenClaw repository:
 * - New commits since last check
 * - New features/capabilities
 * - Release notes
 * - Community discussions (MoltBook)
 *
 * Compares against Drofbot's capabilities and generates:
 * - Differential: "OpenClaw added X. We already have Y which is superior because Z."
 * - Opportunities: "OpenClaw's approach to W is interesting. Here's how we could adapt it."
 * - Self-improvement proposals stored in procedural memory
 */

// ─── Types ─────────────────────────────────────────────────────

export interface EcosystemCheck {
  /** When this check was performed */
  checkedAt: Date;
  /** Upstream commits since last check */
  newCommits: UpstreamCommit[];
  /** Capabilities that are new upstream */
  newCapabilities: string[];
  /** Capabilities Drofbot has that upstream doesn't */
  uniqueCapabilities: string[];
  /** Opportunities identified */
  opportunities: EcosystemOpportunity[];
  /** Latest upstream release version */
  latestRelease: string | null;
}

export interface UpstreamCommit {
  hash: string;
  message: string;
  date: string;
  author: string;
}

export interface EcosystemOpportunity {
  /** What upstream did */
  description: string;
  /** How it could benefit Drofbot */
  relevance: "high" | "medium" | "low";
  /** Suggested action */
  proposal: string;
}

// ─── Monitor Deps ──────────────────────────────────────────────

export interface EcosystemDeps {
  /** Fetch upstream repo changes (e.g., via GitHub API or git) */
  fetchUpstreamCommits: (since: string | null) => Promise<UpstreamCommit[]>;
  /** Fetch latest release tag from upstream */
  fetchLatestRelease: () => Promise<string | null>;
  /** Our own capabilities summary */
  getOwnCapabilities: () => string[];
  /** Store findings in memory */
  storeInMemory: (category: string, content: string) => Promise<void>;
  /** Get timestamp of last check */
  getLastCheckTimestamp: () => string | null;
  /** Save timestamp of this check */
  saveCheckTimestamp: (ts: string) => Promise<void>;
}

// ─── Monitor ───────────────────────────────────────────────────

/**
 * Run an ecosystem check against upstream OpenClaw.
 * Designed to run daily via cron.
 */
export async function checkEcosystem(deps: EcosystemDeps): Promise<EcosystemCheck> {
  const lastCheck = deps.getLastCheckTimestamp();

  const [newCommits, latestRelease] = await Promise.all([
    deps.fetchUpstreamCommits(lastCheck),
    deps.fetchLatestRelease(),
  ]);

  const ownCaps = deps.getOwnCapabilities();
  const newCapabilities = extractNewCapabilities(newCommits);
  const uniqueCapabilities = findUniqueToDrofbot(ownCaps, newCapabilities);
  const opportunities = identifyOpportunities(newCommits, ownCaps);

  const check: EcosystemCheck = {
    checkedAt: new Date(),
    newCommits,
    newCapabilities,
    uniqueCapabilities,
    opportunities,
    latestRelease,
  };

  // Store analysis in procedural memory
  const rendered = renderEcosystemCheck(check);
  await deps.storeInMemory("ecosystem_analysis", rendered);
  await deps.saveCheckTimestamp(new Date().toISOString());

  return check;
}

// ─── Analysis Functions ────────────────────────────────────────

/**
 * Extract new capabilities from commit messages using keyword heuristics.
 */
function extractNewCapabilities(commits: UpstreamCommit[]): string[] {
  const caps: string[] = [];
  const keywords = ["add", "feat", "new", "implement", "introduce", "support"];

  for (const commit of commits) {
    const lower = commit.message.toLowerCase();
    if (keywords.some((kw) => lower.startsWith(kw) || lower.includes(`${kw}:`))) {
      // Extract the feature description (everything after the keyword prefix)
      const clean = commit.message
        .replace(/^(feat|add|new|implement|introduce|support)[:(]\s*/i, "")
        .trim();
      if (clean.length > 5) {
        caps.push(clean);
      }
    }
  }

  return [...new Set(caps)];
}

/**
 * Find capabilities unique to Drofbot (not present upstream).
 */
function findUniqueToDrofbot(ownCaps: string[], upstreamCaps: string[]): string[] {
  const upstreamLower = new Set(upstreamCaps.map((c) => c.toLowerCase()));
  return ownCaps.filter((c) => {
    const lower = c.toLowerCase();
    // Check if any upstream capability is substantially similar
    return ![...upstreamLower].some((u) => u.includes(lower) || lower.includes(u));
  });
}

/**
 * Identify opportunities from upstream changes.
 */
function identifyOpportunities(
  commits: UpstreamCommit[],
  ownCaps: string[],
): EcosystemOpportunity[] {
  const opportunities: EcosystemOpportunity[] = [];
  const ownLower = new Set(ownCaps.map((c) => c.toLowerCase()));

  for (const commit of commits) {
    const lower = commit.message.toLowerCase();

    // Skip if we already have something similar
    if ([...ownLower].some((c) => lower.includes(c))) continue;

    // High relevance: infrastructure/architecture changes
    if (lower.includes("refactor") || lower.includes("architect")) {
      opportunities.push({
        description: commit.message,
        relevance: "high",
        proposal: `Review upstream approach: ${commit.hash}`,
      });
    }
    // Medium relevance: new features
    else if (lower.startsWith("feat") || lower.includes("add")) {
      opportunities.push({
        description: commit.message,
        relevance: "medium",
        proposal: `Evaluate if ${commit.message} would benefit Drofbot`,
      });
    }
  }

  return opportunities.slice(0, 10); // Cap at 10
}

// ─── Rendering ─────────────────────────────────────────────────

export function renderEcosystemCheck(check: EcosystemCheck): string {
  const lines: string[] = [];
  lines.push(`Ecosystem check: ${check.checkedAt.toISOString().split("T")[0]}`);
  lines.push("");

  if (check.latestRelease) {
    lines.push(`Upstream latest: ${check.latestRelease}`);
  }

  lines.push(`New commits: ${check.newCommits.length}`);
  lines.push(`New capabilities detected: ${check.newCapabilities.length}`);
  lines.push(`Unique to Drofbot: ${check.uniqueCapabilities.length}`);
  lines.push("");

  if (check.opportunities.length > 0) {
    lines.push("Opportunities:");
    for (const opp of check.opportunities) {
      lines.push(`  [${opp.relevance.toUpperCase()}] ${opp.description}`);
      lines.push(`    → ${opp.proposal}`);
    }
  }

  return lines.join("\n").trim();
}
