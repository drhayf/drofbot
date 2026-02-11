/**
 * Resonance Bar — Harmonic resonance score (0–1)
 *
 * Horizontal bar showing the Master Synthesis overall resonance.
 * Label with current synthesis confidence.
 */

interface ResonanceBarProps {
  /** Resonance score 0–1 */
  score: number;
  /** Resonance type label e.g. "HARMONIC", "SUPPORTIVE" */
  resonanceType?: string;
  /** Whether the synthesis is still calculating */
  isLoading?: boolean;
  className?: string;
}

function resonanceColor(score: number): string {
  if (score >= 0.8) return "var(--accent, #2c5a4a)";
  if (score >= 0.6) return "var(--positive, #3d7a56)";
  if (score >= 0.4) return "var(--caution, #8a7a3d)";
  if (score >= 0.2) return "var(--shadow, #7a5a6a)";
  return "var(--negative, #8a4a3d)";
}

function formatResonanceType(type?: string): string {
  if (!type) return "";
  return type.charAt(0) + type.slice(1).toLowerCase();
}

export function ResonanceBar({
  score,
  resonanceType,
  isLoading = false,
  className = "",
}: ResonanceBarProps) {
  const clamped = Math.max(0, Math.min(1, score));
  const pct = Math.round(clamped * 100);
  const color = resonanceColor(clamped);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`} data-testid="resonance-bar">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-ink-3 font-medium">Resonance</span>
        <div className="flex items-baseline gap-2">
          {resonanceType && (
            <span className="text-xs text-ink-3" data-testid="resonance-type">
              {formatResonanceType(resonanceType)}
            </span>
          )}
          <span
            className="text-sm font-medium text-ink-1 tabular-nums"
            data-testid="resonance-value"
          >
            {pct}%
          </span>
        </div>
      </div>
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--ground-3, #e8e4db)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{
            width: isLoading ? "0%" : `${pct}%`,
            backgroundColor: color,
          }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          data-testid="resonance-fill"
        />
      </div>
    </div>
  );
}

export default ResonanceBar;
