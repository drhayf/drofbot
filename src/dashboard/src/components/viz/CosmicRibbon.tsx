/**
 * Cosmic Ribbon — Inline summary strip
 *
 * Compact horizontal strip showing current cosmic snapshot:
 * card + moon phase + Kp + gate — all in one line.
 * Used at top of pages as contextual header.
 */

interface CosmicRibbonProps {
  /** Current card name e.g. "7♥" */
  card?: string;
  /** Moon phase name */
  moonPhase?: string;
  /** Moon illumination 0–1 */
  moonIllumination?: number;
  /** Kp index 0–9 */
  kpIndex?: number;
  /** Current I-Ching gate e.g. "Gate 44" */
  gate?: string;
  /** Overall resonance 0–1 */
  resonance?: number;
  className?: string;
}

function kpColorClass(kp: number): string {
  if (kp <= 3) return "text-positive";
  if (kp <= 5) return "text-caution";
  return "text-negative";
}

export function CosmicRibbon({
  card,
  moonPhase,
  moonIllumination,
  kpIndex,
  gate,
  resonance,
  className = "",
}: CosmicRibbonProps) {
  const items: { label: string; value: string; colorClass?: string }[] = [];

  if (card) items.push({ label: "Card", value: card });
  if (moonPhase) {
    const illum = moonIllumination != null ? ` ${Math.round(moonIllumination * 100)}%` : "";
    items.push({ label: "Moon", value: `${moonPhase}${illum}` });
  }
  if (kpIndex != null) {
    items.push({
      label: "Kp",
      value: String(kpIndex),
      colorClass: kpColorClass(kpIndex),
    });
  }
  if (gate) items.push({ label: "Gate", value: gate });
  if (resonance != null) {
    items.push({ label: "Resonance", value: `${Math.round(resonance * 100)}%` });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-4 px-3 py-1.5 rounded-card bg-surface-raised border border-border-subtle overflow-x-auto ${className}`}
      data-testid="cosmic-ribbon"
    >
      {items.map((item, i) => (
        <div key={item.label} className="flex items-baseline gap-1.5 whitespace-nowrap">
          {i > 0 && (
            <span className="text-ink-4 mr-1.5" aria-hidden="true">
              ·
            </span>
          )}
          <span className="text-[10px] text-ink-4 uppercase tracking-wider">{item.label}</span>
          <span
            className={`text-xs font-medium tabular-nums ${item.colorClass ?? "text-ink-1"}`}
            data-testid={`ribbon-${item.label.toLowerCase()}`}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default CosmicRibbon;
