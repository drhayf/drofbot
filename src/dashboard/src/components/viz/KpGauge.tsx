/**
 * Kp Index Gauge — Solar weather severity
 *
 * Minimal arc gauge for Kp 0–9.
 * Semantic coloring: green → amber → red.
 */

interface KpGaugeProps {
  /** Kp index value 0–9 */
  value: number;
  /** Human-readable storm label e.g. "G1 Minor" */
  label?: string;
  /** Width in px (default 120) */
  size?: number;
  className?: string;
}

function kpColor(kp: number): string {
  if (kp <= 3) return "var(--positive, #3d7a56)";
  if (kp <= 5) return "var(--caution, #8a7a3d)";
  return "var(--negative, #8a4a3d)";
}

function kpSeverity(kp: number): string {
  if (kp <= 1) return "Quiet";
  if (kp <= 3) return "Unsettled";
  if (kp <= 4) return "Active";
  if (kp <= 5) return "Minor Storm";
  if (kp <= 7) return "Strong Storm";
  return "Severe Storm";
}

export function KpGauge({ value, label, size = 120, className = "" }: KpGaugeProps) {
  const clamped = Math.max(0, Math.min(9, value));
  const fraction = clamped / 9;
  const color = kpColor(clamped);
  const severity = label ?? kpSeverity(clamped);

  // Arc geometry — 180° arc from left to right
  const strokeWidth = 6;
  const r = size / 2 - strokeWidth;
  const cx = size / 2;
  const cy = size / 2 + 4; // shift down slightly for label room

  // Arc goes from π to 0 (left to right)
  const startAngle = Math.PI;
  const endAngle = Math.PI - fraction * Math.PI;

  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);

  const largeArc = fraction > 0.5 ? 1 : 0;

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`} data-testid="kp-gauge">
      <svg
        width={size}
        height={size / 2 + 16}
        viewBox={`0 0 ${size} ${size / 2 + 16}`}
        role="img"
        aria-label={`Kp Index: ${clamped}, ${severity}`}
      >
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--ground-3, #e8e4db)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        {fraction > 0.01 && (
          <path
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* Center value */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="auto"
          fill="var(--ink-1, #1a1816)"
          fontSize="20"
          fontWeight="600"
          fontFamily="var(--font-body, 'DM Sans', sans-serif)"
          data-testid="kp-value"
        >
          {clamped}
        </text>
      </svg>
      <span className="text-xs text-ink-2 font-medium" data-testid="kp-severity">
        {severity}
      </span>
    </div>
  );
}

export default KpGauge;
