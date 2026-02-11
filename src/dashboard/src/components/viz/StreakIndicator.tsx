/**
 * Streak Indicator — Engagement streak display
 *
 * Subtle warmth indicator. NOT a literal fire emoji.
 * Uses warm accent coloring that intensifies with streak length.
 */

interface StreakIndicatorProps {
  /** Current streak in days */
  days: number;
  /** Show as compact inline */
  compact?: boolean;
  className?: string;
}

function streakIntensity(days: number): { color: string; opacity: number } {
  if (days <= 0) return { color: "var(--ink-4, #b5b0a8)", opacity: 0.4 };
  if (days <= 3) return { color: "var(--fire, #b07050)", opacity: 0.5 };
  if (days <= 7) return { color: "var(--fire, #b07050)", opacity: 0.7 };
  if (days <= 14) return { color: "var(--fire, #b07050)", opacity: 0.85 };
  return { color: "var(--fire, #b07050)", opacity: 1.0 };
}

export function StreakIndicator({ days, compact = false, className = "" }: StreakIndicatorProps) {
  const { color, opacity } = streakIntensity(days);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums ${className}`}
        style={{ color, opacity }}
        data-testid="streak-indicator"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M6 1C6 1 8.5 3.5 8.5 6C8.5 7.38 7.38 8.5 6 8.5C4.62 8.5 3.5 7.38 3.5 6C3.5 5 4 4 4.5 3.5L5 4.5C5 4.5 6 3 6 1Z"
            fill="currentColor"
          />
        </svg>
        {days}d
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="streak-indicator">
      {/* Warmth icon — abstract flame shape */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        style={{ color, opacity }}
        aria-label={`${days} day streak`}
      >
        <path
          d="M10 2C10 2 14 5.5 14 9.5C14 11.71 12.21 13.5 10 13.5C7.79 13.5 6 11.71 6 9.5C6 8 7 6.5 7.5 6L8.5 7.5C8.5 7.5 10 5 10 2Z"
          fill="currentColor"
        />
      </svg>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-ink-1 tabular-nums" data-testid="streak-days">
          {days} {days === 1 ? "day" : "days"}
        </span>
        <span className="text-xs text-ink-4">streak</span>
      </div>
    </div>
  );
}

export default StreakIndicator;
