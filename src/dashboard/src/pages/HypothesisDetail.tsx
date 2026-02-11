import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { Hypothesis } from "../types";
import { Badge } from "../components/shared/Badge";
import { Card, CardContent, CardHeader } from "../components/shared/Card";
import { LoadingPulse } from "../components/shared/LoadingPulse";
import { ConfidenceGauge } from "../components/viz";
import { useIntelligenceStore } from "../stores/intelligence";

/**
 * Single hypothesis detail view with confidence gauge, evidence chain,
 * confidence breakdown, and confirm/reject actions.
 */
export default function HypothesisDetail() {
  const { id } = useParams<{ id: string }>();
  const { getHypothesis, confirmHypothesis, rejectHypothesis } = useIntelligenceStore();
  const [hypothesis, setHypothesis] = useState<Hypothesis | null>(null);
  const [loading, setLoading] = useState(true);
  const [reflection, setReflection] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getHypothesis(id).then((h) => {
      setHypothesis(h);
      setLoading(false);
    });
  }, [id, getHypothesis]);

  if (loading) return <LoadingPulse />;
  if (!hypothesis) return <p className="text-ink-3 py-8 text-center">Hypothesis not found</p>;

  const evidenceList = hypothesis.evidenceRecords ?? [];

  return (
    <div className="space-y-6 page-transition">
      <Link
        to="/intelligence"
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to The Mirror
      </Link>

      {/* Main hypothesis card with large confidence gauge */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-xl text-ink-1">{hypothesis.statement}</h1>
            <Badge
              variant={
                hypothesis.status === "CONFIRMED"
                  ? "success"
                  : hypothesis.status === "REJECTED"
                    ? "error"
                    : "warning"
              }
              dot
            >
              {hypothesis.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <ConfidenceGauge confidence={hypothesis.confidence} label="Confidence" size={100} />
            <div className="flex-1 space-y-2">
              <p className="text-sm text-ink-2 leading-relaxed">{hypothesis.category}</p>
              <div className="flex items-center gap-4 text-xs text-ink-3">
                <span>Type: {hypothesis.type}</span>
                <span>Created: {new Date(hypothesis.createdAt).toLocaleDateString()}</span>
                {hypothesis.updatedAt && (
                  <span>Last evaluated: {new Date(hypothesis.updatedAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </div>

          {/* Confirm/Reject Actions with reflection */}
          {hypothesis.status === "TESTING" && (
            <div className="pt-4 border-t border-border-subtle space-y-3">
              <textarea
                placeholder="Add a reflection (optional)"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-surface-raised border border-border-subtle rounded-lg text-sm text-ink-1 placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-accent/20 resize-y"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => confirmHypothesis(hypothesis.id)}
                  className="px-4 py-2 text-sm font-medium text-white bg-positive rounded-lg hover:opacity-90 transition-opacity"
                >
                  Confirm Hypothesis
                </button>
                <button
                  onClick={() => rejectHypothesis(hypothesis.id)}
                  className="px-4 py-2 text-sm font-medium text-white bg-negative rounded-lg hover:opacity-90 transition-opacity"
                >
                  Reject Hypothesis
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confidence Breakdown */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-base text-ink-1">Confidence Breakdown</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                label: "Evidence Frequency",
                value: Math.min(1, evidenceList.length / 10),
                desc: `${evidenceList.length} data points`,
              },
              {
                label: "Recency",
                value: hypothesis.updatedAt
                  ? Math.max(
                      0.3,
                      1 -
                        (Date.now() - new Date(hypothesis.updatedAt).getTime()) /
                          (30 * 24 * 60 * 60 * 1000),
                    )
                  : 0.5,
                desc: hypothesis.updatedAt
                  ? `Last evaluated ${new Date(hypothesis.updatedAt).toLocaleDateString()}`
                  : "Not yet evaluated",
              },
              {
                label: "Cosmic Correlation",
                value:
                  evidenceList.filter((e) => e.cosmicContext).length /
                  Math.max(1, evidenceList.length),
                desc: `${evidenceList.filter((e) => e.cosmicContext).length}/${evidenceList.length} with cosmic context`,
              },
            ].map((factor) => (
              <div key={factor.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-ink-2">{factor.label}</span>
                  <span className="text-ink-3">{factor.desc}</span>
                </div>
                <div className="h-1.5 bg-ground-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{
                      width: `${Math.round(Math.min(1, Math.max(0, factor.value)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Evidence Chain */}
      {evidenceList.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-display text-base text-ink-1">
              Evidence Chain ({evidenceList.length})
            </h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {evidenceList.map((ev, i) => (
                <div
                  key={i}
                  className="relative pl-6 pb-4 border-l-2 border-border-subtle last:border-l-0 last:pb-0"
                >
                  <div className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-accent" />
                  <div className="space-y-1">
                    {ev.timestamp && (
                      <p className="text-xs text-ink-3">
                        {new Date(ev.timestamp).toLocaleString()}
                      </p>
                    )}
                    <p className="text-sm text-ink-1">
                      {ev.description ?? ev.source ?? "Evidence"}
                    </p>
                    {ev.evidenceType && <Badge variant="muted">{ev.evidenceType}</Badge>}
                    {ev.effectiveWeight != null && (
                      <span className="text-xs text-ink-3 ml-2">
                        Weight: {ev.effectiveWeight.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
