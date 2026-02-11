import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { PatternSummary } from "../types";
import { Badge } from "../components/shared/Badge";
import { Card, CardContent } from "../components/shared/Card";
import { EmptyState } from "../components/shared/EmptyState";
import { LoadingPulse } from "../components/shared/LoadingPulse";
import { ConfidenceGauge } from "../components/viz";
import { useIntelligenceStore } from "../stores/intelligence";

const statusVariant: Record<string, "warning" | "success" | "error" | "muted" | "default"> = {
  FORMING: "muted",
  TESTING: "warning",
  CONFIRMED: "success",
  REJECTED: "error",
  STALE: "muted",
};

/**
 * The Mirror — hypothesis board, pattern feed, and operator profile.
 */
export default function Intelligence() {
  const {
    hypotheses,
    patterns,
    isLoading,
    fetchHypotheses,
    fetchPatterns,
    confirmHypothesis,
    rejectHypothesis,
  } = useIntelligenceStore();

  useEffect(() => {
    fetchHypotheses();
    fetchPatterns();
  }, [fetchHypotheses, fetchPatterns]);

  if (isLoading && hypotheses.length === 0) return <LoadingPulse />;

  const confirmedFacts = hypotheses.filter((h) => h.status === "CONFIRMED");
  const patternList: PatternSummary[] = patterns ?? [];

  return (
    <div className="space-y-6 page-transition">
      <div>
        <h1 className="font-display text-2xl text-ink-1">The Mirror</h1>
        <p className="text-sm text-ink-3 mt-1">Hypotheses Drofbot is forming about you</p>
      </div>

      {/* Hypothesis Board */}
      <div>
        <h2 className="font-display text-lg text-ink-1 mb-3">Hypothesis Board</h2>
        {hypotheses.length === 0 ? (
          <EmptyState
            title="No hypotheses yet"
            description="As you interact, Drofbot will start forming hypotheses about your patterns and preferences."
          />
        ) : (
          <div className="space-y-3">
            {hypotheses.map((h) => (
              <Card key={h.id}>
                <CardContent>
                  <div className="flex items-start gap-4">
                    <ConfidenceGauge confidence={h.confidence} size={56} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          to={`/intelligence/${h.id}`}
                          className="text-sm font-medium text-ink-1 hover:text-accent transition-colors"
                        >
                          {h.statement}
                        </Link>
                        <Badge variant={statusVariant[h.status] ?? "default"} dot>
                          {h.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-ink-2 line-clamp-2">{h.category}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-ink-3">
                        <span>{Math.round(h.confidence * 100)}% confidence</span>
                        <span>{h.type}</span>
                        <span>{h.evidenceRecords?.length ?? 0} evidence</span>
                        {h.createdAt && <span>{new Date(h.createdAt).toLocaleDateString()}</span>}
                      </div>
                    </div>

                    {h.status === "TESTING" && (
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => confirmHypothesis(h.id)}
                          className="px-2.5 py-1 text-xs font-medium text-positive border border-emerald-200 rounded-md hover:bg-emerald-50 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => rejectHypothesis(h.id)}
                          className="px-2.5 py-1 text-xs font-medium text-negative border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Pattern Feed */}
      {patternList.length > 0 && (
        <div>
          <h2 className="font-display text-lg text-ink-1 mb-3">Pattern Feed</h2>
          <div className="space-y-2">
            {patternList.map((p, i) => (
              <Card key={p.id ?? i}>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ink-1">
                      {p.statement ?? p.type ?? "Unknown pattern"}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-ink-3">
                      {p.type && <span>{p.type}</span>}
                      {p.evidenceCount != null && <span>{p.evidenceCount} occurrences</span>}
                      {p.updatedAt && (
                        <span>Last: {new Date(p.updatedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  {p.confidence != null && (
                    <Badge variant="accent">{Math.round(p.confidence * 100)}%</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Operator Profile */}
      {confirmedFacts.length > 0 && (
        <div>
          <h2 className="font-display text-lg text-ink-1 mb-3">Your Profile</h2>
          <Card>
            <CardContent>
              <p className="text-xs text-ink-3 mb-3">
                Confirmed facts synthesized from verified hypotheses
              </p>
              <div className="space-y-2">
                {confirmedFacts.map((h) => (
                  <div key={h.id} className="flex items-center gap-2">
                    <Badge variant="success" dot>
                      Confirmed
                    </Badge>
                    <span className="text-sm text-ink-1">{h.statement}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
