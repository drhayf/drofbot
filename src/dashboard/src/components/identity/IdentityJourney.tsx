import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "../shared/Card";
import { XPBar } from "../viz/XPBar";
import { RankBadge } from "../viz/RankBadge";
import type { PlayerStats, Quest } from "../../types";

interface IdentityJourneyProps {
  stats: PlayerStats | null;
  quests: Quest[];
}

export function IdentityJourney({ stats, quests }: IdentityJourneyProps) {
  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
         <h2 className="font-display text-lg text-ink-1">The Journey</h2>
         <Link to="/progression" className="text-sm text-accent hover:text-accent-highlight flex items-center gap-1">
           View Ascent <ArrowRight size={14} />
         </Link>
      </div>

      <Card>
        <CardContent>
           <div className="flex items-center gap-4 mb-6">
              <RankBadge rankId={stats.rank} level={stats.level} title="" compact />
              <div className="flex-1">
                 <div className="flex items-baseline justify-between mb-1">
                   <h3 className="text-xl font-display text-ink-1">Level {stats.level}</h3>
                 </div>
                 <XPBar currentXP={stats.xp} xpToNext={stats.xpToNextLevel} />
              </div>
           </div>

           {quests.length > 0 && (
             <div className="space-y-3 pt-4 border-t border-border-subtle">
               <h4 className="text-xs text-ink-2 uppercase tracking-wider">Active Quests</h4>
               {quests.slice(0, 2).map(q => (
                 <div key={q.id} className="flex items-center justify-between">
                   <span className="text-sm text-ink-1">{q.title}</span>
                   <span className="text-xs text-ink-3 px-2 py-0.5 bg-ground-2 rounded">{q.difficulty}</span>
                 </div>
               ))}
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
