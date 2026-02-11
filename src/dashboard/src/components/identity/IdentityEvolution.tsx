import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent } from "../shared/Card";
import type { EvolutionMilestone } from "../../stores/identity";

interface IdentityEvolutionProps {
  depth: number;
  milestones: EvolutionMilestone[];
}

export function IdentityEvolution({ depth, milestones }: IdentityEvolutionProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 200;
    const height = 200;
    const radius = 80;
    const strokeWidth = 12;

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Background Arc
    const bgArc = d3.arc<void>()
      .innerRadius(radius - strokeWidth)
      .outerRadius(radius)
      .startAngle(0)
      .endAngle(Math.PI * 2);

    g.append("path")
      .attr("d", bgArc as any)
      .style("fill", "var(--border-subtle)")
      .style("opacity", 0.3);

    // Foreground Arc
    const fgArc = d3.arc<number>()
      .innerRadius(radius - strokeWidth)
      .outerRadius(radius)
      .startAngle(0)
      .endAngle((d: number) => (d / 100) * Math.PI * 2)
      .cornerRadius(strokeWidth / 2);

    const path = g.append("path")
      .datum(depth)
      .attr("d", fgArc as any)
      .style("fill", "var(--accent)");
      
    // Simple transition
    path.transition()
      .duration(1500)
      .attrTween("d", function(d: number) {
        const i = d3.interpolate(0, d);
        return function(t: number) {
          return fgArc(i(t)) || "";
        };
      });

    // Center Text
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.1em")
      .style("font-size", "32px")
      .style("font-family", "var(--font-display)")
      .style("font-weight", "bold")
      .style("fill", "var(--ink-1)")
      .text(`${Math.round(depth)}%`);
      
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "2.5em")
      .style("font-size", "12px")
      .style("fill", "var(--ink-3)")
      .style("text-transform", "uppercase")
      .style("letter-spacing", "0.05em")
      .text("DEPTH");

  }, [depth]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
      {/* Depth Ring */}
      <div className="flex flex-col items-center justify-center md:col-span-1 py-4">
        <div className="w-[200px] h-[200px]">
          <svg ref={svgRef} className="w-full h-full overflow-visible" />
        </div>
        <p className="text-xs text-ink-3 mt-4 text-center max-w-[200px]">
          System understanding of your identity, patterns, and cosmic signature.
        </p>
      </div>

      {/* Milestones Timeline */}
      <div className="md:col-span-2">
        <h3 className="text-sm font-medium text-ink-2 mb-4 uppercase tracking-wider">Evolution</h3>
        <Card>
          <CardContent>
            <div className="space-y-0 relative py-2">
              {/* Vertical Line */}
              <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border-subtle" />

              {milestones.length === 0 ? (
                <div className="pl-12 py-4 text-ink-3 italic">
                  No milestones recorded yet. Begin your journey.
                </div>
              ) : (
                milestones.map((m) => {
                  const isCompleted = !!m.timestamp;
                  const date = m.timestamp ? new Date(m.timestamp) : null;
                  
                  return (
                    <div key={m.id} className="relative z-10 pl-12 py-3 first:pt-0 last:pb-0 flex items-center justify-between group">
                      <div className={`absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-ground-1 ring-4 ring-ground-1 rounded-full 
                        ${isCompleted ? "text-accent" : "text-ink-3"}`}>
                        {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      </div>
                      
                      <div className="flex-1 pr-4">
                        <span className={`text-sm font-medium block ${isCompleted ? "text-ink-1" : "text-ink-3"}`}>
                          {m.label}
                        </span>
                      </div>
                      
                      {date && (
                         <span className="text-xs text-ink-3 font-mono">
                           {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                         </span>
                      )}
                      {!isCompleted && (
                        <span className="text-xs text-ink-3 italic">Upcoming</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
