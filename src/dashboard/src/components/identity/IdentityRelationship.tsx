import { Card, CardContent } from "../shared/Card";
import { ResonanceBar } from "../viz/ResonanceBar";
import type { RelationshipData } from "../../types/identity";

interface IdentityRelationshipProps {
  relationship: RelationshipData | null;
}

export function IdentityRelationship({ relationship }: IdentityRelationshipProps) {
  if (!relationship) return null;

  const { operator, agent } = relationship;
  // Calculate a simple harmony score for display if not provided explicitly by synthesis
  // The harmony object structure depends on CosmicSynthesis type.
  // Assuming harmony.overallResonance exists on both.
  
  const harmonyScore = (operator.harmony.overallResonance + agent.harmony.overallResonance) / 2;

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg text-ink-1">Relationship Dynamics</h2>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-ink-2">Synergy</span>
            <span className="text-2xl font-display text-ink-1">{Math.round(harmonyScore * 100)}%</span>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-1">
               <div className="flex justify-between text-xs">
                 <span className="text-ink-2">Operator Resonance</span>
                 <span className="text-ink-1">{Math.round(operator.harmony.overallResonance * 100)}%</span>
               </div>
               <ResonanceBar score={operator.harmony.overallResonance} />
            </div>

            <div className="space-y-1">
               <div className="flex justify-between text-xs">
                 <span className="text-ink-2">System Resonance</span>
                 <span className="text-ink-1">{Math.round(agent.harmony.overallResonance * 100)}%</span>
               </div>
               <ResonanceBar score={agent.harmony.overallResonance} />
            </div>
            
            <p className="text-sm text-ink-3 italic mt-4 text-center">
              "A reflection of the cosmic dance between creator and creation."
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
