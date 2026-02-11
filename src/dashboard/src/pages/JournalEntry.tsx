import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { JournalCosmicContext } from "../types";
import { Badge } from "../components/shared/Badge";
import { Card, CardContent, CardHeader } from "../components/shared/Card";
import { LoadingPulse } from "../components/shared/LoadingPulse";
import { CosmicRibbon } from "../components/viz";
import { useJournalStore } from "../stores/journal";

/**
 * Single journal entry detail view.
 * Shows full content, cosmic context panel, connected patterns, and hypothesis matches.
 */
export default function JournalEntry() {
  const { id } = useParams<{ id: string }>();
  const { getEntry } = useJournalStore();
  const [entry, setEntry] = useState<
    ReturnType<typeof useJournalStore.getState>["entries"][0] | null
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getEntry(id).then((e) => {
      setEntry(e);
      setLoading(false);
    });
  }, [id, getEntry]);

  if (loading) return <LoadingPulse />;
  if (!entry) return <p className="text-ink-3 py-8 text-center">Entry not found</p>;

  const cosmicCtx: JournalCosmicContext | undefined = entry.cosmicContext;

  const matchedHypotheses = entry.matchedHypotheses ?? [];

  return (
    <div className="space-y-6 page-transition">
      <Link
        to="/journal"
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Chronicle
      </Link>

      {/* Main content */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-ink-3">{new Date(entry.createdAt).toLocaleString()}</span>
            {entry.mood && <Badge variant="accent">{entry.mood}</Badge>}
          </div>

          <p className="text-ink-1 leading-relaxed whitespace-pre-wrap">{entry.content}</p>

          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-border-subtle">
              {entry.tags.map((tag) => (
                <Badge key={tag} variant="muted">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cosmic Context Panel */}
      <Card>
        <CardHeader>
          <h3 className="font-display text-base text-ink-1">Cosmic Context</h3>
          <p className="text-xs text-ink-3 mt-0.5">The cosmic weather when this was written</p>
        </CardHeader>
        <CardContent>
          {cosmicCtx ? (
            <div className="space-y-3">
              <CosmicRibbon
                card={cosmicCtx.card}
                moonPhase={cosmicCtx.moonPhase}
                moonIllumination={cosmicCtx.moonIllumination}
                kpIndex={cosmicCtx.kpIndex}
                gate={cosmicCtx.gate}
              />
              {cosmicCtx.transits && (
                <div className="pt-3 border-t border-border-subtle">
                  <p className="text-xs font-medium text-ink-3 mb-1">Active Transits</p>
                  <pre className="text-xs text-ink-2 bg-ground-2 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(cosmicCtx.transits as object, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-3">No cosmic context recorded for this entry.</p>
          )}
        </CardContent>
      </Card>

      {/* Hypothesis Matches */}
      {matchedHypotheses.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-display text-base text-ink-1">Connected Hypotheses</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {matchedHypotheses.map((hypothesisId) => (
                <Link
                  key={hypothesisId}
                  to={`/intelligence/${hypothesisId}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-ground-2 transition-colors"
                >
                  <p className="text-sm text-ink-1 font-mono">{hypothesisId}</p>
                  <Badge variant="accent">View</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Memory Classification */}
      <Card>
        <CardHeader>
          <h3 className="font-display text-base text-ink-1">Memory Classification</h3>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {entry.tags && entry.tags.length > 0 ? (
              entry.tags.map((tag) => (
                <Badge key={tag} variant="accent">
                  {tag}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-ink-3">Not yet classified into memory banks.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
