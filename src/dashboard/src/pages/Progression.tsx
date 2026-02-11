import { useEffect } from "react";
import { Card, CardContent, CardHeader } from "../components/shared/Card";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingPulse } from "../components/shared/LoadingPulse";
import { RankBadge, XPBar, StreakIndicator, FrequencyBand, ResonanceBar } from "../components/viz";
import { useProgressionStore } from "../stores/progression";

type RankId = "E" | "D" | "C" | "B" | "A" | "S" | "SS";

const RANK_TITLES: Record<string, string> = {
  E: "Awakening",
  D: "Seeking",
  C: "Aligning",
  B: "Integrating",
  A: "Mastering",
  S: "Transcending",
  SS: "Sovereign",
};

function getFrequency(xpPct: number): "SHADOW" | "GIFT" | "SIDDHI" {
  if (xpPct < 33) return "SHADOW";
  if (xpPct < 66) return "GIFT";
  return "SIDDHI";
}

/**
 * The Ascent — progression profile, rank, XP, streaks, frequency, stats.
 */
export default function Progression() {
  const { stats, quests, isLoading, fetchStats, fetchQuests } = useProgressionStore();

  useEffect(() => {
    fetchStats();
    fetchQuests();
  }, [fetchStats, fetchQuests]);

  if (isLoading && !stats) return <LoadingPulse />;
  if (!stats) {
    return (
      <div className="space-y-6 page-transition">
        <div>
          <h1 className="font-display text-2xl text-ink-1">The Ascent</h1>
          <p className="text-sm text-ink-3 mt-1">Your progression and growth</p>
        </div>
        <EmptyState
          title="No progression data"
          description="Start interacting with Drofbot to build your progression profile."
        />
      </div>
    );
  }

  const rankId: RankId = stats.rank ?? "E";
  const xpPct = stats.xpToNextLevel > 0 ? (stats.xp / stats.xpToNextLevel) * 100 : 0;
  const frequency = getFrequency(xpPct);

  const completedQuests = quests.filter((q) => q.status === "COMPLETED");

  return (
    <div className="space-y-6 page-transition">
      <div>
        <h1 className="font-display text-2xl text-ink-1">The Ascent</h1>
        <p className="text-sm text-ink-3 mt-1">Your progression and growth</p>
      </div>

      {/* Rank + XP — hero section */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-6">
            <RankBadge
              rankId={rankId}
              title={RANK_TITLES[rankId] ?? "Unknown"}
              level={stats.level}
            />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-2xl font-display text-ink-1">Level {stats.level}</p>
                <p className="text-sm text-ink-3">
                  {RANK_TITLES[rankId]} — Rank {rankId}
                </p>
              </div>
              <XPBar currentXP={stats.xp} xpToNext={stats.xpToNextLevel} level={stats.level} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Streak + Frequency + Sync Rate */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <h3 className="font-display text-sm text-ink-1">Streak</h3>
          </CardHeader>
          <CardContent>
            <StreakIndicator days={stats.streakDays ?? 0} />
            {stats.bestStreak != null && (
              <p className="text-xs text-ink-3 mt-2">Best: {stats.bestStreak} days</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-display text-sm text-ink-1">Frequency Band</h3>
          </CardHeader>
          <CardContent>
            <FrequencyBand frequency={frequency} percentage={xpPct} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-display text-sm text-ink-1">Sync Rate</h3>
          </CardHeader>
          <CardContent>
            <ResonanceBar score={stats.syncRate ?? 0} resonanceType="Action-Cosmic Sync" />
          </CardContent>
        </Card>
      </div>

      {/* XP History */}
      {stats.xpHistory && stats.xpHistory.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-display text-base text-ink-1">XP History</h2>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-24">
              {stats.xpHistory.slice(-14).map((entry, i) => {
                const max = Math.max(...stats.xpHistory!.slice(-14).map((e) => e.xp), 1);
                return (
                  <div
                    key={i}
                    className="flex-1 bg-accent/70 rounded-t transition-all hover:bg-accent"
                    style={{ height: `${(entry.xp / max) * 100}%` }}
                    title={`${entry.date}: ${entry.xp} XP`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-ink-3 mt-1">
              <span>{stats.xpHistory[Math.max(0, stats.xpHistory.length - 14)]?.date}</span>
              <span>{stats.xpHistory[stats.xpHistory.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Achievement Timeline */}
      {stats.achievements && stats.achievements.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-display text-base text-ink-1">Achievements</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.achievements.map((a, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                  <div>
                    <p className="text-sm text-ink-1">{a.title}</p>
                    <p className="text-xs text-ink-3">
                      {new Date(a.date).toLocaleDateString()} — {a.type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-base text-ink-1">Stats</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-display text-accent">{stats.totalEntries ?? 0}</p>
              <p className="text-xs text-ink-3 mt-1">Journal Entries</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-display text-accent">{completedQuests.length}</p>
              <p className="text-xs text-ink-3 mt-1">Quests Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-display text-accent">
                {stats.totalHypothesesConfirmed ?? 0}
              </p>
              <p className="text-xs text-ink-3 mt-1">Hypotheses Confirmed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-display text-accent">
                {stats.totalPatternsDetected ?? 0}
              </p>
              <p className="text-xs text-ink-3 mt-1">Patterns Detected</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
