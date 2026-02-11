import { Plus, ArrowUpDown, Clock, Zap, Star } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { Badge } from "../components/shared/Badge";
import { Card, CardContent, CardHeader } from "../components/shared/Card";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingPulse } from "../components/shared/LoadingPulse";
import { XPBar } from "../components/viz";
import { useProgressionStore } from "../stores/progression";

type SortKey = "deadline" | "xp" | "difficulty";

/**
 * The Path — quest management with three columns: Active, Completed, Expired.
 */
export default function Quests() {
  const { stats, quests, isLoading, fetchStats, fetchQuests, completeQuest, createQuest } =
    useProgressionStore();
  const [sortBy, setSortBy] = useState<SortKey>("deadline");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDifficulty, setNewDifficulty] = useState("MEDIUM");
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [reflection, setReflection] = useState("");

  useEffect(() => {
    fetchStats();
    fetchQuests();
  }, [fetchStats, fetchQuests]);

  const { active, completed, expired } = useMemo(() => {
    const a: typeof quests = [];
    const c: typeof quests = [];
    const e: typeof quests = [];
    for (const q of quests) {
      if (q.status === "COMPLETED") {
        c.push(q);
      } else if (q.status === "EXPIRED") {
        e.push(q);
      } else {
        a.push(q);
      }
    }
    // Sort active quests
    a.sort((x, y) => {
      if (sortBy === "xp") return y.xpReward - x.xpReward;
      if (sortBy === "difficulty") {
        const order = { EASY: 0, MEDIUM: 1, HARD: 2 };
        return (
          (order[x.difficulty as keyof typeof order] ?? 1) -
          (order[y.difficulty as keyof typeof order] ?? 1)
        );
      }
      return new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime();
    });
    return { active: a, completed: c, expired: e };
  }, [quests, sortBy]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    await createQuest({
      title: newTitle.trim(),
      description: newDesc.trim(),
      difficulty: newDifficulty,
    });
    setCreating(false);
    setShowCreate(false);
    setNewTitle("");
    setNewDesc("");
    setNewDifficulty("MEDIUM");
  };

  const handleComplete = async (id: string) => {
    await completeQuest(id);
    setCompleting(null);
    setReflection("");
  };

  if (isLoading && !stats) return <LoadingPulse />;

  return (
    <div className="space-y-6 page-transition">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink-1">The Path</h1>
          <p className="text-sm text-ink-3 mt-1">Quests and growth objectives</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Quest
        </button>
      </div>

      {/* XP Progress */}
      {stats && (
        <Card>
          <CardContent className="flex items-center gap-6">
            <div>
              <span className="text-3xl font-display text-accent">Lv. {stats.level}</span>
              <p className="text-xs text-ink-3 mt-1">{stats.rank}</p>
            </div>
            <div className="flex-1">
              <XPBar currentXP={stats.xp} xpToNext={stats.xpToNextLevel} level={stats.level} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Quest Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <h2 className="font-display text-base text-ink-1">Create Custom Quest</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              type="text"
              placeholder="Quest title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 bg-surface-raised border border-border-subtle rounded-lg text-sm text-ink-1 placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <textarea
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-surface-raised border border-border-subtle rounded-lg text-sm text-ink-1 placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-y"
            />
            <div className="flex items-center gap-3">
              <select
                value={newDifficulty}
                onChange={(e) => setNewDifficulty(e.target.value)}
                className="px-3 py-2 bg-surface-raised border border-border-subtle rounded-lg text-sm text-ink-1 focus:outline-none"
                aria-label="Difficulty"
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
              <button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim()}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light disabled:opacity-50 transition-colors"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <ArrowUpDown className="w-3.5 h-3.5 text-ink-3" />
        <span className="text-xs text-ink-3">Sort by:</span>
        {[
          { key: "deadline" as SortKey, label: "Newest", icon: Clock },
          { key: "xp" as SortKey, label: "XP Reward", icon: Zap },
          { key: "difficulty" as SortKey, label: "Difficulty", icon: Star },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
              sortBy === key
                ? "bg-accent text-white border-accent"
                : "text-ink-3 border-border-subtle hover:text-ink-1"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Active Quests */}
      <div>
        <h2 className="font-display text-lg text-ink-1 mb-3">Active Quests</h2>
        {active.length === 0 ? (
          <EmptyState
            title="No active quests"
            description="All quests completed or awaiting new challenges."
          />
        ) : (
          <div className="space-y-3">
            {active.map((quest) => (
              <Card key={quest.id}>
                <CardContent className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-ink-1">{quest.title}</h3>
                    <p className="text-xs text-ink-2 mt-1">{quest.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="accent">{quest.difficulty}</Badge>
                      <Badge variant="muted">+{quest.xpReward} XP</Badge>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {completing === quest.id ? (
                      <div className="space-y-2">
                        <textarea
                          placeholder="Reflection (optional)"
                          value={reflection}
                          onChange={(e) => setReflection(e.target.value)}
                          rows={2}
                          className="w-40 px-2 py-1 bg-surface-raised border border-border-subtle rounded text-xs focus:outline-none"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleComplete(quest.id)}
                            className="px-2 py-1 text-xs font-medium text-white bg-accent rounded hover:bg-accent-light transition-colors"
                          >
                            Submit
                          </button>
                          <button
                            onClick={() => setCompleting(null)}
                            className="px-2 py-1 text-xs text-ink-3 hover:text-ink-1 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCompleting(quest.id)}
                        className="px-3 py-1.5 text-xs font-medium text-accent border border-accent/30 rounded-md hover:bg-accent-subtle transition-colors"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed Quests */}
      {completed.length > 0 && (
        <div>
          <h2 className="font-display text-lg text-ink-1 mb-3">Completed</h2>
          <div className="space-y-2">
            {completed.slice(0, 5).map((quest) => (
              <Card key={quest.id} className="opacity-70">
                <CardContent className="flex items-center justify-between">
                  <span className="text-sm text-ink-2 line-through">{quest.title}</span>
                  <Badge variant="success">+{quest.xpReward} XP</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Expired Quests */}
      {expired.length > 0 && (
        <div>
          <h2 className="font-display text-lg text-ink-1 mb-3">Expired</h2>
          <div className="space-y-2">
            {expired.map((quest) => (
              <Card key={quest.id} className="opacity-50">
                <CardContent className="flex items-center justify-between">
                  <span className="text-sm text-ink-3">{quest.title}</span>
                  <Badge variant="error">Expired</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
