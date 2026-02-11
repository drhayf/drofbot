import { Plus, Filter, Calendar } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../components/shared/Badge";
import { Card, CardContent } from "../components/shared/Card";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingPulse } from "../components/shared/LoadingPulse";
import { CosmicRibbon } from "../components/viz";
import { useJournalStore } from "../stores/journal";

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (date >= today) return "Today";
  if (date >= yesterday) return "Yesterday";
  if (date >= weekAgo) return "This Week";
  return "Older";
}

type FilterKey = "all" | "moon" | "card" | "gate";

/**
 * Chronicle — journal entry list with date grouping, cosmic context, and filters.
 */
export default function Journal() {
  const { entries, total, page, isLoading, fetchEntries } = useJournalStore();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    fetchEntries(1);
  }, [fetchEntries]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof entries> = {};
    for (const entry of entries) {
      const group = getDateGroup(entry.createdAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(entry);
    }
    return groups;
  }, [entries]);

  const groupOrder = ["Today", "Yesterday", "This Week", "Older"];

  if (isLoading && entries.length === 0) return <LoadingPulse />;

  return (
    <div className="space-y-6 page-transition">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink-1">Chronicle</h1>
          <p className="text-sm text-ink-3 mt-1">{total} entries</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="p-2 text-ink-3 hover:text-ink-1 border border-border-subtle rounded-lg transition-colors"
            aria-label="Toggle cosmic calendar"
          >
            <Calendar className="w-4 h-4" />
          </button>
          <Link
            to="/journal/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2" role="group" aria-label="Entry filters">
        <Filter className="w-3.5 h-3.5 text-ink-3" />
        {(["all", "moon", "card", "gate"] as FilterKey[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
              filter === f
                ? "bg-accent text-white border-accent"
                : "text-ink-3 border-border-subtle hover:text-ink-1"
            }`}
          >
            {f === "all"
              ? "All"
              : f === "moon"
                ? "Moon Phase"
                : f === "card"
                  ? "Card Period"
                  : "Gate"}
          </button>
        ))}
      </div>

      {/* Cosmic Calendar Toggle */}
      {showCalendar && (
        <Card>
          <CardContent>
            <h3 className="font-display text-sm text-ink-1 mb-2">Cosmic Calendar</h3>
            <p className="text-xs text-ink-3">
              Journal entries aligned with card periods and moon phases.
              {entries.length > 0 && ` Showing ${entries.length} entries.`}
            </p>
          </CardContent>
        </Card>
      )}

      {entries.length === 0 ? (
        <EmptyState
          title="No entries yet"
          description="Your chronicle is waiting to be written."
          action={
            <Link to="/journal/new" className="text-sm text-accent hover:underline">
              Write your first entry
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {groupOrder.map((group) => {
            const groupEntries = grouped[group];
            if (!groupEntries || groupEntries.length === 0) return null;
            return (
              <div key={group}>
                <h2 className="font-display text-sm text-ink-3 mb-3">{group}</h2>
                <div className="space-y-3">
                  {groupEntries.map((entry) => {
                    const ctx = entry.cosmicContext as
                      | {
                          card?: string;
                          moonPhase?: string;
                          gate?: string;
                        }
                      | undefined;
                    return (
                      <Link key={entry.id} to={`/journal/${entry.id}`}>
                        <Card hoverable className="mb-3">
                          <CardContent>
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-ink-1 line-clamp-2">{entry.content}</p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span className="text-xs text-ink-3">
                                    {new Date(entry.createdAt).toLocaleDateString()}
                                  </span>
                                  {entry.mood && <Badge variant="accent">{entry.mood}</Badge>}
                                  {entry.tags?.map((tag) => (
                                    <Badge key={tag} variant="muted">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                                {ctx && (
                                  <div className="mt-2">
                                    <CosmicRibbon
                                      card={ctx.card}
                                      moonPhase={ctx.moonPhase}
                                      gate={ctx.gate}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 pt-4">
          <button
            onClick={() => fetchEntries(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm text-ink-2 border border-border-subtle rounded-md disabled:opacity-30 hover:bg-ground-2 transition-colors"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-ink-3">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => fetchEntries(page + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-3 py-1.5 text-sm text-ink-2 border border-border-subtle rounded-md disabled:opacity-30 hover:bg-ground-2 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
