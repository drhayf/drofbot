/**
 * XP Bar — Progress to next level
 *
 * Clean, minimal horizontal bar.
 * Shows current XP, target XP, and progress percentage.
 */

interface XPBarProps {
  /** Current XP amount */
  currentXP: number;
  /** XP needed to reach next level */
  xpToNext: number;
  /** Current level */
  level?: number;
  className?: string;
}

export function XPBar({ currentXP, xpToNext, level, className = "" }: XPBarProps) {
  const total = currentXP + xpToNext;
  const pct = total > 0 ? Math.round((currentXP / total) * 100) : 0;

  return (
    <div className={`flex flex-col gap-1 ${className}`} data-testid="xp-bar">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-ink-3 font-medium">
          {level != null ? `Level ${level}` : "XP"}
        </span>
        <span className="text-xs text-ink-3 tabular-nums" data-testid="xp-values">
          {currentXP.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden bg-ground-3">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{
            width: `${pct}%`,
            backgroundColor: "var(--accent, #2c5a4a)",
          }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          data-testid="xp-fill"
        />
      </div>
    </div>
  );
}

export default XPBar;
