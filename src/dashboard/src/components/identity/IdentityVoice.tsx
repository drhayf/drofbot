import * as d3 from "d3";
import { useEffect, useRef, useMemo } from "react";
import type { VoiceProfile } from "../../types/identity";
import { Card, CardContent } from "../shared/Card";

interface IdentityVoiceProps {
  voice: VoiceProfile | null;
}

export function IdentityVoice({ voice }: IdentityVoiceProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Memoize data processing to avoid regen on every render
  const data = useMemo(() => {
    if (!voice?.profile) return [];

    // API returns flat properties, not an 'analysis' object
    // Build radar data from available numeric metrics
    const profile = voice.profile as Record<string, unknown>;
    const metrics: { axis: string; value: number }[] = [];

    // formalityLevel is already 0-1
    if (typeof profile.formalityLevel === "number") {
      metrics.push({ axis: "Formality", value: profile.formalityLevel });
    }

    // avgSentenceLength - normalize to 0-1 (typical range 5-30)
    if (typeof profile.avgSentenceLength === "number") {
      metrics.push({ axis: "Sentence Length", value: Math.min(profile.avgSentenceLength / 30, 1) });
    }

    // conversationsAnalyzed - normalize to 0-1 (scale up to 100)
    if (typeof profile.conversationsAnalyzed === "number") {
      metrics.push({ axis: "Experience", value: Math.min(profile.conversationsAnalyzed / 100, 1) });
    }

    // vocabularyPreferences count - normalize to 0-1 (scale up to 50)
    if (Array.isArray(profile.vocabularyPreferences)) {
      metrics.push({
        axis: "Vocabulary",
        value: Math.min(profile.vocabularyPreferences.length / 50, 1),
      });
    }

    // uniqueExpressions count - normalize to 0-1 (scale up to 20)
    if (Array.isArray(profile.uniqueExpressions)) {
      metrics.push({
        axis: "Expressions",
        value: Math.min(profile.uniqueExpressions.length / 20, 1),
      });
    }

    return metrics;
  }, [voice]);

  useEffect(() => {
    if (!data.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    const width = 300;
    const height = 300;
    const margin = 40;
    const radius = Math.min(width, height) / 2 - margin;

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Scales
    const rScale = d3.scaleLinear().range([0, radius]).domain([0, 1]);
    const angleSlice = (Math.PI * 2) / data.length;

    // Background circles (grid)
    const levels = 4;
    for (let i = 0; i < levels; i++) {
      const levelFactor = radius * ((i + 1) / levels);
      g.selectAll(".levels")
        .data([1])
        .enter()
        .append("circle")
        .attr("r", levelFactor)
        .style("fill", "none")
        .style("stroke", "var(--border-subtle)")
        .style("stroke-opacity", "0.5");
    }

    // Axis lines
    const axes = g.selectAll(".axis").data(data).enter().append("g").attr("class", "axis");

    axes
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", (_d, i) => rScale(1.1) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr("y2", (_d, i) => rScale(1.1) * Math.sin(angleSlice * i - Math.PI / 2))
      .style("stroke", "var(--border-subtle)")
      .style("stroke-width", "1px");

    // Axis labels
    axes
      .append("text")
      .attr("class", "legend")
      .style("font-size", "10px")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("x", (_d, i) => rScale(1.25) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr("y", (_d, i) => rScale(1.25) * Math.sin(angleSlice * i - Math.PI / 2))
      .text((d) => d.axis)
      .style("fill", "var(--ink-2)");

    // The Radar Shape
    const radarLine = d3
      .lineRadial<{ axis: string; value: number }>()
      .radius((d) => rScale(d.value))
      .angle((_d, i) => i * angleSlice)
      .curve(d3.curveLinearClosed);

    // Draw the path
    g.append("path")
      .datum(data)
      .attr("d", radarLine)
      .style("stroke-width", 2)
      .style("stroke", "var(--accent)")
      .style("fill", "var(--accent)")
      .style("fill-opacity", 0.2);

    // Draw the points
    g.selectAll(".dot")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d, i) => rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr("cy", (d, i) => rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2))
      .attr("r", 3)
      .style("fill", "var(--accent)");
  }, [data]);

  if (!voice?.profile) return null;

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg text-ink-1">Communication Signature</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="flex items-center justify-center py-6">
            <svg ref={svgRef} className="w-full max-w-[300px] h-auto overflow-visible" />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent>
              <h3 className="text-sm font-medium text-ink-2 mb-2 uppercase tracking-wider">
                Dominant Tone
              </h3>
              {/* API returns toneDescription, not dominantTone */}
              <p className="text-lg text-ink-1 font-medium">
                {((voice.profile as Record<string, unknown>).toneDescription as string) ??
                  "Not yet established"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h3 className="text-sm font-medium text-ink-2 mb-2 uppercase tracking-wider">
                Descriptors
              </h3>
              <div className="flex flex-wrap gap-2">
                {/* API returns uniqueExpressions, not descriptors */}
                {(
                  ((voice.profile as Record<string, unknown>).uniqueExpressions as string[]) ?? []
                ).map((d) => (
                  <span
                    key={d}
                    className="px-2 py-1 bg-surface-raised rounded text-sm text-ink-1 border border-border-subtle"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
