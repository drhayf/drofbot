/**
 * Period Progress — Cardology period timeline
 *
 * Shows current position in the 52-day cycle.
 * Clean horizontal timeline with current position marker.
 */

interface PeriodProgressProps {
  /** Current day within the period (1-based) */
  currentDay: number;
  /** Total days in this period */
  totalDays: number;
  /** Period label e.g. "Mercury Period" */
  periodLabel?: string;
  /** Days remaining in period */
  daysRemaining?: number;
  /** Cycle percentage (0–1) from SystemReading */
  cyclePercentage?: number;
  className?: string;
}

export function PeriodProgress({
  currentDay,
  totalDays,
  periodLabel,
  daysRemaining,
  cyclePercentage,
  className = "",
}: PeriodProgressProps) {
  const total = Math.max(1, totalDays);
  const day = Math.max(0, Math.min(currentDay, total));
  const pct =
    cyclePercentage != null ? Math.round(cyclePercentage * 100) : Math.round((day / total) * 100);
  const fraction = pct / 100;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`} data-testid="period-progress">
      <div className="flex items-baseline justify-between">
        {periodLabel && (
          <span className="text-xs text-ink-2 font-medium" data-testid="period-label">
            {periodLabel}
          </span>
        )}
        <span className="text-xs text-ink-3 tabular-nums" data-testid="period-day">
          Day {day}/{total}
        </span>
      </div>

      {/* Timeline bar */}
      <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-ground-3">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
          style={{
            width: `${pct}%`,
            backgroundColor: "var(--accent, #2c5a4a)",
          }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          data-testid="period-fill"
        />
        {/* Position marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 transition-all duration-200"
          style={{
            left: `calc(${Math.min(fraction * 100, 97)}% - 5px)`,
            backgroundColor: "var(--surface-raised, #fff)",
            borderColor: "var(--accent, #2c5a4a)",
          }}
          data-testid="period-marker"
        />
      </div>

      {daysRemaining != null && (
        <span className="text-xs text-ink-4 tabular-nums" data-testid="period-remaining">
          {daysRemaining} days remaining
        </span>
      )}
    </div>
  );
}

export default PeriodProgress;
