/**
 * Moon Phase SVG — Calculated visualization
 *
 * Pure SVG moon phase rendering based on illumination percentage.
 * Thin strokes, paper-like quality. No static images.
 */

interface MoonPhaseProps {
  /** Illumination 0–1 (0 = new, 1 = full) */
  illumination: number;
  /** Phase name e.g. "Waxing Crescent" */
  phaseName: string;
  /** Days until the next phase transition */
  daysToNextPhase?: number;
  /** Diameter in px (default 64) */
  size?: number;
  className?: string;
}

/**
 * Calculate the SVG arc path for the illuminated portion.
 * Uses two arcs to draw the lit shape over a dark circle.
 */
function moonPath(illumination: number, r: number): string {
  // illumination 0–1, radius r
  // We draw the terminator as an elliptical arc
  const sweep = illumination <= 0.5 ? 0 : 1;
  // Map illumination to terminator x-radius
  const terminatorRx = Math.abs(1 - 2 * illumination) * r;

  // We draw: left arc (always a semi-circle) + right arc (elliptical terminator)
  // For waxing (0→0.5): lit region is on the right, terminator curves inward
  // For waning (0.5→1): lit region fills, terminator curves outward
  return [
    `M 0 ${-r}`, // top
    `A ${r} ${r} 0 0 1 0 ${r}`, // right semi-circle (always lit boundary)
    `A ${terminatorRx} ${r} 0 0 ${sweep} 0 ${-r}`, // terminator arc
    "Z",
  ].join(" ");
}

export function MoonPhase({
  illumination,
  phaseName,
  daysToNextPhase,
  size = 64,
  className = "",
}: MoonPhaseProps) {
  const clamped = Math.max(0, Math.min(1, illumination));
  const r = size / 2 - 2; // leave stroke room
  const cx = size / 2;
  const cy = size / 2;
  const pct = Math.round(clamped * 100);

  return (
    <div
      className={`inline-flex flex-col items-center gap-1.5 ${className}`}
      data-testid="moon-phase"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Moon phase: ${phaseName}, ${pct}% illuminated`}
      >
        {/* Dark base circle */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="var(--ground-3, #e8e4db)"
          stroke="var(--border, #e0dbd2)"
          strokeWidth={1}
        />
        {/* Illuminated portion */}
        {clamped > 0.01 && (
          <path
            d={moonPath(clamped, r)}
            fill="var(--ink-1, #1a1816)"
            opacity={0.15}
            transform={`translate(${cx},${cy})`}
          />
        )}
        {/* Outline */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--ink-4, #b5b0a8)"
          strokeWidth={0.75}
        />
      </svg>
      <span className="text-xs text-ink-2 font-medium" data-testid="moon-phase-name">
        {phaseName}
      </span>
      <span className="text-xs text-ink-3 tabular-nums" data-testid="moon-illumination">
        {pct}%
      </span>
      {daysToNextPhase != null && (
        <span className="text-xs text-ink-4" data-testid="moon-next-phase">
          {daysToNextPhase}d to next
        </span>
      )}
    </div>
  );
}

export default MoonPhase;
