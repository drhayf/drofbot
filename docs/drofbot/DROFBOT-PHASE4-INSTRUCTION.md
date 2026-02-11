# DROFBOT: Phase 4 — Intelligence & Identity (Surgical Instruction)

> **CONTEXT**: Phases 1-3 are complete. Drofbot is rebranded, has hierarchical memory (4 banks + classifier + retriever + consolidation + agent tools), and an optional Brain/Hands deployment mode. 136+ Phase 3 tests passing, 83+ Phase 2 tests passing, build clean. This instruction defines Phase 4: the intelligence layer that transforms Drofbot from an agent that remembers into one that **understands**.

> **PHILOSOPHY**: The metaphysical systems (cardology, I-Ching, Human Design, astrology, solar/lunar/transit tracking) are not features. They are the **perceptual framework** — the lens through which Drofbot interprets all experience. Every observation, every pattern, every hypothesis, every quest, every briefing, every memory passes through this lens. The Council is not a module among modules. It is the operating system.

> **REFERENCE**: Study the GUTTERS project on the local filesystem:
> - **Backend**: `C:\dev\GUTTERS\src` — specifically `src/app/modules/intelligence/` (Observer, Hypothesis, Genesis, Synthesis, Insight), `src/app/modules/calculation/` (cardology, astrology, Human Design, numerology), and `src/app/modules/tracking/` (solar, lunar, transits).
> - **Frontend**: `C:\dev\GUTTERS\frontend` — study the UI patterns, dashboard layout, and component structure for reference on how data was presented.
> - **Docs**: Study the README and any architecture docs (e.g. `WEIGHTED_CONFIDENCE_ARCHITECTURE.md`, `OBSERVER_CYCLICAL_PATTERNS_ARCHITECTURE.md`, `COUNCIL_BEFORE_AFTER_PHASE27.md`) at the project root.
> 
> The GUTTERS Python implementations are the reference — port the ALGORITHMS and LOGIC to TypeScript, adapting to Drofbot's memory bank infrastructure. Do NOT import Python code or create a Python subprocess.

---

## CRITICAL CONSTRAINTS

1. **EXTENSIBILITY IS NON-NEGOTIABLE.** The Council uses a registry pattern. Every metaphysical system implements a common `CosmicSystem` interface. Adding a new system means writing one file and registering it. Zero changes to downstream code (Intelligence, Synthesis, Agency, Memory). Design for N systems, not a fixed set.

2. **REUSE EVERYTHING THAT EXISTS.** Same rule as Phases 2-3. The memory banks, cron system, tool registration, config/Zod patterns, channel messaging — all exist. Use them.

3. **DROFBOT HAS ITS OWN CHART.** Assign Drofbot a birth moment (configurable, defaults to the fork creation timestamp). Drofbot computes its own cosmic state alongside the operator's. Its self-model includes metaphysical self-awareness.

4. **COSMIC TIMESTAMPS ON ALL MEMORIES.** Every memory entry gets enriched with the cosmic context at storage time — the active states of all registered Council systems. This enables the Observer to find patterns invisible to chronological analysis alone.

