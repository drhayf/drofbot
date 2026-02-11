import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { RankId } from "../types";
import { Badge } from "../components/shared/Badge";
import { Card, CardContent, CardHeader } from "../components/shared/Card";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingPulse } from "../components/shared/LoadingPulse";
import {
  CosmicRibbon,
  RankBadge,
  XPBar,
  StreakIndicator,
  FrequencyBand,
  ConfidenceGauge,
  ResonanceBar,
} from "../components/viz";
import { useCosmicStore } from "../stores/cosmic";
import { useIntelligenceStore } from "../stores/intelligence";
import { useJournalStore } from "../stores/journal";
import { useProgressionStore } from "../stores/progression";
import { RANK_TITLES } from "../types";

function getFrequency(xpPct: number): "SHADOW" | "GIFT" | "SIDDHI" {
  if (xpPct < 33) return "SHADOW";
  if (xpPct < 66) return "GIFT";
  return "SIDDHI";
}

/**
 * Observatory — the landing page.
 * Shows today's cosmic weather, active quests, recent journal, progression, and hypotheses.
 */
export default function Home() {
  const { weather, isLoading: cosmicLoading, fetch: fetchCosmic } = useCosmicStore();
  const { stats, quests, fetchStats, fetchQuests } = useProgressionStore();
  const { hypotheses, fetchHypotheses } = useIntelligenceStore();
  const { entries, fetchEntries } = useJournalStore();

  useEffect(() => {
    fetchCosmic();
    fetchStats();
    fetchQuests();
    fetchHypotheses("TESTING");
    fetchEntries(1);
  }, [fetchCosmic, fetchStats, fetchQuests, fetchHypotheses, fetchEntries]);

  if (cosmicLoading && !weather) return <LoadingPulse />;

  const card = weather?.card;
  const lunar = weather?.lunar;
  const solar = weather?.solar;
  const gate = weather?.gate;
  const synthesis = weather?.synthesis;

  const activeQuests = quests.filter((q) => q.status !== "COMPLETED");
  const xpPct = stats ? (stats.xp / stats.xpToNextLevel) * 100 : 0;
  const rankId = (stats?.rank ?? "E") as RankId;

  return (
    <div className="space-y-6 page-transition">
      <div>
        <h1 className="font-display text-2xl text-ink-1">Observatory</h1>
        <p className="text-sm text-ink-3 mt-1">
          Your daily cosmic weather and intelligence overview
        </p>
      </div>

      {/* Cosmic Ribbon — current snapshot */}
      <CosmicRibbon
        card={card?.name}
        moonPhase={lunar?.phase}
        moonIllumination={lunar?.illumination}
        kpIndex={solar?.kpIndex}
        gate={gate ? `${gate.number ?? ""}${gate.line ? `.${gate.line}` : ""}` : undefined}
        resonance={synthesis?.overallResonance}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current Weather */}
        <Card>
          <CardHeader>
            <h2 className="font-display text-base text-ink-1">Today's Weather</h2>
          </CardHeader>
          <CardContent>
            {synthesis?.narrative ? (
              <p className="text-sm text-ink-2 leading-relaxed">{synthesis.narrative}</p>
            ) : weather ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-3">Card</span>
                  <span className="text-ink-1 font-medium">{card?.name ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Gate</span>
                  <span className="text-ink-1 font-medium">{gate?.number ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Moon</span>
                  <span className="text-ink-1 font-medium">{lunar?.phase ?? "—"}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-3">Cosmic data unavailable</p>
            )}
            {synthesis?.overallResonance !== undefined && (
              <div className="mt-3 pt-3 border-t border-border-subtle">
                <ResonanceBar score={synthesis.overallResonance} resonanceType="Overall" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Hypotheses */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base text-ink-1">Active Hypotheses</h2>
              <Link to="/intelligence" className="text-xs text-accent hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {hypotheses.length > 0 ? (
              <ul className="space-y-3">
                {hypotheses.slice(0, 3).map((h) => (
                  <li key={h.id} className="flex items-center gap-3">
                    <ConfidenceGauge confidence={h.confidence} size={36} />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/intelligence/${h.id}`}
                        className="text-sm text-ink-1 hover:text-accent transition-colors line-clamp-1"
                      >
                        {h.statement}
                      </Link>
                      <span className="text-xs text-ink-3">{h.type}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">No active hypotheses</p>
            )}
          </CardContent>
        </Card>

        {/* Quest Board Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base text-ink-1">Quest Board</h2>
              <Link to="/quests" className="text-xs text-accent hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {activeQuests.length > 0 ? (
              <div className="space-y-2">
                <p className="text-2xl font-display text-accent">{activeQuests.length}</p>
                <p className="text-xs text-ink-3">active quests</p>
                {activeQuests[0] && (
                  <div className="pt-2 border-t border-border-subtle">
                    <p className="text-sm text-ink-2">{activeQuests[0].title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="accent">{activeQuests[0].difficulty}</Badge>
                      <Badge variant="muted">+{activeQuests[0].xpReward} XP</Badge>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-3">No active quests</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Journal */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base text-ink-1">Recent Journal</h2>
              <Link to="/journal" className="text-xs text-accent hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {entries.length > 0 ? (
              <div className="space-y-3">
                {entries.slice(0, 3).map((entry) => (
                  <Link key={entry.id} to={`/journal/${entry.id}`} className="block group">
                    <p className="text-sm text-ink-2 line-clamp-2 group-hover:text-accent transition-colors">
                      {entry.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-ink-3">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
                      {entry.tags?.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="muted">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="No entries yet" description="Start writing in the Chronicle." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progression snapshot — full width */}
      {stats && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base text-ink-1">Progression</h2>
              <Link to="/progression" className="text-xs text-accent hover:underline">
                Details
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
              <div className="flex items-center gap-3">
                <RankBadge
                  rankId={rankId}
                  title={RANK_TITLES[rankId] ?? "Unknown"}
                  level={stats.level}
                  compact
                />
                <div>
                  <p className="text-sm font-medium text-ink-1">Lv. {stats.level}</p>
                  <p className="text-xs text-ink-3">{stats.rank}</p>
                </div>
              </div>
              <XPBar currentXP={stats.xp} xpToNext={stats.xpToNextLevel} />
              <StreakIndicator days={stats.streakDays ?? 0} compact />
              <FrequencyBand frequency={getFrequency(xpPct)} percentage={xpPct} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
