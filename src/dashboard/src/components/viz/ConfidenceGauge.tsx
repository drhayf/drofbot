/**
 * Confidence Gauge — Arc meter for hypothesis confidence (0–100%)
 *
 * Weighted confidence from the GUTTERS algorithm.
 * Semantic coloring follows the design system confidence variables.
 */

interface ConfidenceGaugeProps {
  /** Confidence 0–1 */
  confidence: number;
  /** Optional label e.g. hypothesis status */
  label?: string;
  /** Diameter in px (default 80) */
  size?: number;
  className?: string;
}

function confidenceColor(c: number): string {
  if (c >= 0.85) return "var(--confidence-confirmed, #2c5a4a)";
  if (c >= 0.6) return "var(--confidence-high, #3d7a56)";
  if (c >= 0.3) return "var(--confidence-mid, #8a7a3d)";
  return "var(--confidence-low, #b5b0a8)";
}

export function ConfidenceGauge({
  confidence,
  label,
  size = 80,
  className = "",
}: ConfidenceGaugeProps) {
  const clamped = Math.max(0, Math.min(1, confidence));
  const pct = Math.round(clamped * 100);
  const color = confidenceColor(clamped);

  // 270° arc, starting from bottom-left
  const strokeWidth = 5;
  const r = size / 2 - strokeWidth;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const arcFraction = 0.75; // 270° of 360°
  const arcLength = circumference * arcFraction;
  const filledLength = arcLength * clamped;

  // Rotation to start at bottom-left (135°)
  const rotation = 135;

  return (
    <div
      className={`inline-flex flex-col items-center gap-1 ${className}`}
      data-testid="confidence-gauge"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background arc */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--ground-3, #e8e4db)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(${rotation} ${cx} ${cy})`}
          />
          {/* Value arc */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${filledLength} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(${rotation} ${cx} ${cy})`}
            className="transition-all duration-200"
          />
        </svg>
        {/* Center text */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          data-testid="confidence-value"
        >
          <span className="text-lg font-medium text-ink-1 tabular-nums leading-none">{pct}</span>
          <span className="text-[10px] text-ink-4">%</span>
        </div>
      </div>
      {label && (
        <span className="text-xs text-ink-3" data-testid="confidence-label">
          {label}
        </span>
      )}
    </div>
  );
}

export default ConfidenceGauge;
