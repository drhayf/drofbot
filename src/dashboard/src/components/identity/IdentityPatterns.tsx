import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "../shared/Card";
import { Badge } from "../shared/Badge";
import { ConfidenceGauge } from "../viz/ConfidenceGauge";
import type { Hypothesis, PatternSummary } from "../../types";

interface IdentityPatternsProps {
  hypotheses: Hypothesis[];
  patterns: PatternSummary[];
}

export function IdentityPatterns({ hypotheses, patterns }: IdentityPatternsProps) {
  const activeHypotheses = hypotheses.filter(h => h.status !== "REJECTED" && h.status !== "STALE");
  const topPatterns = patterns.slice(0, 3); // Show top 3 patterns

  if (activeHypotheses.length === 0 && patterns.length === 0) {
    return (
       <Card>
         <CardContent className="py-8 text-center text-ink-3">
           <p>Patterns will emerge as Drofbot observes your interactions.</p>
         </CardContent>
       </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
         <h2 className="font-display text-lg text-ink-1">Patterns & Hypotheses</h2>
         <Link to="/intelligence" className="text-sm text-accent hover:text-accent-highlight flex items-center gap-1">
           View Board <ArrowRight size={14} />
         </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeHypotheses.slice(0, 2).map(h => (
          <Card key={h.id}>
            <CardContent>
              <div className="flex items-start gap-4">
                <ConfidenceGauge confidence={h.confidence} size={48} />
                <div>
                   <h3 className="text-sm font-medium text-ink-1 mb-1">{h.statement}</h3>
                   <div className="flex items-center gap-2">
                      <Badge variant={h.status === 'CONFIRMED' ? 'success' : 'warning'} dot>
                        {h.status}
                      </Badge>
                      <span className="text-xs text-ink-3">{h.type}</span>
                   </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {topPatterns.length > 0 && (
        <Card>
           <CardContent>
             <h3 className="text-sm font-medium text-ink-2 mb-3 uppercase tracking-wider">Detected Patterns</h3>
             <div className="space-y-3">
               {topPatterns.map((p, i) => (
                 <div key={i} className="flex items-center justify-between py-2 border-b border-border-subtle last:border-0">
                    <span className="text-sm text-ink-1">{p.statement || p.type}</span>
                    <Badge variant="accent">{Math.round((p.confidence || 0) * 100)}%</Badge>
                 </div>
               ))}
             </div>
           </CardContent>
        </Card>
      )}
    </div>
  );
}
