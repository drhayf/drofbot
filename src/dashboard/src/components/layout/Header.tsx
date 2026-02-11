import { useCosmicStore } from "../../stores/cosmic";

/**
 * Header — top bar with cosmic time context.
 * Shows current gate, moon phase, Kp indicator, period.
 */
export function Header() {
  const weather = useCosmicStore((s) => s.weather);

  const gate = weather?.gate;
  const moon = weather?.lunar;
  const solar = weather?.solar;
  const card = weather?.card;

  return (
    <header className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-3 border-b border-border-subtle bg-surface-raised/80 backdrop-blur-sm">
      {/* Left: cosmic time indicators */}
      <div className="flex items-center gap-4 text-sm text-ink-3">
        {gate && <span title="Current Gate">Gate {gate.number ?? ""}</span>}
        {moon && <span title="Moon Phase">{moon.phase ?? ""}</span>}
        {solar && (
          <span
            title="Kp Index"
            className={(solar.kpIndex ?? 0) >= 5 ? "text-caution font-medium" : ""}
          >
            Kp {solar.kpIndex ?? "–"}
          </span>
        )}
        {card && <span title="Current Period">{card.currentPlanet ?? ""}</span>}
      </div>

      {/* Right: date */}
      <div className="text-sm text-ink-3">
        {new Date().toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </div>
    </header>
  );
}
