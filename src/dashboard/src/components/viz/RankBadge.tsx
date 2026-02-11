/**
 * Rank Badge — Current progression rank display
 *
 * 7 ranks: Awakening (E) → Sovereign (SS).
 * Typographic, not iconographic. Clean and minimal.
 */

type RankId = "E" | "D" | "C" | "B" | "A" | "S" | "SS";

interface RankBadgeProps {
  /** Rank identifier */
  rankId: RankId;
  /** Rank title e.g. "Awakening" */
  title: string;
  /** Current level number */
  level?: number;
  /** Compact mode — just badge, no title */
  compact?: boolean;
  className?: string;
}

const RANK_STYLES: Record<RankId, { bg: string; text: string; border: string }> = {
  E: { bg: "var(--ground-3)", text: "var(--ink-3)", border: "var(--border)" },
  D: { bg: "var(--ground-3)", text: "var(--ink-2)", border: "var(--border)" },
  C: { bg: "var(--accent-subtle)", text: "var(--accent)", border: "var(--accent-light)" },
  B: { bg: "var(--accent-subtle)", text: "var(--accent)", border: "var(--accent)" },
  A: { bg: "var(--accent-subtle)", text: "var(--accent)", border: "var(--accent)" },
  S: { bg: "var(--accent)", text: "var(--surface-raised)", border: "var(--accent)" },
  SS: { bg: "var(--ink-1)", text: "var(--surface-raised)", border: "var(--ink-1)" },
};

export function RankBadge({
  rankId,
  title,
  level,
  compact = false,
  className = "",
}: RankBadgeProps) {
  const style = RANK_STYLES[rankId] ?? RANK_STYLES.E;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} data-testid="rank-badge">
      <span
        className="inline-flex items-center justify-center rounded-card px-2 py-0.5 text-xs font-semibold tracking-wider"
        style={{
          backgroundColor: style.bg,
          color: style.text,
          border: `1px solid ${style.border}`,
        }}
        data-testid="rank-id"
      >
        {rankId}
      </span>
      {!compact && (
        <span className="text-sm text-ink-2 font-medium" data-testid="rank-title">
          {title}
          {level != null && <span className="text-ink-4 ml-1 tabular-nums">Lv.{level}</span>}
        </span>
      )}
    </div>
  );
}

export default RankBadge;
