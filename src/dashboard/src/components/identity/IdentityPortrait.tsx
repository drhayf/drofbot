import { Card, CardContent } from "../shared/Card";
import type { VaultSynthesis } from "../../types/identity";

interface IdentityPortraitProps {
  vault: VaultSynthesis | null;
}

export function IdentityPortrait({ vault }: IdentityPortraitProps) {
  if (!vault?.synthesis || !vault.synthesis.narrative) {
    return null;
  }

  const { narrative, overview, dataPoints, lastUpdated } = vault.synthesis;
  const timeAgo = lastUpdated
    ? Math.round((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60))
    : null;

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg text-ink-1">The Living Portrait</h2>
      <Card>
        <CardContent className="space-y-6">
          {/* Metadata Header */}
          <div className="flex items-center gap-4 text-xs text-ink-3 border-b border-border-subtle pb-4">
             {dataPoints !== undefined && (
               <span>Synthesized from {dataPoints} data points</span>
             )}
             {timeAgo !== null && (
               <span>• Last updated {timeAgo}h ago</span>
             )}
          </div>

          {/* Narrative Body */}
          <div className="prose prose-sm prose-invert max-w-none">
             {overview && <p className="lead text-ink-1 font-medium">{overview}</p>}
             <div className="text-ink-2 whitespace-pre-wrap leading-relaxed">
               {narrative}
             </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