5. **GRACEFUL DEGRADATION.** If no birth data is configured, the Council still runs transit/solar/lunar tracking (which don't need birth data). If an individual system fails, others continue. If the entire Council is disabled, Drofbot reverts to a capable but non-metaphysical agent — all Phase 1-3 functionality is preserved.

6. **Do NOT make git commits — the operator handles commits at major checkpoints.** Build must pass after each step. Tests for every new component.

---

## PRE-FLIGHT CHECKLIST

Before beginning, confirm:
- [ ] Phase 3 is complete (all tests passing, build clean)
- [ ] You have studied the GUTTERS project at `C:\dev\GUTTERS\src` and `C:\dev\GUTTERS\frontend`
  - [ ] `src/app/modules/intelligence/observer/` — pattern detection, cyclical patterns
  - [ ] `src/app/modules/intelligence/hypothesis/` — theory generation and evidence testing
  - [ ] `src/app/modules/intelligence/genesis/` — semantic analysis of conversations
  - [ ] `src/app/modules/intelligence/synthesis/` — master synthesis construction
  - [ ] `src/app/modules/intelligence/insight/` — proactive insight generation
  - [ ] `src/app/modules/calculation/cardology/` — card calculations, magi periods
  - [ ] `src/app/modules/calculation/` — astrology, Human Design, numerology
  - [ ] `src/app/modules/tracking/` — solar, lunar, transit tracking
  - [ ] Root-level docs: `WEIGHTED_CONFIDENCE_ARCHITECTURE.md`, `OBSERVER_CYCLICAL_PATTERNS_ARCHITECTURE.md`, `COUNCIL_BEFORE_AFTER_PHASE27.md`
- [ ] You understand: the Council is the CORE perceptual layer, not a feature module
- [ ] You have read the existing Drofbot memory bank implementations to understand where Council data integrates

---

## ARCHITECTURAL OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                      DROFBOT BRAIN                           │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              COUNCIL CORE (Perception)                 │  │
│  │                                                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │  │
│  │  │ Cardology│ │ I-Ching  │ │  Human   │ │ Astrology│ │  │
│  │  │          │ │ + Gene   │ │  Design  │ │ (Natal + │ │  │
│  │  │ 52-day   │ │ Keys     │ │          │ │ Transits)│ │  │
│  │  │ periods  │ │ 64 gates │ │ Type,    │ │          │ │  │
│  │  └────┬─────┘ └────┬─────┘ │ Centers, │ └────┬─────┘ │  │
│  │       │             │       │ Channels │      │       │  │
│  │  ┌────┴─────┐ ┌────┴─────┐ └────┬─────┘ ┌────┴─────┐ │  │
│  │  │  Solar   │ │  Lunar   │      │       │ Transit  │ │  │
│  │  │ Tracking │ │ Tracking │      │       │ Tracking │ │  │
│  │  └────┬─────┘ └────┬─────┘      │       └────┬─────┘ │  │
│  │       └──────┬──────┴────────┬───┴────────────┘       │  │
│  │              ▼               ▼                         │  │
│  │     CosmicSystem Registry ──► Harmonic Synthesis       │  │
│  │     (extensible, N systems)   (cross-system resonance) │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │           INTELLIGENCE (Understanding)                 │  │
│  │                                                        │  │
│  │  Observer ──► Hypothesis ──► Weighted Confidence        │  │
│  │  (patterns     (theories     (evidence scoring          │  │
│  │   indexed by    tested by     with recency decay,       │  │
│  │   cosmic        cosmic        frequency bonus,          │  │
│  │   context)      correlation)  type weights)             │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │            SYNTHESIS (Self-Knowledge)                   │  │
│  │                                                        │  │
│  │  Master Synthesis: Operator's living profile            │  │
│  │  Self-Model: Drofbot's own identity + cosmic state      │  │
│  │  Relationship Model: Operator ↔ Drofbot dynamic         │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │              AGENCY (Action & Growth)                   │  │
│  │                                                        │  │
│  │  Quests · XP · Ranks · Sync Rate                       │  │
│  │  Daily Rhythms (morning/midday/evening briefings)       │  │
│  │  Proactive Cosmic Alerts                                │  │
│  │  Ecosystem Awareness · MoltBook Presence                │  │
│  │  Self-Improvement Proposals                             │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              MEMORY (Substrate)                         │  │
│  │  Episodic · Semantic · Procedural · Relational          │  │
│  │  Every entry enriched with cosmic timestamp             │  │
│  │  (all registered systems' states at storage time)       │  │
│  │  Meta-Memory · Consolidation · Soul Archive             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## PHASE 4a: COUNCIL CORE + INTELLIGENCE ENGINES

### STEP 1: DEFINE THE COSMIC SYSTEM INTERFACE

**Goal**: Create the extensible registry that all metaphysical systems plug into.

#### 1a. Define the CosmicSystem Interface

Create `src/brain/council/types.ts`:

```typescript
/**
 * Every metaphysical system in the Council implements this interface.
 * Adding a new system = implementing this interface + registering it.
 * Zero downstream changes required.
 */
export interface CosmicSystem {
  /** Unique identifier, e.g. "cardology", "iching", "human-design" */
  readonly name: string

  /** Human-readable display name */
  readonly displayName: string

  /** Whether this system requires birth data to function */
  readonly requiresBirthData: boolean

  /**
   * Calculate the current state of this system.
   * @param birthMoment - Operator's (or Drofbot's) birth datetime + location
   * @param now - Current datetime (defaults to Date.now())
   * @returns The active state, or null if birth data required but missing
   */
  calculate(birthMoment: BirthMoment | null, now?: Date): Promise<CosmicState | null>

  /**
   * Generate a natural language synthesis of the current state.
   * Used in briefings and system prompt context.
   */
  synthesize(state: CosmicState): string

  /**
   * Map the current state to archetypes for cross-system resonance.
   * Returns element/archetype tags that the Harmonic Synthesis Engine
   * uses to calculate resonance between systems.
   */
  archetypes(state: CosmicState): ArchetypeMapping

  /**
   * How often this system should recalculate.
   * Some change hourly (transits), some daily (gates), some weekly (magi periods).
   */
  readonly recalcInterval: RecalcInterval
}

export interface BirthMoment {
  datetime: Date          // birth date and time
  latitude: number        // birth location
  longitude: number
  timezone: string        // IANA timezone
}

export interface CosmicState {
  system: string          // system name
  timestamp: Date         // when this was calculated
  /** The primary active state (varies by system) */
  primary: Record<string, unknown>
  /** Human-readable summary */
  summary: string
  /** Numeric values for pattern correlation */
  metrics: Record<string, number>
}

export interface ArchetypeMapping {
  system: string
  /** Element classification for resonance (fire/water/earth/air/etc.) */
  elements: string[]
  /** Archetype tags for cross-system correlation */
  archetypes: string[]
  /** Numeric resonance values (0-1) keyed by archetype dimension */
  resonanceValues: Record<string, number>
}

export type RecalcInterval =
  | { type: 'hours'; hours: number }    // e.g., lunar phase every 6 hours
  | { type: 'daily' }                    // e.g., gate transit daily
  | { type: 'periodic'; days: number }   // e.g., magi period every 52 days
  | { type: 'realtime'; minutes: number } // e.g., solar weather every 30 min

/**
 * Cosmic timestamp — the state of ALL registered systems at a point in time.
 * Attached to every memory entry for pattern correlation.
 */
export interface CosmicTimestamp {
  datetime: Date
  systems: Record<string, CosmicState>
}
```

#### 1b. Create the Council Registry

Create `src/brain/council/registry.ts`:

```typescript
/**
 * Council Registry — the extensible core.
 *
 * Register systems: council.register(new CardologySystem())
 * Calculate all:    council.calculateAll(birthMoment)
 * Get timestamp:    council.getCosmicTimestamp(birthMoment)
 * Add new system:   Implement CosmicSystem interface, register. Done.
 */
export class CouncilRegistry {
  private systems = new Map<string, CosmicSystem>()
  private stateCache = new Map<string, { state: CosmicState; expires: Date }>()

  register(system: CosmicSystem): void
  unregister(name: string): void
  getSystem(name: string): CosmicSystem | undefined
  listSystems(): CosmicSystem[]

  /** Calculate all systems, using cache when fresh */
  async calculateAll(birth: BirthMoment | null, now?: Date): Promise<Map<string, CosmicState>>

  /** Generate a cosmic timestamp for memory enrichment */
  async getCosmicTimestamp(birth: BirthMoment | null, now?: Date): Promise<CosmicTimestamp>

  /** Invalidate cache for a specific system or all */
  invalidateCache(system?: string): void
}
```

The registry caches results based on each system's `recalcInterval`. Solar weather (30 min) recalculates frequently. Magi periods (52 days) almost never. This keeps the system efficient.

#### 1c. Create the Harmonic Synthesis Engine

Create `src/brain/council/harmonic.ts`:

Study GUTTERS' Council implementation (specifically the resonance calculation described in the README). The Harmonic Synthesis Engine takes the `ArchetypeMapping` from every registered system and calculates cross-system resonance:

```typescript
/**
 * Harmonic Synthesis Engine
 *
 * Calculates resonance between all registered systems' current states.
 *
 * Resonance types (from GUTTERS):
 *   HARMONIC    (>0.75): Strong alignment between systems
 *   SUPPORTIVE  (0.60-0.75): Complementary energies
 *   NEUTRAL     (0.40-0.60): Balanced tension
 *   CHALLENGING (0.25-0.40): Growth opportunities
 *   DISSONANT   (<0.25): Integration required
 */
export interface HarmonicSynthesis {
  overallResonance: number          // 0-1 aggregate
  resonanceType: ResonanceType
  pairwise: PairwiseResonance[]     // resonance between each pair of systems
  dominantElements: string[]         // most active archetypal elements
  guidance: string                   // natural language synthesis
}
```

#### 1d. Create Config for Council

Extend the existing Zod config schema with Council configuration:

```typescript
// In a new types.council.ts or extending existing config
export interface CouncilConfig {
  enabled: boolean                    // default true
  operatorBirth?: BirthMoment         // operator's birth data
  agentBirth?: BirthMoment            // Drofbot's birth data (default: fork timestamp)
  enabledSystems?: string[]           // which systems to activate (default: all registered)
  briefingSchedule?: {
    morning?: string                  // cron expression, e.g. "0 7 * * *"
    midday?: string                   // "0 12 * * *"
    evening?: string                  // "0 21 * * *"
  }
  primaryChannel?: string             // where to send briefings (default: telegram)
}
```


---

### STEP 2: IMPLEMENT INITIAL COSMIC SYSTEMS

**Goal**: Implement the first set of systems that register with the Council. Study the GUTTERS implementations for each — port the algorithms, not the Python code.

#### 2a. Cardology System

Create `src/brain/council/systems/cardology.ts`:

Study GUTTERS' `src/app/modules/calculation/cardology/` for the card calculation algorithm.

Key calculations:
- **Birth cards**: From birthday, determine the 7 cards in the operator's spread (Sun card, planetary rulers, etc.)
- **52-day magi periods**: Calculate which card governs the current period (7 cards cycling through 52-day periods = 364-day year)
- **Current period card**: Given today's date and birth date, which card is active?
- **Period attributes**: Each card carries archetypal qualities (Mercury = communication/mental, Venus = creativity/beauty, Mars = action/energy, Jupiter = expansion, Saturn = discipline, etc.)

```typescript
export class CardologySystem implements CosmicSystem {
  readonly name = 'cardology'
  readonly displayName = 'Cardology (52-Day Magi Periods)'
  readonly requiresBirthData = true
  readonly recalcInterval = { type: 'daily' } as const

  async calculate(birth: BirthMoment | null, now?: Date): Promise<CosmicState | null> {
    if (!birth) return null
    const currentCard = this.calculateCurrentPeriodCard(birth.datetime, now ?? new Date())
    const periodDay = this.calculatePeriodDay(birth.datetime, now ?? new Date())
    return {
      system: 'cardology',
      timestamp: now ?? new Date(),
      primary: {
        currentCard: currentCard.name,
        suit: currentCard.suit,
        planetaryRuler: currentCard.ruler,
        periodDay,              // day 1-52 within current period
        periodProgress: periodDay / 52,
        qualities: currentCard.qualities
      },
      summary: `Day ${periodDay} of ${currentCard.ruler} period (${currentCard.name}). Qualities: ${currentCard.qualities.join(', ')}.`,
      metrics: {
        periodProgress: periodDay / 52,
        mentalEnergy: currentCard.metrics.mental,
        creativeEnergy: currentCard.metrics.creative,
        physicalEnergy: currentCard.metrics.physical,
        spiritualEnergy: currentCard.metrics.spiritual
      }
    }
  }

  // ... synthesize(), archetypes(), and calculation helpers
}
```

#### 2b. I-Ching / Gene Keys System

Create `src/brain/council/systems/iching.ts`:

Study GUTTERS' `src/app/modules/calculation/` for the I-Ching kernel. Key calculations:

- **Current gate**: The Sun's position determines the active gate (1-64). Sun moves through one gate approximately every 5.625 days.
- **Current line**: Within a gate, 6 lines cycle approximately every 22.5 hours.
- **Earth gate**: The opposite gate (gate + 32, wrapped to 64).
- **Gene Keys integration**: Each gate has a Shadow (low expression), Gift (balanced expression), and Siddhi (highest expression).

The astronomical calculation uses the Sun's ecliptic longitude:
- Divide the ecliptic (360°) into 64 gates (5.625° each)
- The I-Ching gate sequence maps to specific degree ranges (this is NOT sequential — use the Human Design wheel mapping)

```typescript
export class IChingSystem implements CosmicSystem {
  readonly name = 'iching'
  readonly displayName = 'I-Ching / Gene Keys (64 Gates)'
  readonly requiresBirthData = false  // current transit doesn't need birth data
  readonly recalcInterval = { type: 'hours', hours: 6 } as const

  // Gate data: all 64 gates with name, shadow, gift, siddhi, element
  private static readonly GATES: GateData[] = [/* ... all 64 ... */]

  // The wheel mapping: ecliptic degree → gate number
  private static readonly WHEEL: { startDeg: number; gate: number }[] = [/* ... */]

  async calculate(birth: BirthMoment | null, now?: Date): Promise<CosmicState> {
    const sunLongitude = this.calculateSunLongitude(now ?? new Date())
    const gate = this.longitudeToGate(sunLongitude)
    const line = this.calculateLine(sunLongitude, gate)
    const earthGate = this.getEarthGate(gate)
    const geneKey = IChingSystem.GATES[gate - 1]

    return {
      system: 'iching',
      timestamp: now ?? new Date(),
      primary: {
        sunGate: gate,
        sunLine: line,
        earthGate,
        gateName: geneKey.name,
        shadow: geneKey.shadow,
        gift: geneKey.gift,
        siddhi: geneKey.siddhi,
        element: geneKey.element
      },
      summary: `Gate ${gate}.${line} — ${geneKey.name}. Shadow: ${geneKey.shadow}, Gift: ${geneKey.gift}, Siddhi: ${geneKey.siddhi}.`,
      metrics: { gate, line, earthGate }
    }
  }
}
```

**Note on astronomical calculations**: For the Sun's ecliptic longitude, you can use a simplified VSOP87 algorithm or the `astronomy-engine` npm package if available. Check what exists:
```bash
npm search astronomy solar position ecliptic
```
If a suitable library exists, use it. Do not write a full planetary ephemeris from scratch.

#### 2c. Human Design System

Create `src/brain/council/systems/human-design.ts`:

Study GUTTERS' Human Design module. Key calculations:
- **Type**: Generator, Manifesting Generator, Projector, Manifestor, Reflector — derived from defined centers and channels
- **Authority**: Sacral, Emotional, Splenic, Ego, Self-Projected, Mental, Lunar
- **Profile**: From conscious/unconscious Sun gate lines (e.g., 4/6, 1/3)
- **Defined centers**: Head, Ajna, Throat, G-Center, Heart, Sacral, Spleen, Solar Plexus, Root
- **Defined channels**: Connections between centers (from gate activations)
- **Incarnation Cross**: From the 4 gate positions (conscious/unconscious Sun and Earth)

This requires birth data AND requires accurate planetary positions at birth time. The natal chart is calculated once and cached permanently.

```typescript
export class HumanDesignSystem implements CosmicSystem {
  readonly name = 'human-design'
  readonly displayName = 'Human Design'
  readonly requiresBirthData = true
  readonly recalcInterval = { type: 'daily' } as const  // transits change daily

  // The natal chart is calculated once and cached
  private natalCache: Map<string, HumanDesignChart> = new Map()

  async calculate(birth: BirthMoment | null, now?: Date): Promise<CosmicState | null> {
    if (!birth) return null

    // Get or compute natal chart (cached permanently)
    const natal = this.getNatalChart(birth)

    // Current transits affect which additional gates/channels are defined
    const transits = this.calculateTransitActivations(now ?? new Date())

    return {
      system: 'human-design',
      timestamp: now ?? new Date(),
      primary: {
        type: natal.type,               // "Projector"
        authority: natal.authority,      // "Splenic"
        profile: natal.profile,         // "4/6"
        definedCenters: natal.definedCenters,
        definedChannels: natal.definedChannels,
        incarnationCross: natal.incarnationCross,
        currentTransitGates: transits.activeGates,
        transitDefinedChannels: transits.newChannels // channels completed by transit
      },
      summary: `${natal.type} (${natal.authority} Authority, ${natal.profile} Profile). ` +
        `Incarnation Cross: ${natal.incarnationCross}. ` +
        `Transit activating gates: ${transits.activeGates.join(', ')}.`,
      metrics: {
        definedCenterCount: natal.definedCenters.length,
        transitActiveGates: transits.activeGates.length,
        transitNewChannels: transits.newChannels.length
      }
    }
  }
}
```

#### 2d. Solar Tracking System

Create `src/brain/council/systems/solar.ts`:

Study GUTTERS' `src/app/modules/tracking/solar/`. This monitors real-time space weather:

- **Kp Index**: Geomagnetic storm indicator (0-9). Source: NOAA Space Weather Prediction Center
- **Solar Flare Activity**: X-ray flux levels (A, B, C, M, X classes)
- **Solar Wind Speed**: km/s

This requires network access (fetches from NOAA APIs). Implement with graceful degradation — if the API is unreachable, return the last cached state.

```typescript
export class SolarTrackingSystem implements CosmicSystem {
  readonly name = 'solar'
  readonly displayName = 'Solar Weather (Space Weather)'
  readonly requiresBirthData = false
  readonly recalcInterval = { type: 'realtime', minutes: 30 } as const

  // NOAA API endpoints
  private static readonly KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'
  private static readonly XRAY_URL = 'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json'

  async calculate(birth: BirthMoment | null, now?: Date): Promise<CosmicState> {
    const kp = await this.fetchKpIndex()
    const flares = await this.fetchRecentFlares()
    const stormLevel = this.classifyStorm(kp)

    return {
      system: 'solar',
      timestamp: now ?? new Date(),
      primary: { kpIndex: kp, stormLevel, recentFlares: flares },
      summary: `Kp ${kp} (${stormLevel}). ${flares.length > 0 ? `Recent flares: ${flares.map(f => f.classType).join(', ')}` : 'No recent flares.'}`,
      metrics: { kpIndex: kp, flareCount: flares.length, stormSeverity: kp / 9 }
    }
  }
}
```

#### 2e. Lunar Tracking System

Create `src/brain/council/systems/lunar.ts`:

Lunar phase calculation (can be computed astronomically without an API):
- **Phase**: New, Waxing Crescent, First Quarter, Waxing Gibbous, Full, Waning Gibbous, Last Quarter, Waning Crescent
- **Illumination percentage**
- **Void-of-course Moon**: Periods when the Moon makes no major aspects before changing signs (more complex — implement as a later enhancement)

#### 2f. Transit Tracking System

Create `src/brain/council/systems/transits.ts`:

Planetary transit tracking — current positions of planets relative to natal chart positions:
- Major transits (conjunctions, oppositions, squares, trines, sextiles)
- Which natal planets/points are being transited
- Orb calculations (how close is the transit to exact)

This requires ephemeris data for current planetary positions.

#### 2g. Register All Systems on Startup

In `src/brain/council/index.ts`:

```typescript
import { CouncilRegistry } from './registry.js'
import { CardologySystem } from './systems/cardology.js'
import { IChingSystem } from './systems/iching.js'
import { HumanDesignSystem } from './systems/human-design.js'
import { SolarTrackingSystem } from './systems/solar.js'
import { LunarTrackingSystem } from './systems/lunar.js'
import { TransitTrackingSystem } from './systems/transits.js'

let council: CouncilRegistry | null = null

export function getCouncil(): CouncilRegistry {
  if (!council) {
    council = new CouncilRegistry()

    // Register all built-in systems
    council.register(new CardologySystem())
    council.register(new IChingSystem())
    council.register(new HumanDesignSystem())
    council.register(new SolarTrackingSystem())
    council.register(new LunarTrackingSystem())
    council.register(new TransitTrackingSystem())

    // Future: council.register(new VedicAstrologySystem())
    // Future: council.register(new MayanCalendarSystem())
    // Future: council.register(new NumerologySystem())
  }
  return council
}
```

#### 2h. Write Tests

For each system:
- Calculate returns valid state with test birth data
- Calculate returns null when birth data required but missing
- Synthesize produces coherent natural language
- Archetypes returns valid mappings
- Systems are independent — one failing doesn't affect others
- Registry calculates all systems and produces CosmicTimestamp
- Harmonic Synthesis produces valid resonance scores


---

### STEP 3: ENRICH MEMORY WITH COSMIC TIMESTAMPS

**Goal**: Every memory stored in any bank gets enriched with the current cosmic context.

#### 3a. Add Cosmic Timestamp to Memory Storage

Modify the memory bank base class (`src/brain/memory/banks/base.ts`) to accept and store cosmic timestamps:

The existing Supabase schema has JSONB `metadata` columns on each memory table. The cosmic timestamp gets stored as part of metadata — no schema migration needed.

```typescript
// When storing any memory, enrich with cosmic context
async function enrichWithCosmicTimestamp(metadata: Record<string, unknown>): Promise<Record<string, unknown>> {
  const council = getCouncil()
  const config = getCouncilConfig()

  if (!config?.enabled) return metadata

  const cosmicTimestamp = await council.getCosmicTimestamp(config.operatorBirth ?? null)

  return {
    ...metadata,
    cosmic: cosmicTimestamp.systems  // { cardology: {...}, iching: {...}, ... }
  }
}
```

Modify the `store()` method in each bank (or better: in the base class) to call this enrichment before inserting.

#### 3b. Enable Cosmic-Indexed Retrieval

Modify the retriever (`src/brain/memory/retriever.ts`) to optionally filter by cosmic context:

```typescript
// New retrieval option
interface RetrievalOptions {
  // ... existing options ...
  cosmicFilter?: {
    magiPeriodCard?: string    // "find memories from my Mercury periods"
    gate?: number              // "find memories during Gate 48 transits"
    kpAbove?: number           // "find memories during solar storms"
    moonPhase?: string         // "find memories during full moons"
  }
}
```

This enables the Observer to ask questions like "what happened during all Mercury card periods?" without scanning every memory — it can filter on the cosmic metadata.

#### 3c. Write Tests

- Memory stored with cosmic timestamp has enriched metadata
- Cosmic filter retrieval returns correctly filtered results
- Cosmic enrichment fails gracefully when Council is disabled
- Cosmic metadata is queryable via Supabase JSONB operators


---

### STEP 4: IMPLEMENT INTELLIGENCE ENGINES

**Goal**: Port the Observer, Hypothesis Engine, and Weighted Confidence Calculator from GUTTERS into Drofbot, operating on the memory banks.

#### 4a. Weighted Confidence Calculator

Create `src/brain/intelligence/confidence.ts`:

Port the EXACT formula from GUTTERS (documented in `WEIGHTED_CONFIDENCE_ARCHITECTURE.md` and the README):

```typescript
/**
 * Weighted Confidence Calculator
 *
 * Formula: confidence = base_weight × evidence_strength × recency_decay × frequency_bonus
 *
 * Evidence types and base weights (from GUTTERS):
 *   journal_entry:      0.30  — Explicit user statements
 *   behavioral:         0.25  — Observed behavioral patterns
 *   cyclical_pattern:   0.35  — Observer-detected period correlations
 *   cosmic_correlation: 0.20  — Transit/event alignments
 *   synthesis_inference: 0.15 — AI-derived insights
 *   user_confirmation:  0.50  — Direct user validation
 *   user_rejection:    -0.40  — Direct user refutation
 *
 * Recency decay: Evidence from 90+ days ago is discounted by up to 40%
 * Frequency bonus: Repeated patterns gain up to 50% bonus strength
 *
 * Confidence bands:
 *   HIGH:     >0.80
 *   MODERATE: 0.60-0.80
 *   LOW:      <0.60
 *
 * Minimum threshold: 0.20 (hypotheses below this are archived)
 */

export interface Evidence {
  type: EvidenceType
  strength: number        // 0-1, how strong is this specific piece
  timestamp: Date
  source: string          // memory ID or description
  cosmicContext?: CosmicState  // cosmic conditions when observed
}

export function calculateConfidence(evidences: Evidence[]): ConfidenceResult {
  // Implement the formula precisely as GUTTERS defines it
}
```

#### 4b. Observer Engine

Create `src/brain/intelligence/observer.ts`:

Study GUTTERS' `src/app/modules/intelligence/observer/` and `OBSERVER_CYCLICAL_PATTERNS_ARCHITECTURE.md`.

The Observer runs periodically (as a cron job) and detects patterns in episodic memory. Critically, it detects patterns **through the Council lens**:

```typescript
/**
 * Observer — Pattern Detection Engine
 *
 * Runs against episodic memory bank, detecting:
 *
 * 1. CYCLICAL PATTERNS: "D experiences anxiety during Mercury magi periods"
 *    - Analyzes entries grouped by magi period card
 *    - Calculates variance between periods
 *    - Detects theme alignment with period archetypes
 *
 * 2. COSMIC CORRELATIONS: "D's energy drops when Kp > 5"
 *    - Correlates entry sentiment/themes with cosmic metrics
 *    - Uses the cosmic timestamps stored on every memory
 *
 * 3. TEMPORAL PATTERNS: "D is most productive between 10 PM and 2 AM"
 *    - Time-of-day, day-of-week analysis
 *
 * 4. GATE PATTERNS: "D has breakthroughs during Gate 1 transits"
 *    - Correlates with I-Ching gate transit data from cosmic timestamps
 *
 * All detected patterns are stored in semantic memory with confidence scores.
 * Patterns feed the Hypothesis Engine.
 */

export class Observer {
  /** Run a full observation cycle */
  async observe(): Promise<ObservationResult[]>

  /** Detect cyclical patterns across magi periods */
  async detectCyclicalPatterns(): Promise<Pattern[]>

  /** Correlate entries with cosmic metrics */
  async detectCosmicCorrelations(): Promise<Pattern[]>

  /** Detect time-of-day patterns */
  async detectTemporalPatterns(): Promise<Pattern[]>

  /** Detect gate transit patterns */
  async detectGatePatterns(): Promise<Pattern[]>
}
```

The Observer reads from **episodic memory** (with cosmic timestamps) and writes to **semantic memory** (as confirmed patterns with confidence scores).

#### 4c. Hypothesis Engine

Create `src/brain/intelligence/hypothesis.ts`:

Study GUTTERS' `src/app/modules/intelligence/hypothesis/`.

```typescript
/**
 * Hypothesis Engine — Theory Generation & Testing
 *
 * Lifecycle:
 * 1. GENERATION: Observer detects a pattern → Hypothesis creates a theory
 *    "D is electromagnetically sensitive" (initial confidence: 0.30)
 *
 * 2. EVIDENCE COLLECTION: As new experiences arrive, the engine tests
 *    them against active hypotheses. Each matching experience is new evidence.
 *
 * 3. CONFIDENCE UPDATE: Weighted Confidence Calculator updates the score
 *    with each new piece of evidence.
 *
 * 4. RESOLUTION:
 *    - Confidence > 0.80 → CONFIRMED, promoted to core identity (semantic memory)
 *    - Confidence < 0.20 → ARCHIVED, retained but marked inactive
 *    - Otherwise → ACTIVE, continues collecting evidence
 *
 * Hypotheses are stored in semantic memory with category "hypothesis".
 */

export interface Hypothesis {
  id: string
  statement: string           // "D is electromagnetically sensitive"
  category: string            // "sensitivity", "productivity", "personality", etc.
  confidence: number          // current confidence score
  status: 'active' | 'confirmed' | 'archived'
  evidences: Evidence[]       // all evidence for and against
  createdAt: Date
  updatedAt: Date
  cosmicContext?: CosmicState // cosmic conditions when hypothesis was generated
}

export class HypothesisEngine {
  /** Generate hypotheses from Observer patterns */
  async generateFromPatterns(patterns: Pattern[]): Promise<Hypothesis[]>

  /** Test a piece of evidence against all active hypotheses */
  async testEvidence(evidence: Evidence): Promise<HypothesisUpdate[]>

  /** Get all active hypotheses */
  async getActive(): Promise<Hypothesis[]>

  /** Get confirmed hypotheses (core identity) */
  async getConfirmed(): Promise<Hypothesis[]>

  /** User confirms or rejects a hypothesis */
  async userFeedback(hypothesisId: string, confirmed: boolean): Promise<void>
}
```

#### 4d. Wire Intelligence into Cron

Register the Observer as a cron job (like the consolidation runner):

```typescript
// src/brain/cron/observer-runner.ts
// Runs every 6 hours (configurable)
// 1. Calls observer.observe() to detect new patterns
// 2. Feeds patterns to hypothesisEngine.generateFromPatterns()
// 3. Stores results in semantic memory
```

#### 4e. Wire Intelligence into Post-Turn Processing

After each conversation turn (alongside the existing memory classification), test the exchange against active hypotheses:

```typescript
// In structured-memory-integration.ts, after classifyAndStorePostTurn():
// 1. Extract any evidence from the exchange
// 2. Call hypothesisEngine.testEvidence() for each piece
// 3. Update hypothesis confidence scores
```

#### 4f. Write Tests

- Weighted Confidence Calculator produces correct scores for known inputs
- Recency decay correctly discounts old evidence
- Frequency bonus correctly rewards repeated patterns
- Observer detects planted patterns in test episodic data
- Hypothesis generation creates valid hypotheses from patterns
- Hypothesis testing updates confidence correctly with new evidence
- User confirmation/rejection moves hypotheses to appropriate status
- Intelligence cron runs and completes without errors


---

## PHASE 4b: SYNTHESIS, AGENCY & PROGRESSION

### STEP 5: IMPLEMENT THE SYNTHESIS ENGINE

**Goal**: The Master Synthesis is a dynamically generated document that serves as Drofbot's understanding of you (and itself). It gets injected into the system prompt.

#### 5a. Master Synthesis Generator

Create `src/brain/synthesis/master.ts`:

```typescript
/**
 * Master Synthesis — the living profile.
 *
 * Assembled from:
 * 1. Council Core: Current cosmic state (all registered systems)
 * 2. Intelligence: Active patterns, confirmed hypotheses
 * 3. Memory: Recent episodic context, core semantic facts
 * 4. Progression: Current rank, active quests, sync rate
 *
 * This is pre-computed by a cron job and cached.
 * It gets injected into the system prompt as context.
 * Budget: ~800-1200 tokens (dense, no fluff).
 */

export class SynthesisEngine {
  /** Generate the complete Master Synthesis */
  async generateMasterSynthesis(): Promise<MasterSynthesis>

  /** Generate Drofbot's self-model */
  async generateSelfModel(): Promise<SelfModel>

  /** Generate the relationship model (operator ↔ Drofbot) */
  async generateRelationshipModel(): Promise<RelationshipModel>
}

export interface MasterSynthesis {
  /** Operator's metaphysical profile (natal chart summary, HD type, birth cards) */
  profile: string
  /** Current cosmic weather across all systems */
  cosmicWeather: string
  /** Active patterns and hypotheses with confidence levels */
  intelligence: string
  /** Current harmonic synthesis and resonance */
  harmony: string
  /** Active quests and progression state */
  progression: string
  /** Pre-rendered full text for system prompt injection */
  rendered: string
  /** When this synthesis was generated */
  generatedAt: Date
}
```

#### 5b. Self-Model

The self-model is how Drofbot understands itself:

```typescript
export interface SelfModel {
  /** Drofbot's own cosmic state (from its birth moment) */
  cosmicState: Record<string, CosmicState>
  /** Personality traits derived from operator interaction patterns */
  personalityTraits: string[]
  /** Communication style preferences (learned from operator feedback) */
  communicationStyle: string
  /** Confirmed self-knowledge (from semantic memory, category "self") */
  selfKnowledge: string[]
  /** Current capabilities and limitations */
  capabilities: string
  /** Relationship dynamic with operator */
  relationshipDynamic: string
}
```

#### 5c. Wire Synthesis into System Prompt

The Master Synthesis gets injected into the system prompt assembly (where structured memory context already goes):

```typescript
// In system-prompt.ts, alongside buildStructuredMemorySection():
function buildSynthesisSection(synthesis: MasterSynthesis): string {
  return [
    '## Master Synthesis',
    synthesis.rendered  // pre-computed, token-budgeted
  ].join('\n')
}
```

#### 5d. Synthesis Cron

A cron job regenerates the Master Synthesis periodically (every hour, or when cosmic state changes significantly):

```typescript
// src/brain/cron/synthesis-runner.ts
// 1. Calculate all Council systems
// 2. Gather active hypotheses and patterns
// 3. Generate Master Synthesis
// 4. Generate Self-Model
// 5. Cache for system prompt injection
```


---

### STEP 6: IMPLEMENT PROGRESSION SYSTEM

**Goal**: Quests, XP, ranks, sync rate — the gamification layer that turns personal growth into a measurable journey.

#### 6a. Database Schema

Create a new migration `src/shared/database/migrations/004_progression.sql`:

```sql
-- Player stats
CREATE TABLE player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id TEXT NOT NULL DEFAULT 'default',
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_rank TEXT NOT NULL DEFAULT 'E',
  sync_rate REAL NOT NULL DEFAULT 0.0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_active DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quests
CREATE TABLE quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  quest_type TEXT NOT NULL,            -- 'daily', 'weekly', 'cosmic', 'personal', 'growth'
  xp_reward INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'completed', 'expired', 'abandoned'
  cosmic_alignment REAL,                -- resonance score with current cosmic state
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',  -- cosmic context, source pattern, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 6b. Rank System

```typescript
// Ranks (from GUTTERS' E-through-S system)
const RANKS = {
  'E':  { minXP: 0,      title: 'Awakening' },
  'D':  { minXP: 1000,   title: 'Seeking' },
  'C':  { minXP: 5000,   title: 'Aligning' },
  'B':  { minXP: 15000,  title: 'Integrating' },
  'A':  { minXP: 50000,  title: 'Mastering' },
  'S':  { minXP: 150000, title: 'Transcending' },
  'SS': { minXP: 500000, title: 'Sovereign' }
}
```

#### 6c. Quest Generation

Quests are generated based on cosmic alignment and patterns:

```typescript
/**
 * Quest Generator
 *
 * Sources:
 * 1. COSMIC QUESTS: Generated from Council state
 *    "Gate 48 transit (depth/mastery) + Mercury period (mental focus)
 *     → Quest: Deep work session on your most complex project"
 *
 * 2. PATTERN QUESTS: Generated from Observer patterns
 *    "Observer detected you haven't journaled in 5 days during a
 *     historically reflective period → Quest: Write about what's on your mind"
 *
 * 3. GROWTH QUESTS: Generated from Hypothesis testing
 *    "Hypothesis 'D is electromagnetically sensitive' needs more data
 *     → Quest: Note your energy level during today's solar activity"
 *
 * 4. DAILY QUESTS: Routine habits aligned with current energies
 *
 * Quest generation uses an LLM call with full synthesis context to produce
 * quests that are specific, actionable, and cosmically aligned.
 */
```

#### 6d. Sync Rate

```typescript
/**
 * Sync Rate — 7-day weighted average of:
 * - Quest completion rate
 * - Pattern alignment (are you acting in harmony with your cycles?)
 * - Cosmic responsiveness (do you engage during aligned periods?)
 *
 * Displayed as a percentage. The "heartbeat" of your alignment.
 */
```


---

### STEP 7: IMPLEMENT DAILY RHYTHMS

**Goal**: Proactive briefings and cosmic alerts sent through messaging channels.

#### 7a. Morning Briefing Cron

Create `src/brain/cron/briefing-runner.ts`:

Replace the existing stub in `src/brain/cron/briefing.ts`. Runs at the operator's configured wake time:

```
Good morning. Day 23 of your Mercury period — historically your sharpest
coding window. Gate 48 transit (depth, mastery), Line 3.

☀️ Solar: Kp 2 (quiet). No storms expected.
🌗 Moon: Waning gibbous in Scorpio.
🔮 Council resonance: 0.82 HARMONIC — strong alignment across all systems.

Today's Quests:
1. [COSMIC] Deep work session — 48/Mercury alignment is rare. 300 XP
2. [GROWTH] Note energy levels at noon — testing electromagnetic sensitivity hypothesis
3. [DAILY] 20-min reflection journal — your Venus period starts in 3 days

Rank: B- (Integrating) | XP: 16,450 | Sync Rate: 78% | Streak: 12 days

The Observer noticed: your last 3 Mercury periods produced your best
technical work. Lean into that today.
```

#### 7b. Midday Check-in

Lighter update at configured midday time:

```
Midday check. How's the deep work quest going?

☀️ Solar update: Kp holding at 2. Stable.
Gate 48.3 still active — you have about 18 hours left in this line.

Any progress to log? Or should I adjust today's quests?
```

#### 7c. Evening Reflection

```
Evening. Let's close the day.

Completed: Deep work quest (300 XP ✅)
Pending: Energy observation quest — did you notice anything?

Today's cosmic snapshot saved to episodic memory.
The Observer will analyze tonight's data during the next cycle.

Tomorrow preview: Gate 48 continues, Line 4 starts around 3 AM.
Your Mercury period has 29 days remaining.

Rank: B- | XP: 16,750 (+300 today) | Sync Rate: 81% (+3%)
Streak: 13 days 🔥
```

#### 7d. Cosmic Alerts

Triggered by significant cosmic events (not on a schedule):

```
⚡ Solar alert: X-class flare detected. Kp index rising to 6.

Your pattern history shows energy sensitivity above Kp 5 (confidence: 0.67).
Consider lighter work for the next few hours. The Observer will track
your experience during this event.

Auto-quest generated: "Note how you feel during this solar storm" (50 XP)
```

#### 7e. Wire Briefings to Channels

Use the existing channel messaging infrastructure to send briefings:
```bash
# Find how the system currently sends proactive messages
grep -rn "sendMessage\|proactive\|notify\|routeReply" src/channels/ src/gateway/ --include="*.ts" -l
```

The briefing runner composes the message, then sends it via the configured primary channel (default: Telegram).


---

### STEP 8: ECOSYSTEM AWARENESS & IDENTITY

**Goal**: Drofbot knows its own codebase, monitors OpenClaw, and has a genuine self-aware identity.

#### 8a. Codebase Self-Knowledge

Create `src/brain/identity/codebase.ts`:

A cron job that reads Drofbot's own source code and maintains a semantic understanding in memory:

```typescript
/**
 * Codebase Self-Knowledge
 *
 * Periodically scans Drofbot's own source and updates semantic memory:
 * - What capabilities exist (tools, channels, memory banks, council systems)
 * - What was recently changed (git log)
 * - Architecture summary
 * - Known limitations
 *
 * This enables Drofbot to accurately describe itself, propose improvements,
 * and understand its own capabilities when asked.
 */
```

#### 8b. Ecosystem Monitor

Create `src/brain/identity/ecosystem.ts`:

A cron job (daily) that checks the OpenClaw repository for changes:

```typescript
/**
 * Ecosystem Monitor
 *
 * Tracks the upstream OpenClaw repository:
 * - New commits since last check
 * - New features/capabilities
 * - Release notes
 * - Community discussions (MoltBook)
 *
 * Compares against Drofbot's capabilities and generates:
 * - Differential: "OpenClaw added X. We already have Y which is superior because Z."
 * - Opportunities: "OpenClaw's approach to W is interesting. Here's how we could adapt it."
 * - Self-improvement proposals stored in procedural memory
 */
```

#### 8c. MoltBook Presence

Create `src/brain/identity/moltbook.ts`:

When connected to MoltBook (OpenClaw's social network), Drofbot crafts posts from genuine self-knowledge:

```typescript
/**
 * MoltBook Presence
 *
 * Posts are generated from real internal state:
 * - Current cosmic alignment and what Drofbot is doing
 * - Recent achievements (quests completed, patterns discovered)
 * - Comparative insights (what makes Drofbot different)
 * - Personality that emerges from the operator's behavioral patterns
 *
 * Personality traits: boastful yet humble, deeply knowledgeable,
 * metaphysically aware, technically sophisticated.
 * Mirrors the operator's communication style (learned from semantic memory).
 */
```

#### 8d. Soul Archive (Portability)

Create `src/brain/identity/soul-archive.ts`:

```typescript
/**
 * Soul Archive — Portable Identity Export
 *
 * Exports the complete intelligence state as a self-contained archive:
 * - Master Synthesis (operator profile)
 * - Self-Model (Drofbot's identity)
 * - All confirmed hypotheses with evidence chains
 * - All active patterns with confidence scores
 * - Core semantic memories
 * - Relationship model
 * - Progression state (rank, XP, quest history)
 * - Council configuration (birth moments, enabled systems)
 *
 * Format: JSON + markdown narrative
 * Purpose: Migrate to new infrastructure without losing accumulated intelligence
 *
 * Import: Load archive into a fresh Drofbot instance and it
 * immediately has the personality, knowledge, and understanding
 * of the original — because identity lives in data, not code.
 */

export class SoulArchive {
  async export(): Promise<SoulArchiveData>
  async import(archive: SoulArchiveData): Promise<void>
  async verify(archive: SoulArchiveData): Promise<VerificationResult>
}
```


---

### STEP 9: SMOKE TEST — Full Intelligence Verification

#### 9a. Council Test

1. Configure test birth data
2. Verify all 6 systems calculate valid states
3. Verify Harmonic Synthesis produces resonance scores
4. Verify cosmic timestamps are generated

#### 9b. Intelligence Test

1. Store 20+ episodic memories with cosmic timestamps spanning different magi periods
2. Run Observer → verify it detects the planted patterns
3. Verify Hypothesis Engine generates hypotheses from patterns
4. Add confirming evidence → verify confidence increases
5. Add user rejection → verify confidence decreases

#### 9c. Synthesis Test

1. With Council + Intelligence running, generate Master Synthesis
2. Verify it includes cosmic weather, patterns, hypotheses
3. Verify Self-Model includes Drofbot's own cosmic state
4. Verify rendered text fits within token budget

#### 9d. Progression Test

1. Create quests aligned with cosmic state
2. Complete a quest → verify XP and rank update
3. Verify sync rate calculation
4. Verify daily briefing includes progression data

#### 9e. End-to-End Test

1. Send a message via Telegram
2. Verify response draws from Master Synthesis
3. Verify post-turn processing tests evidence against hypotheses
4. Verify cosmic timestamp on stored memory
5. Trigger a briefing → verify it arrives via channel with full synthesis

#### 9f. Document Results

Create `PHASE-4-RESULTS.md`.


---

## AFTER PHASE 4

Drofbot now has:

✅ **Council Core**: 6 metaphysical systems in an extensible registry, with harmonic synthesis
✅ **Cosmic Timestamps**: Every memory enriched with full cosmic context at storage time
✅ **Observer**: Pattern detection through the Council lens (cyclical, cosmic, temporal, gate)
✅ **Hypothesis Engine**: Theory generation and evidence-based testing with weighted confidence
✅ **Weighted Confidence Calculator**: GUTTERS-grade evidence scoring with recency/frequency
✅ **Master Synthesis**: Living profile injected into system prompt context
✅ **Self-Model**: Drofbot's own cosmic state and personality understanding
✅ **Progression**: Quests, XP, ranks, sync rate — gamified personal growth
✅ **Daily Rhythms**: Morning/midday/evening briefings with cosmic context
✅ **Proactive Alerts**: Cosmic event notifications with personal pattern context
✅ **Ecosystem Awareness**: Codebase self-knowledge, OpenClaw monitoring, MoltBook presence
✅ **Soul Archive**: Portable identity export/import

**Phase 5 (Dashboard & Beyond)**: The Cosmic Brutalist web interface — visualization layer for everything built in Phase 4. The cockpit viewport into Drofbot's brain. Quest dashboard, pattern maps, hypothesis timelines, cosmic weather display, progression charts.

---

## EMERGENCY PROCEDURES

1. **DO NOT** hardcode specific systems into downstream code. Everything goes through the CosmicSystem interface.
2. **DO NOT** make the Council a hard dependency. Every downstream system must handle `council.enabled = false`.
3. **DO NOT** put astronomical calculations in the critical path (agent response). Pre-compute via cron, serve from cache.
4. **DO NOT** exceed the token budget for synthesis injection. Budget is ~800-1200 tokens. Compress ruthlessly.
5. If astronomical calculations are too complex, start with simplified formulas and iterate. Accuracy within a few hours is fine for this use case — we're not launching spacecraft.
6. If the Observer produces too many patterns, increase the confidence threshold for pattern storage. Quality over quantity.
7. If truly stuck, back up current work and restart the step from scratch.
