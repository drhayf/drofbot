import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "../components/shared/Card";
import { LoadingPulse } from "../components/shared/LoadingPulse";
import {
  CosmicMandala,
  CardDisplay,
  MoonPhase,
  KpGauge,
  PeriodProgress,
  ResonanceBar,
  FrequencyBand,
} from "../components/viz";
import { useCosmicStore } from "../stores/cosmic";

interface SystemSegment {
  name: string;
  displayName: string;
  summary: string;
  element?: string;
  intensity?: number;
}

/**
 * Cosmos — "The Weather" — full cosmic weather view with CosmicMandala hero
 * and detailed system panels.
 */
export default function Cosmos() {
  const { weather, isLoading, fetch: fetchCosmic, fetchSynthesis } = useCosmicStore();
  const [selectedSystem, setSelectedSystem] = useState<SystemSegment | null>(null);

  useEffect(() => {
    fetchCosmic();
    fetchSynthesis();
  }, [fetchCosmic, fetchSynthesis]);

  if (isLoading && !weather) return <LoadingPulse />;

  const card = weather?.card;
  const gate = weather?.gate;
  const solar = weather?.solar;
  const lunar = weather?.lunar;
  const transits = weather?.transits;
  const synthesis = weather?.synthesis;

  // Build system segments for the mandala
  const systems: SystemSegment[] = [];
  if (card)
    systems.push({
      name: "cardology",
      displayName: "Cardology",
      summary: card.name ?? `${card.rankName ?? ""} of ${card.suit ?? ""}`,
      element: "FIRE",
      intensity: 0.8,
    });
  if (gate)
    systems.push({
      name: "iching",
      displayName: "I-Ching / Human Design",
      summary: `Gate ${gate.number ?? "?"}.${gate.line ?? "?"}`,
      element: "WATER",
      intensity: 0.7,
    });
  if (transits)
    systems.push({
      name: "astrology",
      displayName: "Astrology",
      summary: `${transits.active?.length ?? 0} active transits`,
      element: "AIR",
      intensity: 0.6,
    });
  if (solar)
    systems.push({
      name: "solar",
      displayName: "Solar Weather",
      summary: `Kp ${solar.kpIndex ?? "—"}`,
      element: "FIRE",
      intensity: solar.kpIndex ? solar.kpIndex / 9 : 0.3,
    });
  if (lunar)
    systems.push({
      name: "lunar",
      displayName: "Lunar Cycle",
      summary: lunar.phase ?? "Unknown",
      element: "WATER",
      intensity: lunar.illumination ?? 0.5,
    });
  if (synthesis)
    systems.push({
      name: "synthesis",
      displayName: "Master Synthesis",
      summary: synthesis.resonanceType ?? "Harmonic",
      element: "ETHER",
      intensity: synthesis.overallResonance ?? 0.5,
    });

  return (
    <div className="space-y-6 page-transition">
      <div>
        <h1 className="font-display text-2xl text-ink-1">Cosmic Weather</h1>
        <p className="text-sm text-ink-3 mt-1">Your current energetic landscape</p>
      </div>

      {weather ? (
        <>
          {/* Hero: CosmicMandala */}
          <div className="flex justify-center">
            <CosmicMandala
              systems={systems}
              overallResonance={synthesis?.overallResonance}
              elementalBalance={synthesis?.elementalBalance}
              resonanceType={synthesis?.resonanceType}
              onSegmentSelect={setSelectedSystem}
              size={320}
            />
          </div>

          {selectedSystem && (
            <Card>
              <CardContent>
                <h3 className="font-display text-base text-ink-1">{selectedSystem.displayName}</h3>
                <p className="text-sm text-ink-2 mt-1">{selectedSystem.summary}</p>
              </CardContent>
            </Card>
          )}

          {/* System Detail Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cardology */}
            <Card>
              <CardHeader>
                <h2 className="font-display text-base text-ink-1">Cardology</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDisplay
                  card={
                    card
                      ? {
                          rank: card.rank ?? 1,
                          rankName: card.rankName ?? "A",
                          suit: card.suit ?? "Hearts",
                          name: card.name,
                        }
                      : null
                  }
                  karmaCards={card ? { debt: card.karmaDebt, gift: card.karmaGift } : undefined}
                  currentPlanet={card?.currentPlanet}
                />
                {card?.currentDay && card?.totalDays && (
                  <PeriodProgress
                    currentDay={card.currentDay}
                    totalDays={card.totalDays}
                    periodLabel={card.currentPlanet}
                    daysRemaining={card.daysRemaining}
                  />
                )}
              </CardContent>
            </Card>

            {/* I-Ching / Human Design */}
            <Card>
              <CardHeader>
                <h2 className="font-display text-base text-ink-1">I-Ching / Human Design</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                {gate && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-3">Gate</span>
                      <span className="text-ink-1 font-medium">
                        {gate.number}.{gate.line} — {gate.name ?? ""}
                      </span>
                    </div>
                    {gate.profile && (
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-3">Profile</span>
                        <span className="text-ink-1 font-medium">{gate.profile}</span>
                      </div>
                    )}
                    {gate.geneKeys && (
                      <div className="pt-2 border-t border-border-subtle">
                        <p className="text-xs text-ink-3 mb-2">Gene Keys Spectrum</p>
                        <FrequencyBand
                          frequency="GIFT"
                          labels={{
                            shadow: gate.geneKeys.shadow,
                            gift: gate.geneKeys.gift,
                            siddhi: gate.geneKeys.siddhi,
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Astrology */}
            <Card>
              <CardHeader>
                <h2 className="font-display text-base text-ink-1">Astrology</h2>
              </CardHeader>
              <CardContent>
                {transits?.active && transits.active.length > 0 ? (
                  <div className="space-y-2">
                    {transits.active.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-ink-3 shrink-0">{t.planet}</span>
                        <span className="text-ink-1">{t.aspect ?? t.description}</span>
                      </div>
                    ))}
                    {transits.retrogrades && transits.retrogrades.length > 0 && (
                      <div className="pt-2 border-t border-border-subtle">
                        <p className="text-xs text-ink-3 mb-1">Retrogrades</p>
                        <p className="text-sm text-caution font-medium">
                          {transits.retrogrades.join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-ink-3">No active transit data</p>
                )}
              </CardContent>
            </Card>

            {/* Solar Weather */}
            <Card>
              <CardHeader>
                <h2 className="font-display text-base text-ink-1">Solar Weather</h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <KpGauge value={solar?.kpIndex ?? 0} />
                  <div className="space-y-2 text-sm">
                    {solar?.solarWind && (
                      <div>
                        <span className="text-ink-3">Solar Wind</span>
                        <p className="text-ink-1">{solar.solarWind}</p>
                      </div>
                    )}
                    {solar?.geomagneticConditions && (
                      <div>
                        <span className="text-ink-3">Geomagnetic</span>
                        <p className="text-ink-1">{solar.geomagneticConditions}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lunar Cycle */}
            <Card>
              <CardHeader>
                <h2 className="font-display text-base text-ink-1">Lunar Cycle</h2>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <MoonPhase
                    illumination={lunar?.illumination ?? 0}
                    phaseName={lunar?.phase ?? "Unknown"}
                    daysToNextPhase={lunar?.daysToNextPhase}
                    size={80}
                  />
                  <div className="space-y-1 text-sm">
                    <p className="text-ink-1 font-medium">{lunar?.phase ?? "Unknown"}</p>
                    {lunar?.zodiacSign && <p className="text-ink-2">Moon in {lunar.zodiacSign}</p>}
                    <p className="text-ink-3">
                      {lunar?.illumination
                        ? `${Math.round(lunar.illumination * 100)}% illuminated`
                        : "—"}
                    </p>
                    {lunar?.isVoidOfCourse && (
                      <p className="text-caution text-xs font-medium">Void of Course</p>
                    )}
                    {lunar?.daysToNextPhase != null && (
                      <p className="text-xs text-ink-3">
                        {lunar.daysToNextPhase} days to next phase
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Master Synthesis */}
            <Card>
              <CardHeader>
                <h2 className="font-display text-base text-ink-1">Master Synthesis</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                {synthesis ? (
                  <>
                    <ResonanceBar
                      score={synthesis.overallResonance ?? 0}
                      resonanceType={synthesis.resonanceType}
                    />
                    {synthesis.narrative && (
                      <p className="text-sm text-ink-2 leading-relaxed">{synthesis.narrative}</p>
                    )}
                    {synthesis.confidence !== undefined && (
                      <p className="text-xs text-ink-3">
                        Confidence: {Math.round(synthesis.confidence * 100)}%
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-ink-3">Synthesis data unavailable</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-3">Cosmic data unavailable. Check council configuration.</p>
      )}
    </div>
  );
}
