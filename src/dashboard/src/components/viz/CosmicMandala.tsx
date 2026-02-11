/**
 * Cosmic Mandala — D3.js centerpiece visualization
 *
 * Circular data rosette showing all 6 council systems.
 * Concentric rings: outer ring has 6 system segments,
 * inner ring shows elemental balance, center shows overall resonance.
 *
 * Scientific instrument aesthetic — muted, restrained palette.
 * Interactive: hover/tap a segment to see detail.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────

interface SystemSegment {
  name: string;
  displayName: string;
  /** Primary value summary */
  summary: string;
  /** Element classification */
  element?: string;
  /** System-specific metric 0–1 for segment fill */
  intensity?: number;
}

interface ElementBalance {
  FIRE?: number;
  WATER?: number;
  AIR?: number;
  EARTH?: number;
  ETHER?: number;
}

interface CosmicMandalaProps {
  /** 6 council systems data */
  systems: SystemSegment[];
  /** Overall harmonic resonance 0–1 */
  overallResonance?: number;
  /** Elemental balance from HarmonicSynthesis */
  elementalBalance?: ElementBalance;
  /** Resonance type label */
  resonanceType?: string;
  /** Callback when a segment is selected */
  onSegmentSelect?: (system: SystemSegment | null) => void;
  /** Diameter in px (default 280) */
  size?: number;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────

const ELEMENT_COLORS: Record<string, string> = {
  FIRE: "#b07050",
  WATER: "#507090",
  AIR: "#90905a",
  EARTH: "#608050",
  ETHER: "#706090",
};

const SYSTEM_COLORS = [
  "#2c5a4a", // accent
  "#3d7a66", // accent-light
  "#507090", // water
  "#608050", // earth
  "#90905a", // air
  "#706090", // ether
];

// ─── Pure SVG Mandala (no D3 runtime dependency for SSR/test compat) ─

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = {
    x: cx + r * Math.cos(startAngle),
    y: cy + r * Math.sin(startAngle),
  };
  const end = {
    x: cx + r * Math.cos(endAngle),
    y: cy + r * Math.sin(endAngle),
  };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function CosmicMandala({
  systems,
  overallResonance = 0,
  elementalBalance,
  resonanceType,
  onSegmentSelect,
  size = 280,
  className = "",
}: CosmicMandalaProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 8;
  const ringWidth = 24;
  const midR = outerR - ringWidth - 4;
  const innerR = midR - 16;
  const centerR = innerR - 8;

  const segmentCount = Math.max(systems.length, 1);
  const segmentAngle = (2 * Math.PI) / segmentCount;
  const gapAngle = 0.04; // small gap between segments

  const handleSegmentClick = useCallback(
    (idx: number) => {
      if (onSegmentSelect) {
        const seg = systems[idx] ?? null;
        onSegmentSelect(hoveredIndex === idx ? null : seg);
      }
    },
    [systems, onSegmentSelect, hoveredIndex],
  );

  // D3 enhancement: attach interactive behaviors when d3 is available
  useEffect(() => {
    // If d3 is loaded globally or via import, we could enhance here.
    // For now, pure React event handlers suffice.
  }, []);

  if (systems.length === 0) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        data-testid="cosmic-mandala"
      >
        <span className="text-xs text-ink-4">No cosmic data</span>
      </div>
    );
  }

  // Build elements for elemental balance ring
  const elements = elementalBalance ? Object.entries(elementalBalance) : [];
  const elementTotal = elements.reduce((s, [, v]) => s + (v ?? 0), 0) || 1;

  const resonancePct = Math.round(overallResonance * 100);

  return (
    <div
      className={`inline-flex flex-col items-center gap-2 ${className}`}
      data-testid="cosmic-mandala"
    >
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Cosmic Mandala showing all council systems"
      >
        {/* Background circle */}
        <circle
          cx={cx}
          cy={cy}
          r={outerR + 2}
          fill="var(--surface-raised, #fff)"
          stroke="var(--border-subtle, #ebe8e1)"
          strokeWidth={1}
        />

        {/* Outer ring — system segments */}
        {systems.map((sys, i) => {
          const startA = i * segmentAngle - Math.PI / 2 + gapAngle / 2;
          const endA = (i + 1) * segmentAngle - Math.PI / 2 - gapAngle / 2;
          const midA = (startA + endA) / 2;
          const intensity = sys.intensity ?? 0.5;
          const isHovered = hoveredIndex === i;
          const color = SYSTEM_COLORS[i % SYSTEM_COLORS.length];

          // Label position
          const labelR = outerR - ringWidth / 2;
          const lx = cx + labelR * Math.cos(midA);
          const ly = cy + labelR * Math.sin(midA);

          return (
            <g
              key={sys.name}
              data-testid={`mandala-segment-${sys.name}`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => handleSegmentClick(i)}
              style={{ cursor: "pointer" }}
            >
              {/* Segment arc */}
              <path
                d={describeArc(cx, cy, outerR - ringWidth / 2, startA, endA)}
                fill="none"
                stroke={color}
                strokeWidth={ringWidth}
                strokeLinecap="butt"
                opacity={isHovered ? 1 : intensity * 0.7 + 0.3}
                className="transition-opacity duration-150"
              />
              {/* Label */}
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--surface-raised, #fff)"
                fontSize="8"
                fontWeight="600"
                fontFamily="var(--font-body)"
                style={{ pointerEvents: "none" }}
              >
                {sys.displayName.slice(0, 6)}
              </text>
            </g>
          );
        })}

        {/* Middle ring — elemental balance */}
        {elements.length > 0 &&
          (() => {
            let cumAngle = -Math.PI / 2;
            return elements.map(([el, val]) => {
              const elAngle = ((val ?? 0) / elementTotal) * 2 * Math.PI;
              const startA = cumAngle;
              const endA = cumAngle + elAngle;
              cumAngle = endA;
              const color = ELEMENT_COLORS[el] ?? "#888";
              return (
                <path
                  key={el}
                  d={describeArc(cx, cy, midR, startA, endA)}
                  fill="none"
                  stroke={color}
                  strokeWidth={8}
                  strokeLinecap="butt"
                  opacity={0.6}
                  data-testid={`mandala-element-${el.toLowerCase()}`}
                />
              );
            });
          })()}

        {/* Center — resonance */}
        <circle
          cx={cx}
          cy={cy}
          r={centerR}
          fill="var(--surface-raised, #fff)"
          stroke="var(--border, #e0dbd2)"
          strokeWidth={1}
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          dominantBaseline="auto"
          fill="var(--ink-1, #1a1816)"
          fontSize="18"
          fontWeight="600"
          fontFamily="var(--font-body)"
          data-testid="mandala-resonance"
        >
          {resonancePct}%
        </text>
        {resonanceType && (
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            dominantBaseline="auto"
            fill="var(--ink-3, #8a8580)"
            fontSize="8"
            fontFamily="var(--font-body)"
          >
            {resonanceType}
          </text>
        )}
      </svg>

      {/* Hover detail */}
      {hoveredIndex != null && systems[hoveredIndex] && (
        <div
          className="text-center px-3 py-1.5 bg-surface-raised border border-border-subtle rounded-card shadow-card"
          data-testid="mandala-tooltip"
        >
          <span className="text-xs font-medium text-ink-1">
            {systems[hoveredIndex].displayName}
          </span>
          <p className="text-xs text-ink-3 mt-0.5">{systems[hoveredIndex].summary}</p>
        </div>
      )}
    </div>
  );
}

export default CosmicMandala;
