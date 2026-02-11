import { useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { useIdentityStore } from "../stores/identity";
import {
  IdentityCore,
  IdentityEvolution,
  IdentityJourney,
  IdentityMemory,
  IdentityPatterns,
  IdentityPortrait,
  IdentityRelationship,
  IdentityVoice,
} from "../components/identity";
import { LoadingPulse } from "../components/shared/LoadingPulse";

export function Identity() {
  const store = useIdentityStore();
  
  useEffect(() => {
    store.fetch();
  }, [store.fetch]);

  const handleRefresh = () => {
    store.fetch(true);
  };

  if (store.error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-ink-2 space-y-4">
        <AlertTriangle className="w-8 h-8 text-warning" />
        <p>Failed to load identity data</p>
        <button 
          onClick={() => store.fetch(true)}
          className="px-4 py-2 bg-surface-raised hover:bg-surface-highlight rounded text-ink-1 text-sm border border-border-subtle transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-medium text-ink-1 mb-2">The Reflection</h1>
          <p className="text-ink-2 max-w-2xl">
            The system's living understanding of who you are, evolving with every interaction.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={store.isLoading}
          className="p-2 text-ink-3 hover:text-ink-1 hover:bg-surface-highlight rounded-full transition-all"
          title="Refresh Data"
        >
          <RefreshCw className={`w-5 h-5 ${store.isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {store.isLoading && !store.lastFetched ? (
        <LoadingPulse />
      ) : (
        <div className="space-y-12">
          {/* Section 1: Evolution & Timeline */}
          <section>
             <IdentityEvolution 
               depth={store.depthOfUnderstanding} 
               milestones={store.milestones} 
             />
          </section>

          {/* Section 2: Core Identity & Portrait */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="space-y-8">
              <IdentityCore profile={store.profile} />
              <IdentityPortrait vault={store.vault} />
            </section>
            
            <section className="space-y-8">
               <IdentityVoice voice={store.voice} />
               <IdentityRelationship relationship={store.relationship} />
            </section>
          </div>

          {/* Section 3: Intelligence & Patterns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="space-y-8">
               <IdentityPatterns hypotheses={store.hypotheses} patterns={store.patterns} />
            </section>
            
            <section className="space-y-8">
               <IdentityMemory memory={store.memory} />
               <IdentityJourney stats={store.progression.stats} quests={store.progression.quests} />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
