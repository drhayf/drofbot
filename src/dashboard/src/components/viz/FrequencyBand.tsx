/**
 * Frequency Band — Gene Keys frequency position
 *
 * Shadow → Gift → Siddhi spectrum visualization.
 * Three-segment bar with current position highlighted.
 */

type FrequencyLevel = "SHADOW" | "GIFT" | "SIDDHI";

interface FrequencyBandProps {
  /** Current frequency band */
  frequency: FrequencyLevel;
  /** Current percentage within overall progression (0–100) */
  percentage?: number;
  /** Shadow, Gift, Siddhi labels (customizable) */
  labels?: { shadow?: string; gift?: string; siddhi?: string };
  className?: string;
}

const BAND_COLORS: Record<FrequencyLevel, string> = {
  SHADOW: "var(--shadow, #7a5a6a)",
  GIFT: "var(--gift, #5a7a6a)",
  SIDDHI: "var(--siddhi, #7a7a5a)",
};

const BAND_ORDER: FrequencyLevel[] = ["SHADOW", "GIFT", "SIDDHI"];

export function FrequencyBand({
  frequency,
  percentage,
  labels,
  className = "",
}: FrequencyBandProps) {
  const activeIndex = BAND_ORDER.indexOf(frequency);
  const displayLabels = {
    shadow: labels?.shadow ?? "Shadow",
    gift: labels?.gift ?? "Gift",
    siddhi: labels?.siddhi ?? "Siddhi",
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`} data-testid="frequency-band">
      {/* Three-segment bar */}
      <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-ground-3">
        {BAND_ORDER.map((band, i) => {
          const isActive = i <= activeIndex;
          return (
            <div
              key={band}
              className="flex-1 transition-all duration-200"
              style={{
                backgroundColor: isActive ? BAND_COLORS[band] : "transparent",
                opacity: i === activeIndex ? 1 : isActive ? 0.4 : 0,
              }}
              data-testid={`frequency-segment-${band.toLowerCase()}`}
            />
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex justify-between">
        {BAND_ORDER.map((band, i) => {
          const isActive = i === activeIndex;
          const labelText =
            band === "SHADOW"
              ? displayLabels.shadow
              : band === "GIFT"
                ? displayLabels.gift
                : displayLabels.siddhi;
          return (
            <span
              key={band}
              className={`text-[10px] tracking-wider uppercase ${isActive ? "font-semibold text-ink-1" : "text-ink-4"}`}
              data-testid={`frequency-label-${band.toLowerCase()}`}
            >
              {labelText}
            </span>
          );
        })}
      </div>

      {percentage != null && (
        <span className="text-xs text-ink-3 tabular-nums" data-testid="frequency-percentage">
          {percentage}%
        </span>
      )}
    </div>
  );
}

export default FrequencyBand;
