import { Card, CardContent } from "../shared/Card";
import type { MemoryStats } from "../../types/identity";

interface IdentityMemoryProps {
  memory: MemoryStats | null;
}

export function IdentityMemory({ memory }: IdentityMemoryProps) {
  if (!memory?.stats) return null;

  const banks = [
    { id: "episodic", label: "Episodic", count: memory.stats.episodic.count, color: "bg-blue-500" },
    { id: "semantic", label: "Semantic", count: memory.stats.semantic.count, color: "bg-purple-500" },
    { id: "procedural", label: "Procedural", count: memory.stats.procedural.count, color: "bg-emerald-500" },
    { id: "relational", label: "Relational", count: memory.stats.relational.count, color: "bg-amber-500" },
  ];

  const total = banks.reduce((acc, b) => acc + b.count, 0);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg text-ink-1">Memory Landscape</h2>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-ink-2">Total Memories</span>
            <span className="text-2xl font-display text-ink-1">{total.toLocaleString()}</span>
          </div>

          <div className="space-y-4">
            {banks.map(bank => (
              <div key={bank.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-ink-1 font-medium capitalize">{bank.label}</span>
                  <span className="text-ink-3">{bank.count.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-ground-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${bank.color} transition-all duration-500 ease-out`}
                    style={{ width: `${Math.max(2, (bank.count / Math.max(1, total)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
