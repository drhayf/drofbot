# GUTTERS Algorithmic Reference — TypeScript Porting Guide

> Comprehensive extraction of all intelligence, calculation, and tracking algorithms
> from `C:\dev\GUTTERS\src`. Every formula, constant, data structure, and module
> interaction documented for faithful TypeScript reimplementation.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Cardology Kernel](#2-cardology-kernel)
3. [I-Ching / Human Design / Gene Keys Kernel](#3-i-ching--human-design--gene-keys-kernel)
4. [Observer — Pattern Detection](#4-observer--pattern-detection)
5. [Cyclical Pattern Detector](#5-cyclical-pattern-detector)
6. [Hypothesis — Models & Lifecycle](#6-hypothesis--models--lifecycle)
7. [Weighted Confidence Calculator](#7-weighted-confidence-calculator)
8. [Hypothesis Generator](#8-hypothesis-generator)
9. [Genesis Engine](#9-genesis-engine)
10. [Harmonic Synthesis — Council of Systems](#10-harmonic-synthesis--council-of-systems)
11. [Profile Synthesizer](#11-profile-synthesizer)
12. [Insight Manager](#12-insight-manager)
13. [Tracking — Solar](#13-tracking--solar)
14. [Tracking — Lunar](#14-tracking--lunar)
15. [Tracking — Transits](#15-tracking--transits)
16. [Event Bus & Module Registry](#16-event-bus--module-registry)

---

## 1. Architecture Overview

**Stack**: Python 3.11+, FastAPI, async SQLAlchemy, Pydantic, Redis event bus.  
**Scientific deps**: numpy, scipy.stats, skyfield (JPL DE421), swisseph (Swiss Ephemeris).  
**LLM**: langchain → Claude Sonnet 4.5 (premium tier).

### Module Dependency Graph

```
User Profile ──► Cardology Kernel ──► 52-day periods, birth card
             ──► I-Ching Kernel   ──► daily gate/line, design date
             ──► Calculation Modules (astrology, numerology, etc.)
                      │
                      ▼
              Observer (pattern detection)
                      │
                      ▼
              Hypothesis Generator ──► WeightedConfidenceCalculator
                      │
                      ▼
              Genesis Engine (birth-time refinement)
                      │
                      ▼
              Harmonic Synthesis / Council of Systems
                      │
                      ▼
              Insight Manager → proactive notifications
```

### Event-Driven Communication

All modules communicate via a Redis-backed event bus (`get_event_bus()`).  
Key event constants:
- `HYPOTHESIS_GENERATED`, `HYPOTHESIS_CONFIRMED`, `HYPOTHESIS_REJECTED`
- `CYCLICAL_PATTERN_DETECTED`
- `MODULE_PROFILE_CALCULATED`
- `GENESIS_UNCERTAINTY_DECLARED`
- `SYNTHESIS_GENERATED`

---

## 2. Cardology Kernel

**Source**: `intelligence/cardology/kernel.py` (1356 lines)  
**Nature**: Stateless, pure-math. All computations derive from birth date + target date.  
**Reference**: Olney H. Richmond, *The Mystic Test Book* (1893).

### 2.1 Core Data Structures

```typescript
enum Suit {
  HEARTS = '♥',   // Water, offset 0
  CLUBS = '♣',    // Fire, offset 13
  DIAMONDS = '♦', // Earth, offset 26
  SPADES = '♠',   // Air, offset 39
}

enum Planet {
  MERCURY, VENUS, MARS, JUPITER, SATURN, URANUS, NEPTUNE,
  PLUTO, SUN, MOON
}

interface Card {
  rank: number;    // 1 (Ace) – 13 (King)
  suit: Suit;
  solarValue: number; // rank + suitOffset
}

const JOKER: Card = { rank: 0, suit: null, solarValue: 0 };

interface PlanetaryPeriod {
  planet: Planet;
  startDate: Date;
  endDate: Date;
  directCard: Card;
  verticalCard: Card | null;
}

interface CardologyBlueprint {
  birthCard: Card;
  rulingCard: Card;
  firstKarmaCard: Card | null;
  secondKarmaCard: Card | null;
  isFixedCard: boolean;
  zodiacSign: ZodiacSign;
  lifeSpreadRow: number;
  lifeSpreadCol: number;
  lifeRowPlanet: Planet;
  lifeColPlanet: Planet;
  lifePathSpread: Record<string, Card>;  // 13 positional cards
  planetaryPeriods: PlanetaryPeriod[];
}

interface RelationshipConnection {
  connectionType: string;
  planet: Planet;
  fromCard: Card;
  toCard: Card;
  spreadType: 'life' | 'spiritual';
  isMutual: boolean;
}
```

### 2.2 Birth Card Calculation

```typescript
function calculateBirthCard(month: number, day: number): Card {
  const solarValue = 55 - ((month * 2) + day);

  if (solarValue === 0) return JOKER;  // Dec 31

  // Negative values wrap: add 52
  const sv = solarValue < 0 ? solarValue + 52 : solarValue;

  if (sv >= 1 && sv <= 13)  return { rank: sv,      suit: Suit.HEARTS,   solarValue: sv };
  if (sv >= 14 && sv <= 26) return { rank: sv - 13,  suit: Suit.CLUBS,    solarValue: sv };
  if (sv >= 27 && sv <= 39) return { rank: sv - 26,  suit: Suit.DIAMONDS, solarValue: sv };
  if (sv >= 40 && sv <= 52) return { rank: sv - 39,  suit: Suit.SPADES,   solarValue: sv };
}
```

**Verification examples**:
| Date | Solar Value | Card |
|------|-------------|------|
| Jan 1 | 52 | K♠ |
| Dec 30 | 1 | A♥ |
| Dec 31 | 0 | Joker |
| Dec 18 | 13 | K♥ (Brad Pitt) |
| Jul 4 | 33 | J♦ |

### 2.3 Natural Spread (8×8 Grid)

The Natural Spread is an 8×8 grid. Cards A♥ through K♠ fill **rows 1–7** right-to-left (7 cards per row). The **Crown row 0** receives J♠, Q♠, K♠ (the "Crown Cards").

```typescript
function generateNaturalSpread(): Card[][] {
  const grid: Card[][] = Array.from({ length: 8 }, () => Array(8).fill(null));

  // Cards in solar value order: A♥(1) → K♠(52), minus Crown Cards
  const cards = allCardsInSolarOrder(); // 52 cards, exclude J♠/Q♠/K♠

  let cardIdx = 0;
  for (let row = 1; row <= 7; row++) {
    for (let col = 7; col >= 1; col--) { // RIGHT to LEFT
      grid[row][col] = cards[cardIdx++];
    }
  }

  // Crown row
  grid[0][0] = JACK_SPADES;   // Fixed
  grid[0][1] = QUEEN_SPADES;  // Fixed
  grid[0][2] = KING_SPADES;   // Fixed

  return grid;
}
```

### 2.4 Quadration Algorithm

Core deck transformation that generates the 90 solar spreads:

```typescript
function quadrate(deck: Card[]): Card[] {
  // Step 1: Deal 48 cards into 4 piles, 3 at a time
  const piles: Card[][] = [[], [], [], []];
  for (let i = 0; i < 48; i += 3) {
    const pileIdx = Math.floor(i / 3) % 4;
    piles[pileIdx].push(deck[i], deck[i + 1], deck[i + 2]);
  }

  // Step 2: Last 4 cards, one per pile
  for (let i = 0; i < 4; i++) {
    piles[i].push(deck[48 + i]);
  }

  // Step 3: Stack piles 4th → 3rd → 2nd → 1st
  const stacked = [...piles[3], ...piles[2], ...piles[1], ...piles[0]];

  // Step 4: Deal 1-per-pile into 4 new piles
  const newPiles: Card[][] = [[], [], [], []];
  for (let i = 0; i < stacked.length; i++) {
    newPiles[i % 4].push(stacked[i]);
  }

  // Step 5: Stack same way (4th → 3rd → 2nd → 1st)
  return [...newPiles[3], ...newPiles[2], ...newPiles[1], ...newPiles[0]];
}
```

### 2.5 Spreads

- **Life Spread** = quadrate Natural Spread deck **once**
- **Spiritual Spread** = quadrate Natural Spread deck **twice** (or quadrate Life Spread once)
- **Grand Solar Spread** for age N = quadrate Natural **(age % 90 + 1)** times

```typescript
function generateSolarSpread(age: number): Card[][] {
  let deck = naturalDeckOrder();
  const iterations = (age % 90) + 1;
  for (let i = 0; i < iterations; i++) {
    deck = quadrate(deck);
  }
  return deckToGrid(deck); // 8×8 grid layout
}
```

### 2.6 Planetary Periods

7 periods of **52 days** each per year (Mercury → Neptune). Neptune gets the remainder days.

```typescript
const PERIOD_ORDER: Planet[] = [
  Planet.MERCURY, Planet.VENUS, Planet.MARS, Planet.JUPITER,
  Planet.SATURN, Planet.URANUS, Planet.NEPTUNE
];

function calculatePlanetaryPeriods(
  birthDate: Date, year: number, birthCard: Card, spread?: Card[][]
): PlanetaryPeriod[] {
  const yearStart = getBirthdayInYear(birthDate, year);
  const yearEnd = getBirthdayInYear(birthDate, year + 1);
  const totalDays = daysBetween(yearStart, yearEnd);

  if (!spread) {
    const age = year - birthDate.getFullYear();
    spread = generateSolarSpread(age);
  }

  const periods: PlanetaryPeriod[] = [];
  let currentDate = yearStart;

  for (let i = 0; i < 7; i++) {
    const duration = i < 6 ? 52 : totalDays - (52 * 6); // Neptune gets remainder
    const endDate = addDays(currentDate, duration - 1);

    periods.push({
      planet: PERIOD_ORDER[i],
      startDate: currentDate,
      endDate,
      directCard: getPlanetaryCard(birthCard, PERIOD_ORDER[i], spread),
      verticalCard: null, // optional vertical card lookup
    });

    currentDate = addDays(endDate, 1);
  }

  return periods;
}
```

### 2.7 Planetary Card Navigation

From the birth card's position in the spread, move **left** by the planet's offset. Wraps across rows.

```typescript
const PLANET_OFFSETS: Record<Planet, number> = {
  [Planet.MERCURY]: 1,
  [Planet.VENUS]:   2,
  [Planet.MARS]:    3,
  [Planet.JUPITER]: 4,
  [Planet.SATURN]:  5,
  [Planet.URANUS]:  6,
  [Planet.NEPTUNE]: 7,
  [Planet.MOON]:   -1,  // Moon moves RIGHT
};

function getPlanetaryCard(birthCard: Card, planet: Planet, spread: Card[][]): Card {
  const [row, col] = findCardInSpread(birthCard, spread);
  const offset = PLANET_OFFSETS[planet];

  // Flatten to linear index, subtract offset, wrap
  const linearIdx = row * 7 + col;  // 7 columns per data row
  const newIdx = ((linearIdx - offset) % 49 + 49) % 49;

  const newRow = Math.floor(newIdx / 7);
  const newCol = newIdx % 7;
  return spread[newRow][newCol];
}
```

### 2.8 Karma Cards

```typescript
const FIXED_CARDS = [KING_SPADES, JACK_HEARTS, EIGHT_CLUBS]; // Never move in quadration
const SEMI_FIXED_PAIRS: [Card, Card][] = [
  [ACE_CLUBS, TWO_HEARTS],
  [SEVEN_DIAMONDS, NINE_HEARTS],
];

function calculateKarmaCards(birthCard: Card): [Card | null, Card | null] {
  if (FIXED_CARDS.includes(birthCard)) return [null, null]; // No karma

  // Semi-fixed cards swap with their partner
  for (const [a, b] of SEMI_FIXED_PAIRS) {
    if (cardEquals(birthCard, a)) return [b, a];
    if (cardEquals(birthCard, b)) return [a, b];
  }

  const naturalSpread = generateNaturalSpread();
  const lifeSpread = generateLifeSpread();

  // First Karma: card in Natural Spread at birth card's Life Spread position
  const [lifeRow, lifeCol] = findCardInSpread(birthCard, lifeSpread);
  const firstKarma = naturalSpread[lifeRow][lifeCol];

  // Second Karma: card in Life Spread at birth card's Natural Spread position   
  const [natRow, natCol] = findCardInSpread(birthCard, naturalSpread);
  const secondKarma = lifeSpread[natRow][natCol];

  return [firstKarma, secondKarma];
}
```

### 2.9 Zodiac Rulers & Ruling Card

Classical rulerships map zodiac sign → planet → card in Life Spread at birth card's planetary position.

```typescript
const ZODIAC_RULERS: Record<ZodiacSign, Planet> = {
  ARIES: Planet.MARS, TAURUS: Planet.VENUS, GEMINI: Planet.MERCURY,
  CANCER: Planet.MOON, LEO: Planet.SUN, VIRGO: Planet.MERCURY,
  LIBRA: Planet.VENUS, SCORPIO: Planet.PLUTO, SAGITTARIUS: Planet.JUPITER,
  CAPRICORN: Planet.SATURN, AQUARIUS: Planet.URANUS, PISCES: Planet.NEPTUNE,
};
```

### 2.10 Relationship Analysis

Check if `card_b` appears in `card_a`'s planetary positions in both Life and Spiritual spreads. Report planet, spread type, and mutual status.

---

## 3. I-Ching / Human Design / Gene Keys Kernel

**Source**: `intelligence/iching/kernel.py` (4299 lines)  
**Nature**: Stateless. Solar longitude → gate/line/color/tone/base.

### 3.1 Core Constants

```typescript
const ICHING_OFFSET = 58;           // degrees
const DEGREES_PER_GATE = 5.625;     // 360 / 64
const DEGREES_PER_LINE = 0.9375;    // 5.625 / 6
const DEGREES_PER_COLOR = 0.15625;  // 0.9375 / 6
const DEGREES_PER_TONE = 0.026041;  // 0.15625 / 6 (approx)
const DEGREES_PER_BASE = 0.005208;  // 0.026041 / 5 (approx)
const DESIGN_ARC_DEGREES = 88;      // Solar arc for Design date
```

### 3.2 Gate Circle (Rave Mandala Sequence)

64 gates arranged around the 360° wheel, starting from Gate 41:

```typescript
const GATE_CIRCLE: number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24,  2, 23,  8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33,  7,  4, 29, 59, 40, 64, 47,  6, 46, 18, 48, 57, 32, 50,
  28, 44,  1, 43, 14, 34,  9,  5, 26, 11, 10, 58, 38, 54, 61, 60,
];
```

### 3.3 Longitude → Activation (THE CORE ALGORITHM)

```typescript
interface Activation {
  longitude: number;
  gate: number;
  line: number;     // 1–6
  color: number;    // 1–6
  tone: number;     // 1–6
  base: number;     // 1–5
}

function longitudeToActivation(longitude: number): Activation {
  const angle = ((longitude + 58) % 360 + 360) % 360;
  const pct = angle / 360;

  const gateIndex = Math.floor(pct * 64);
  const gate = GATE_CIRCLE[gateIndex];

  const line  = Math.floor((pct * 384) % 6) + 1;     // 64 × 6 = 384
  const color = Math.floor((pct * 2304) % 6) + 1;    // 384 × 6 = 2304
  const tone  = Math.floor((pct * 13824) % 6) + 1;   // 2304 × 6 = 13824
  const base  = Math.floor((pct * 69120) % 5) + 1;   // 13824 × 5 = 69120

  return { longitude, gate, line, color, tone, base };
}
```

### 3.4 Approximate Sun Longitude

Simplified algorithm (no ephemeris needed, ±1° accuracy):

```typescript
function approximateSunLongitude(dt: Date): number {
  // Days from J2000.0 (Jan 1, 2000 12:00 TT)
  const j2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0));
  const days = (dt.getTime() - j2000.getTime()) / 86400000;

  // Mean longitude
  const meanLong = (280.46 + 0.9856474 * days) % 360;

  // Mean anomaly
  const g = ((357.528 + 0.9856003 * days) % 360 + 360) % 360;
  const gRad = g * Math.PI / 180;

  // Equation of center
  const C = 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad);

  return ((meanLong + C) % 360 + 360) % 360;
}
```

### 3.5 Daily Code

```typescript
interface DailyCode {
  timestamp: Date;
  sunActivation: Activation;
  earthActivation: Activation;  // Earth = Sun + 180°
  geneKeyFocus: GeneKeyData;
}

function getDailyCode(dt: Date): DailyCode {
  const sunLong = approximateSunLongitude(dt); // or use ephemeris
  const earthLong = (sunLong + 180) % 360;

  return {
    timestamp: dt,
    sunActivation: longitudeToActivation(sunLong),
    earthActivation: longitudeToActivation(earthLong),
    geneKeyFocus: getGeneKeySpectrum(longitudeToActivation(sunLong).gate),
  };
}
```

### 3.6 Design Date (88° Solar Arc)

The "Design" personality is calculated by finding when the Sun was exactly **88° earlier** in ecliptic longitude before birth. This is NOT 88 calendar days — it's 88° of solar motion (~88.5 days).

```typescript
function calculateDesignDate(birthDate: Date): Date {
  const birthSunLong = getSunLongitude(birthDate); // via ephemeris
  const designLong = ((birthSunLong - 88) % 360 + 360) % 360;

  // Binary search or step backwards to find date where sun = designLong
  let dt = new Date(birthDate.getTime() - 88.5 * 86400000); // initial guess
  // ... refine by checking sun longitude at dt until match within 0.01°
  return dt;
}
```

### 3.7 Line Archetypes

```typescript
const LINE_ARCHETYPES: Record<number, string> = {
  1: 'Investigator',
  2: 'Hermit',
  3: 'Martyr',
  4: 'Opportunist',
  5: 'Heretic',
  6: 'Role Model',
};
```

### 3.8 Trigrams

```typescript
const TRIGRAMS = {
  HEAVEN:  { binary: '111', element: 'FIRE' },
  EARTH:   { binary: '000', element: 'EARTH' },
  THUNDER: { binary: '001', element: 'FIRE' },
  WATER:   { binary: '010', element: 'WATER' },
  MOUNTAIN:{ binary: '100', element: 'EARTH' },
  WIND:    { binary: '110', element: 'AIR' },
  FIRE:    { binary: '101', element: 'FIRE' },
  LAKE:    { binary: '011', element: 'WATER' },
};
```

### 3.9 Type Determination (Human Design)

```typescript
enum HDType { REFLECTOR, MANIFESTOR, GENERATOR, MANIFESTING_GENERATOR, PROJECTOR }

function determineType(definedCenters: Set<string>, channels: Channel[]): HDType {
  if (definedCenters.size === 0) return HDType.REFLECTOR;

  const hasSacral = definedCenters.has('Sacral');
  const motorToThroat = checkMotorToThroat(definedCenters, channels);

  if (hasSacral && motorToThroat) return HDType.MANIFESTING_GENERATOR;
  if (hasSacral) return HDType.GENERATOR;
  if (motorToThroat) return HDType.MANIFESTOR;
  return HDType.PROJECTOR;
}
```

**Motor-to-Throat detection** uses BFS:

```typescript
const MOTOR_CENTERS = ['Heart', 'SolarPlexus', 'Sacral', 'Root'];
const CENTER_CONNECTIONS: Record<string, string[]> = {
  // channel-based adjacency between centers
};

function checkMotorToThroat(definedCenters: Set<string>, channels: Channel[]): boolean {
  // BFS from each motor center to Throat through defined centers
  for (const motor of MOTOR_CENTERS) {
    if (!definedCenters.has(motor)) continue;
    if (bfsPathExists(motor, 'Throat', definedCenters, channels)) return true;
  }
  return false;
}
```

### 3.10 Profile & Incarnation Cross

```typescript
function calculateProfile(personalitySunLine: number, designSunLine: number): string {
  return `${personalitySunLine}/${designSunLine}`;
}

function getIncarnationCross(
  personalitySun: Activation,
  personalityEarth: Activation,
  designSun: Activation,
  designEarth: Activation
): IncarnationCross {
  // Cross name derived from the 4 gate numbers
  // Right Angle / Left Angle / Juxtaposition based on profile
}
```

### 3.11 GateData Structure

Each of the 64 gates has comprehensive metadata:

```typescript
interface GateData {
  number: number;
  // I-Ching
  iching_name: string;
  chinese: string;
  pinyin: string;
  judgment: string;
  image: string;
  // Human Design
  hd_name: string;
  keynote: string;
  center: string;
  circuit: string;
  stream: string;
  // Gene Keys
  shadow: string;
  gift: string;
  siddhi: string;
  programmingPartner: number;
  codonRing: string;
  aminoAcid: string;
  // Wheel position
  startDegree: number;
  endDegree: number;
  // Lines
  lines: Record<number, LineInterpretation>;
}
```

---

## 4. Observer — Pattern Detection

**Source**: `intelligence/observer/observer.py` (780 lines)  
**Purpose**: Statistical correlation analysis between cosmic events and user symptom/mood data.

### 4.1 Minimum Data Requirements

```typescript
const MIN_DATA_REQUIREMENTS = {
  solar:  { days: 30, entries: 10 },
  lunar:  { days: 60, entries: 15 },
  transit:{ days: 90, entries: 20 },
  time:   { days: 60, entries: 30 },
};
```

### 4.2 Solar Correlations

Pearson correlation between Kp index values and symptom scores. Must achieve:
- r ≥ 0.6
- p < 0.05
- Zero-variance check before computing to avoid NaN

```typescript
function detectSolarCorrelations(
  kpValues: number[],
  symptomScores: number[]
): Correlation[] {
  // Check variance > 0 for both arrays
  // Compute Pearson r, two-tailed p-value
  // Return correlations where |r| >= 0.6 AND p < 0.05
}
```

### 4.3 Lunar Correlations

Group entries by moon phase (New / Waxing / Full / Waning), compare mood/symptom distributions across groups.

### 4.4 Transit Correlations

Event co-occurrence analysis — do specific transits correlate with reported symptoms?

### 4.5 Full Analysis

`runFullAnalysis()`: Runs all 5 detection methods (solar, lunar, transit, time patterns, cyclical), returns combined results.

### 4.6 Internal Confidence

```typescript
function calculateConfidence(
  correlationStrength: number,
  pValue: number,
  sampleSize: number
): number {
  // Combines correlation, p-value, and sample size into 0-1 confidence
}
```

---

## 5. Cyclical Pattern Detector

**Source**: `intelligence/observer/cyclical.py` (1407 lines)  
**Purpose**: Detect patterns aligned to 52-day Magi periods and I-Ching gate transits.

### 5.1 Configuration Constants

```typescript
const CYCLICAL_CONFIG = {
  MIN_PERIODS_FOR_PATTERN: 3,
  MIN_JOURNAL_ENTRIES_PER_PERIOD: 5,
  SIGNIFICANCE_THRESHOLD: 0.05,
  CORRELATION_THRESHOLD: 0.70,
  MIN_FOLD_INCREASE: 1.5,
  MIN_MOOD_DIFFERENCE: 1.5, // on 1-10 scale
  PERIOD_DAYS: 52,
  PERIODS_PER_YEAR: 7,
};
```

### 5.2 Pattern Types

```typescript
enum CyclicalPatternType {
  PERIOD_SPECIFIC_SYMPTOM,     // Symptom spikes during specific planet period
  INTER_PERIOD_MOOD_VARIANCE,  // Mood differs across planetary periods
  INTER_PERIOD_ENERGY_VARIANCE,// Energy differs across planetary periods
  THEME_ALIGNMENT,             // Journal themes match planetary keywords
  CROSS_YEAR_EVOLUTION,        // Multi-year trend within a specific period
  PERIOD_CARD_CORRELATION,     // Card-specific patterns
  GATE_SPECIFIC_SYMPTOM,       // Symptom spikes during specific I-Ching gate
  INTER_GATE_MOOD_VARIANCE,    // Mood differs across gates
  GATE_POLARITY_PATTERN,       // Gate polarity effects
  GATE_LINE_CORRELATION,       // Line-specific patterns
}
```

### 5.3 Period-Specific Symptom Detection

```typescript
function detectPeriodSpecificSymptoms(entries: JournalEntry[]): CyclicalPattern[] {
  // 1. Group entries by planet period (using Cardology kernel)
  // 2. For each symptom:
  //    a. Calculate per-planet occurrence rate
  //    b. Calculate baseline rate across ALL periods
  //    c. Compute fold_increase = planetRate / baselineRate
  //    d. Run one-sample t-test against baseline
  //    e. Accept if fold_increase >= 1.5 AND p < 0.05
  //    f. Confidence = 1 - p_value
}
```

### 5.4 Inter-Period Mood/Energy Patterns

```typescript
function detectInterPeriodMoodPatterns(entries: JournalEntry[]): CyclicalPattern[] {
  // 1. Group mood scores by planet
  // 2. Run one-way ANOVA (scipy.stats.f_oneway) across groups
  //    - Requires p < 0.05
  // 3. Find highest and lowest planets
  // 4. Difference must be >= 1.5 on 1-10 scale
  // 5. Report which planets are highest/lowest mood
}
```

### 5.5 Theme Alignment

Planet themes for keyword matching:

```typescript
const PLANET_THEMES: Record<string, string[]> = {
  Mercury: ['communication', 'thinking', 'learning', 'writing', 'travel',
            'messaging', 'ideas', 'mental', 'quick', 'nervous'],
  Venus:   ['love', 'beauty', 'art', 'relationships', 'harmony',
            'pleasure', 'values', 'money', 'comfort', 'attraction'],
  Mars:    ['energy', 'action', 'conflict', 'anger', 'passion',
            'drive', 'physical', 'competition', 'courage', 'force'],
  Jupiter: ['expansion', 'luck', 'growth', 'abundance', 'wisdom',
            'optimism', 'travel', 'philosophy', 'blessing', 'opportunity'],
  Saturn:  ['discipline', 'restriction', 'lesson', 'karma', 'responsibility',
            'structure', 'limitation', 'challenge', 'fear', 'authority'],
  Uranus:  ['change', 'freedom', 'surprise', 'innovation', 'rebellion',
            'awakening', 'technology', 'independence', 'unusual', 'sudden'],
  Neptune: ['dream', 'intuition', 'illusion', 'spirituality', 'imagination',
            'confusion', 'compassion', 'art', 'escape', 'vision'],
};

function detectThemeAlignment(entries: JournalEntry[]): CyclicalPattern[] {
  // 1. For each planet period, collect all journal text
  // 2. Count keyword matches from PLANET_THEMES
  // 3. alignment = keyword_matches / total_keywords
  // 4. Compare to BASELINE_ALIGNMENT = 0.15
  // 5. Report significant above-baseline alignments
}
```

### 5.6 Cross-Year Evolution

```typescript
function detectCrossYearEvolution(entries: JournalEntry[]): CyclicalPattern[] {
  // 1. Group entries by planet AND year
  // 2. For each planet with 3+ years of data:
  //    a. Run linear regression (scipy.stats.linregress) of mood over years
  //    b. Require slope > 0.3 AND p < 0.05
  //    c. Report R², trend direction (improving/declining)
}
```

### 5.7 Gate-Specific Patterns

Similar to period-specific but groups by active I-Ching Sun gate (via `iChingKernel.getDailyCode()`).

### 5.8 Output Models

```typescript
interface CyclicalPattern {
  type: CyclicalPatternType;
  confidence: number;
  description: string;
  pValue: number;
  effectSize: number;
  periodsPlanet?: string;
  sunGate?: number;
  earthGate?: number;
  gateLine?: number;
  geneKeyGift?: string;
}

interface PeriodSnapshot {
  planet: string;
  card: string;
  startDate: Date;
  endDate: Date;
  theme: string;
  guidance: string;
  periodNumber: number;
  year: number;
}
```

---

## 6. Hypothesis — Models & Lifecycle

**Source**: `intelligence/hypothesis/models.py` (416 lines)

### 6.1 Enums

```typescript
enum HypothesisType {
  BIRTH_TIME,
  RISING_SIGN,
  COSMIC_SENSITIVITY,
  TEMPORAL_PATTERN,
  TRANSIT_EFFECT,
  THEME_CORRELATION,
  CYCLICAL_PATTERN,
}

enum HypothesisStatus {
  FORMING,    // confidence < 0.60
  TESTING,    // 0.60 ≤ confidence ≤ 0.85
  CONFIRMED,  // confidence > 0.85
  REJECTED,   // confidence < 0.20 with contradictions
  STALE,      // 60 days without new evidence
}
```

### 6.2 Hypothesis Model

```typescript
interface Hypothesis {
  id: string;
  type: HypothesisType;
  status: HypothesisStatus;
  description: string;
  confidence: number;

  evidenceRecords: EvidenceRecord[];
  confidenceHistory: ConfidenceSnapshot[];

  // Magi period correlations
  periodEvidenceCount: Record<string, number>; // planet → count

  // I-Ching correlations  
  gateEvidenceCount: Record<number, number>;   // gate → count
  lineEvidenceCount: Record<number, number>;   // line → count

  temporalContext: {
    currentPeriod?: string;
    currentCard?: string;
    currentGate?: number;
    currentLine?: number;
  };

  createdAt: Date;
  lastEvidenceAt: Date;
}
```

### 6.3 Key Methods

- `addEvidenceRecord(record)`: Appends to evidenceRecords, updates lastEvidenceAt
- `addConfidenceSnapshot(value, source)`: Appends to confidenceHistory
- `updateStatusFromConfidence()`: Maps confidence → status using thresholds
- `getTopContributors(n)`: Returns top-n evidence records by effective_weight
- `getConfidenceTrend()`: Returns recent confidence trajectory

---

## 7. Weighted Confidence Calculator

**Source**: `intelligence/hypothesis/confidence.py` (754 lines)  
**The most critical algorithm for hypothesis evaluation.**

### 7.1 Evidence Types & Base Weights

```typescript
enum EvidenceType {
  // Tier 1: Direct User Input (0.90–1.00)
  USER_CONFIRMATION      = 'USER_CONFIRMATION',      // 1.00
  USER_EXPLICIT_FEEDBACK = 'USER_EXPLICIT_FEEDBACK',  // 0.95
  BIRTH_DATA_PROVIDED    = 'BIRTH_DATA_PROVIDED',     // 1.00

  // Tier 2: Observable Data (0.65–0.80)
  JOURNAL_ENTRY          = 'JOURNAL_ENTRY',           // 0.75
  TRACKING_DATA_MATCH    = 'TRACKING_DATA_MATCH',     // 0.70
  MOOD_SCORE_ALIGNMENT   = 'MOOD_SCORE_ALIGNMENT',    // 0.72
  SYMPTOM_REPORT         = 'SYMPTOM_REPORT',          // 0.68

  // Tier 3: System Analysis (0.45–0.60)
  OBSERVER_PATTERN       = 'OBSERVER_PATTERN',        // 0.55
  COSMIC_CORRELATION     = 'COSMIC_CORRELATION',      // 0.50
  TRANSIT_ALIGNMENT      = 'TRANSIT_ALIGNMENT',       // 0.52
  THEME_ALIGNMENT        = 'THEME_ALIGNMENT',         // 0.48
  CYCLICAL_PATTERN       = 'CYCLICAL_PATTERN',        // 0.58

  // Tier 4: Computed Suggestions (0.25–0.40)
  MODULE_SUGGESTION      = 'MODULE_SUGGESTION',       // 0.35
  COSMIC_CALCULATION     = 'COSMIC_CALCULATION',      // 0.30
  GENESIS_REFINEMENT     = 'GENESIS_REFINEMENT',      // 0.40

  // Contradictions (negative)
  USER_REJECTION         = 'USER_REJECTION',          // -1.50
  COUNTER_PATTERN        = 'COUNTER_PATTERN',         // -0.80
  MISMATCH_EVIDENCE      = 'MISMATCH_EVIDENCE',       // -0.50
}

const BASE_WEIGHTS: Record<EvidenceType, number> = {
  [EvidenceType.USER_CONFIRMATION]:      1.00,
  [EvidenceType.USER_EXPLICIT_FEEDBACK]: 0.95,
  [EvidenceType.BIRTH_DATA_PROVIDED]:    1.00,
  [EvidenceType.JOURNAL_ENTRY]:          0.75,
  [EvidenceType.TRACKING_DATA_MATCH]:    0.70,
  [EvidenceType.MOOD_SCORE_ALIGNMENT]:   0.72,
  [EvidenceType.SYMPTOM_REPORT]:         0.68,
  [EvidenceType.OBSERVER_PATTERN]:       0.55,
  [EvidenceType.COSMIC_CORRELATION]:     0.50,
  [EvidenceType.TRANSIT_ALIGNMENT]:      0.52,
  [EvidenceType.THEME_ALIGNMENT]:        0.48,
  [EvidenceType.CYCLICAL_PATTERN]:       0.58,
  [EvidenceType.MODULE_SUGGESTION]:      0.35,
  [EvidenceType.COSMIC_CALCULATION]:     0.30,
  [EvidenceType.GENESIS_REFINEMENT]:     0.40,
  [EvidenceType.USER_REJECTION]:        -1.50,
  [EvidenceType.COUNTER_PATTERN]:       -0.80,
  [EvidenceType.MISMATCH_EVIDENCE]:     -0.50,
};
```

### 7.2 Source Reliability

```typescript
const SOURCE_RELIABILITY: Record<string, number> = {
  'user':              1.00,
  'user_tracking':     0.95,
  'journal_analysis':  0.85,
  'observer':          0.80,
  'observer_cyclical': 0.82,
  'cosmic_module':     0.75,
  'cardology_module':  0.70,
  'genesis':           0.65,
  'system':            0.60,
  'unknown':           0.50,
};
```

### 7.3 Evidence Record

```typescript
interface EvidenceRecord {
  id: string;
  evidenceType: EvidenceType;
  source: string;
  description: string;
  timestamp: Date;
  baseWeight: number;
  sourceReliability: number;
  recencyMultiplier: number;
  positionFactor: number;
  effectiveWeight: number;
}

function createEvidenceRecord(
  type: EvidenceType,
  source: string,
  description: string,
  position: number, // 0-based index in evidence list
  now: Date
): EvidenceRecord {
  const baseWeight = BASE_WEIGHTS[type];
  const reliability = SOURCE_RELIABILITY[source] ?? 0.50;
  const recency = calculateRecencyMultiplier(now, now); // at creation = 1.0
  const posFactor = 1 / (1 + 0.1 * position);

  let effectiveWeight: number;
  if (baseWeight < 0) {
    // Contradiction: doubled impact
    effectiveWeight = baseWeight * reliability * 2.0;
  } else {
    effectiveWeight = baseWeight * reliability * recency * posFactor;
  }

  return { /* all fields */ effectiveWeight };
}
```

### 7.4 Recency Decay

Exponential decay with 30-day half-life, floor at 0.10:

```typescript
const HALF_LIFE_DAYS = 30;
const RECENCY_FLOOR = 0.10;

function calculateRecencyMultiplier(evidenceDate: Date, now: Date): number {
  const ageDays = (now.getTime() - evidenceDate.getTime()) / 86400000;
  const lambda = Math.LN2 / HALF_LIFE_DAYS; // ln(2) / 30

  const multiplier = Math.exp(-lambda * ageDays);
  return Math.max(multiplier, RECENCY_FLOOR);
}
```

| Age (days) | Multiplier |
|------------|-----------|
| 0 | 1.000 |
| 15 | 0.707 |
| 30 | 0.500 |
| 60 | 0.250 |
| 90 | 0.125 |
| 120 | 0.100 (floor) |

### 7.5 Diminishing Returns

```typescript
function calculatePositionFactor(position: number): number {
  return 1 / (1 + 0.1 * position);
}
```

| Position | Factor |
|----------|--------|
| 0 | 1.000 |
| 1 | 0.909 |
| 5 | 0.667 |
| 10 | 0.500 |
| 20 | 0.333 |

### 7.6 Main Confidence Formula ⭐

```typescript
const BASE_CONFIDENCE = 0.20;
const CONFIDENCE_SCALE = 0.12;

function calculateConfidence(evidenceRecords: EvidenceRecord[]): number {
  // Sum all effective weights (including negatives from contradictions)
  const totalWeight = evidenceRecords.reduce(
    (sum, r) => sum + r.effectiveWeight, 0
  );

  // Raw confidence
  const raw = BASE_CONFIDENCE + (totalWeight * CONFIDENCE_SCALE);

  // Sigmoid normalization to [0, 1]
  const sigmoid = 1 / (1 + Math.exp(-5 * (raw - 0.5)));

  return Math.max(0, Math.min(1, sigmoid));
}
```

**Intuition**: Starts at 0.20 base, each evidence piece adds `effectiveWeight × 0.12`. The sigmoid with steepness 5 centered at 0.5 maps this to a smooth 0→1 curve. Contradictions pull the score down via negative effective weights.

### 7.7 Initial Confidence (for new hypotheses)

```typescript
function calculateInitialConfidence(
  baseWeight: number,
  reliability: number,
  dataPoints: number,
  correlationStrength: number
): number {
  const raw = BASE_CONFIDENCE
    + baseWeight * reliability
    * (Math.log(1 + dataPoints) / Math.log(11))
    * Math.abs(correlationStrength)
    * 0.5;

  return Math.min(raw, 0.75); // Cap at 0.75 for new hypotheses
}
```

### 7.8 Confidence Thresholds

```typescript
const THRESHOLDS = {
  FORMING:   0.60,  // < this
  TESTING:   0.85,  // between FORMING and this
  CONFIRMED: 0.85,  // > this
  REJECTED:  0.20,  // < this, with contradiction evidence
  STALE_DAYS: 60,   // days without evidence
};
```

---

## 8. Hypothesis Generator

**Source**: `intelligence/hypothesis/generator.py` (1054 lines)

Converts Observer patterns into formal hypotheses using `WeightedConfidenceCalculator`.

### 8.1 Pattern Type Mapping

| Observer Pattern | Hypothesis Type | Evidence Type |
|-----------------|-----------------|---------------|
| `solar_symptom` | COSMIC_SENSITIVITY | OBSERVER_PATTERN |
| `lunar_phase` | TEMPORAL_PATTERN | OBSERVER_PATTERN |
| `day_of_week` | TEMPORAL_PATTERN | OBSERVER_PATTERN |
| `transit_theme` | TRANSIT_EFFECT | TRANSIT_ALIGNMENT |

### 8.2 Temporal Context

Each hypothesis is enriched with current Magi context:
- Current planetary period card
- Planetary ruler
- Active I-Ching hexagram gate/line

### 8.3 Event Publication

On creation: publishes `HYPOTHESIS_GENERATED` event to Redis bus.

---

## 9. Genesis Engine

**Source**: `intelligence/genesis/engine.py` (766 lines), `hypothesis.py` (300 lines)  
**Purpose**: Birth-time and rising-sign refinement through iterative probing.

### 9.1 Genesis Hypothesis Model

Different from the main Hypothesis model — focused on candidate field values:

```typescript
interface GenesisHypothesis {
  field: string;           // e.g., 'rising_sign', 'birth_time'
  module: string;          // originating module
  suspectedValue: string;
  confidence: number;
  confidenceThreshold: number; // 0.80
  evidence: string[];
  contradictions: string[];
  probesAttempted: number; // max 3
  status: 'active' | 'confirmed' | 'refuted' | 'timeout' | 'superseded';
}

const CORE_FIELDS = new Set(['rising_sign', 'type', 'profile', 'authority']);
```

### 9.2 Priority Calculation

```typescript
function calculatePriority(hypothesis: GenesisHypothesis): number {
  // Closeness to threshold (max 0.4 weight)
  const closeness = 0.4 * (1 - Math.abs(hypothesis.confidenceThreshold - hypothesis.confidence));

  // Core field bonus (0.2 weight)
  const coreBonus = CORE_FIELDS.has(hypothesis.field) ? 0.2 : 0.0;

  // Freshness (0.2 weight) — newer = higher priority
  const freshness = 0.2 * (1 - hypothesis.probesAttempted / 3);

  // Evidence ratio (0.2 weight)
  const total = hypothesis.evidence.length + hypothesis.contradictions.length;
  const ratio = total > 0 ? hypothesis.evidence.length / total : 0.5;
  const evidenceScore = 0.2 * ratio;

  return closeness + coreBonus + freshness + evidenceScore;
}
```

### 9.3 Lifecycle

```
UncertaintyDeclaration → GenesisHypothesis → Probe (max 3) → Confirm/Refute
```

Subscribes to `MODULE_PROFILE_CALCULATED` and `GENESIS_UNCERTAINTY_DECLARED` events.

---

## 10. Harmonic Synthesis — Council of Systems

**Source**: `intelligence/synthesis/harmonic.py` (1163 lines)  
**Philosophy**: Cardology = Macro-Coordinate (52-day terrain), I-Ching = Micro-Coordinate (~6-day weather). Both are **sovereign** — neither overrides the other.

### 10.1 Elemental System

```typescript
enum Element { FIRE, WATER, AIR, EARTH, ETHER }

// 5×5 compatibility matrix
const ELEMENTAL_MATRIX: Record<Element, Record<Element, number>> = {
  [Element.FIRE]: {
    FIRE: 1.0, WATER: 0.3, AIR: 0.8, EARTH: 0.5, ETHER: 0.7
  },
  [Element.WATER]: {
    FIRE: 0.3, WATER: 1.0, AIR: 0.4, EARTH: 0.7, ETHER: 0.6
  },
  [Element.AIR]: {
    FIRE: 0.8, WATER: 0.4, AIR: 1.0, EARTH: 0.2, ETHER: 0.7
  },
  [Element.EARTH]: {
    FIRE: 0.5, WATER: 0.7, AIR: 0.2, EARTH: 1.0, ETHER: 0.5
  },
  [Element.ETHER]: {
    FIRE: 0.7, WATER: 0.6, AIR: 0.7, EARTH: 0.5, ETHER: 1.0
  },
};
```

### 10.2 Resonance Types

```typescript
enum ResonanceType {
  HARMONIC    = 'HARMONIC',    // score >= 0.8
  SUPPORTIVE  = 'SUPPORTIVE',  // score >= 0.6
  NEUTRAL     = 'NEUTRAL',     // score >= 0.4
  CHALLENGING = 'CHALLENGING', // score >= 0.2
  DISSONANT   = 'DISSONANT',   // score < 0.2
}

function getResonanceType(score: number): ResonanceType {
  if (score >= 0.8) return ResonanceType.HARMONIC;
  if (score >= 0.6) return ResonanceType.SUPPORTIVE;
  if (score >= 0.4) return ResonanceType.NEUTRAL;
  if (score >= 0.2) return ResonanceType.CHALLENGING;
  return ResonanceType.DISSONANT;
}
```

### 10.3 System Mappings

```typescript
// Cardology Suit → Element
const SUIT_TO_ELEMENT: Record<Suit, Element> = {
  [Suit.HEARTS]:   Element.WATER,
  [Suit.CLUBS]:    Element.FIRE,
  [Suit.DIAMONDS]: Element.EARTH,
  [Suit.SPADES]:   Element.AIR,
};

// Human Design Center → Element
const CENTER_TO_ELEMENT: Record<string, Element> = {
  'Head': Element.AIR, 'Ajna': Element.AIR,
  'Throat': Element.ETHER, 'G': Element.ETHER,
  'Heart': Element.FIRE,
  'Sacral': Element.WATER, 'SolarPlexus': Element.WATER,
  'Spleen': Element.EARTH, 'Root': Element.EARTH,
};

// Trigram → Element
const TRIGRAM_TO_ELEMENT: Record<string, Element> = {
  'Heaven': Element.FIRE, 'Thunder': Element.FIRE, 'Fire': Element.FIRE,
  'Earth': Element.EARTH, 'Mountain': Element.EARTH,
  'Water': Element.WATER, 'Lake': Element.WATER,
  'Wind': Element.AIR,
};
```

### 10.4 Frequency Band (Gene Keys Gamification)

```typescript
enum FrequencyBand {
  SHADOW = 'SHADOW', // 0–33% XP
  GIFT   = 'GIFT',   // 34–66% XP
  SIDDHI = 'SIDDHI', // 67–100% XP
}

function getFrequencyBand(xpPercentage: number): FrequencyBand {
  if (xpPercentage <= 33) return FrequencyBand.SHADOW;
  if (xpPercentage <= 66) return FrequencyBand.GIFT;
  return FrequencyBand.SIDDHI;
}
```

### 10.5 SystemReading — Standardized Output

```typescript
interface SystemReading {
  systemName: string;       // "Cardology", "I-Ching", etc.
  primarySymbol: string;    // "7♠", "Gate 41.3"
  element: Element;
  archetype: string;        // e.g. "Warrior", "Investigator"
  shadow: string;           // Gene Keys shadow frequency
  gift: string;             // Gene Keys gift frequency
  siddhi: string;           // Gene Keys siddhi frequency
  cycleDay: number;         // Day within current cycle
  cycleTotal: number;       // Total days in cycle
  cyclePercentage: number;  // cycleDay / cycleTotal
}
```

### 10.6 HarmonicSynthesis — Unified Output

```typescript
interface HarmonicSynthesis {
  resonanceScore: number;        // 0-1 overall harmony
  resonanceType: ResonanceType;
  elementalBalance: Record<Element, number>;
  macroTheme: string;            // From Cardology (52-day)
  microTheme: string;            // From I-Ching (~6-day)
  questSuggestions: string[];
  systemReadings: SystemReading[];
}
```

### 10.7 Council of Systems — Synthesis Algorithm

```typescript
class CouncilOfSystems {
  private systems: Map<string, SystemAdapter> = new Map();

  // All systems registered with EQUAL weight (sovereign)
  registerSystem(name: string, adapter: SystemAdapter): void;

  synthesize(userProfile: Profile, targetDate: Date): HarmonicSynthesis {
    // 1. Collect readings from all registered systems
    const readings = [...this.systems.values()]
      .map(adapter => adapter.getReading(userProfile, targetDate));

    // 2. Calculate elemental balance
    const balance = this.calculateElementalBalance(readings);

    // 3. Pairwise resonance across all systems
    const resonance = this.calculateResonance(readings);

    // 4. Determine unified frequency band
    const frequency = this.unifiedFrequency(readings);

    // 5. Generate guidance (LLM-assisted)
    const guidance = await this.generateGuidance(readings, resonance);

    // 6. Generate quest suggestions
    const quests = this.generateQuests(readings, resonance);

    return { resonanceScore: resonance, /* ... */ };
  }

  private calculateResonance(readings: SystemReading[]): number {
    // Pairwise elemental compatibility from ELEMENTAL_MATRIX
    let totalScore = 0;
    let pairs = 0;

    for (let i = 0; i < readings.length; i++) {
      for (let j = i + 1; j < readings.length; j++) {
        totalScore += ELEMENTAL_MATRIX[readings[i].element][readings[j].element];
        pairs++;
      }
    }

    return pairs > 0 ? totalScore / pairs : 0.5;
  }
}
```

### 10.8 Cross-System Synthesis (Card ↔ Hexagram)

```typescript
function crossSystemSynthesis(
  cardReading: SystemReading,
  hexagramReading: SystemReading
): number {
  const elementalScore = ELEMENTAL_MATRIX[cardReading.element][hexagramReading.element];
  const thematicScore = calculateThematicOverlap(cardReading, hexagramReading);

  return (elementalScore + thematicScore) / 2;
}
```

---

## 11. Profile Synthesizer

**Source**: `intelligence/synthesis/synthesizer.py` (375 lines)

LLM-driven master synthesis across all calculation modules.

```typescript
class ProfileSynthesizer {
  // 1. Discovers all calculated modules via CalculationModuleRegistry
  // 2. Formats each module's output as prompt sections
  // 3. Sends to Claude Sonnet 4.5 for unified narrative generation
  // 4. Stores synthesis in Active Memory
  // 5. Publishes SYNTHESIS_GENERATED event
  // Confidence = min(0.95, calculatedModules / totalPossible)
}
```

---

## 12. Insight Manager

**Source**: `intelligence/insight/manager.py` (797 lines)  
**Role**: "The Nervous System" — bridges Observer findings with active user interaction.

### 12.1 Cosmic Trigger Evaluation

```typescript
function evaluateCosmicTriggers(
  solarData: SolarData,
  lunarData: LunarData,
  observerFindings: Finding[]
): Trigger[] {
  // Solar: Kp >= 5
  // Lunar: new/full moon events
  // Cross-reference against Observer findings with confidence >= 0.6
}
```

### 12.2 Anti-Spam

**18-hour cooldown** per topic. No repeated notifications for the same pattern within this window.

### 12.3 Reflection Prompt Phases

```typescript
enum PromptPhase { ANTICIPATION, PEAK, INTEGRATION }
```

Different LLM prompt templates for each phase, generating personalized reflection questions.

### 12.4 Proactive Quest Generation

If confidence ≥ 0.8 for a pattern, generates a gamified quest via LLM (Solo Leveling style). Sends push notification with deep link to journal.

---

## 13. Tracking — Solar

**Source**: `tracking/solar/tracker.py` (478 lines)  
**Data Source**: NOAA Space Weather Prediction Center (SWPC)

### 13.1 API Endpoints

```typescript
const NOAA_ENDPOINTS = {
  KP_INDEX:  'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json',
  XRAY:      'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-1-day.json',
  MAG:       'https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json',
  PLASMA:    'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json',
};
```

### 13.2 Data Output

```typescript
interface SolarData {
  kpIndex: number;
  kpStatus: 'quiet' | 'unsettled' | 'active' | 'storm';
  solarFlares: FlareEvent[];
  bz: number;              // nT, interplanetary magnetic field
  bzOrientation: 'north' | 'south';
  solarWindSpeed: number;  // km/s
  solarWindDensity: number;
  stormPotential: number;  // 0-1
  shieldIntegrity: number; // 0-1
}
```

### 13.3 Significant Events

```typescript
function detectSignificantEvents(data: SolarData): SolarEvent[] {
  const events: SolarEvent[] = [];

  // G2–G5 geomagnetic storms (Kp >= 5)
  if (data.kpIndex >= 5) events.push({ type: 'GEO_STORM', severity: data.kpIndex });

  // Bz southward turn (< -5 nT)
  if (data.bz < -5) events.push({ type: 'BZ_SOUTHWARD', value: data.bz });

  // High-speed solar wind stream (> 600 km/s)
  if (data.solarWindSpeed > 600)
    events.push({ type: 'HIGH_SPEED_STREAM', speed: data.solarWindSpeed });

  // X-class or M-class flares
  for (const flare of data.solarFlares) {
    if (flare.classType.startsWith('X') || flare.classType.startsWith('M'))
      events.push({ type: 'SOLAR_FLARE', class: flare.classType });
  }

  return events;
}
```

### 13.4 Location-Aware Features

Aurora probability based on geomagnetic latitude. Viewing direction (north/south) based on hemisphere.

---

## 14. Tracking — Lunar

**Source**: `tracking/lunar/tracker.py` (406 lines)  
**Ephemeris**: Skyfield with NASA JPL DE421

### 14.1 Phase Calculation

```typescript
function calculateLunarPhase(dt: Date): LunarData {
  const sunLong = getSunEclipticLongitude(dt);   // via ephemeris
  const moonLong = getMoonEclipticLongitude(dt);  // via ephemeris

  const phaseAngle = ((moonLong - sunLong) % 360 + 360) % 360;
  const illumination = (1 + Math.cos(phaseAngle * Math.PI / 180)) / 2;

  return {
    phaseAngle,
    illumination,
    phaseName: getPhaseName(phaseAngle),
    zodiacSign: longitudeToZodiacSign(moonLong),
    distance: getMoonDistance(dt), // km
    supermoonScore: calculateSupermoonScore(getMoonDistance(dt)),
  };
}
```

### 14.2 Phase Names

```typescript
function getPhaseName(phaseAngle: number): string {
  if (phaseAngle < 22.5  || phaseAngle >= 337.5) return 'New Moon';
  if (phaseAngle < 67.5)  return 'Waxing Crescent';
  if (phaseAngle < 112.5) return 'First Quarter';
  if (phaseAngle < 157.5) return 'Waxing Gibbous';
  if (phaseAngle < 202.5) return 'Full Moon';
  if (phaseAngle < 247.5) return 'Waning Gibbous';
  if (phaseAngle < 292.5) return 'Last Quarter';
  return 'Waning Crescent';
}
```

### 14.3 Supermoon Score

```typescript
const MOON_PERIGEE = 363300;  // km
const MOON_APOGEE  = 405500;  // km

function calculateSupermoonScore(distanceKm: number): number {
  // 1.0 at perigee, 0.0 at apogee
  return (MOON_APOGEE - distanceKm) / (MOON_APOGEE - MOON_PERIGEE);
}
```

### 14.4 Void of Course

Calculated by finding the Moon's next zodiac sign ingress. Between last major aspect and ingress = VoC.

### 14.5 Natal Comparison

```typescript
function compareToNatal(transitMoon: LunarData, natalMoon: NatalMoon): NatalComparison {
  const inNatalSign = transitMoon.zodiacSign === natalMoon.sign;
  const lunarReturn = angularDistance(transitMoon.longitude, natalMoon.longitude) <= 5;

  return { inNatalSign, lunarReturn };
}
```

---

## 15. Tracking — Transits

**Source**: `tracking/transits/tracker.py` (308 lines)  
**Ephemeris**: Swiss Ephemeris (swisseph)

### 15.1 Aspect Definitions

```typescript
interface AspectDef {
  name: string;
  angle: number;
  orb: number;
}

const ASPECTS: AspectDef[] = [
  { name: 'conjunction',  angle: 0,   orb: 8 },
  { name: 'opposition',   angle: 180, orb: 8 },
  { name: 'square',       angle: 90,  orb: 6 },
  { name: 'trine',        angle: 120, orb: 6 },
  { name: 'sextile',      angle: 60,  orb: 4 },
];
```

### 15.2 Natal Comparison

```typescript
function compareToNatal(
  transitPlanets: PlanetPosition[],
  natalPlanets: PlanetPosition[]
): TransitAspect[] {
  const aspects: TransitAspect[] = [];

  for (const transit of transitPlanets) {
    for (const natal of natalPlanets) {
      for (const aspectDef of ASPECTS) {
        const angDist = angularDistance(transit.longitude, natal.longitude);
        const orbDiff = Math.abs(angDist - aspectDef.angle);

        if (orbDiff <= aspectDef.orb) {
          const isApplying = /* check if orb is decreasing */;
          aspects.push({
            transitPlanet: transit.name,
            natalPlanet: natal.name,
            aspectName: aspectDef.name,
            exactAngle: aspectDef.angle,
            actualOrb: orbDiff,
            isApplying,
          });
        }
      }
    }
  }

  return aspects;
}
```

### 15.3 Significant Transit Events

```typescript
function detectSignificantEvents(aspects: TransitAspect[]): TransitEvent[] {
  const events: TransitEvent[] = [];

  for (const aspect of aspects) {
    // Exact transit (orb < 1°)
    if (aspect.actualOrb < 1.0) {
      events.push({ type: 'EXACT_TRANSIT', aspect });
    }
  }

  // Retrograde station changes
  // ... detect when planet speed crosses zero

  return events;
}
```

---

## 16. Event Bus & Module Registry

### 16.1 Event Bus

Redis-backed pub/sub. All modules communicate through typed event constants:

```typescript
const EVENTS = {
  HYPOTHESIS_GENERATED:         'hypothesis.generated',
  HYPOTHESIS_CONFIRMED:         'hypothesis.confirmed',
  HYPOTHESIS_REJECTED:          'hypothesis.rejected',
  CYCLICAL_PATTERN_DETECTED:    'cyclical.pattern.detected',
  MODULE_PROFILE_CALCULATED:    'module.profile.calculated',
  GENESIS_UNCERTAINTY_DECLARED: 'genesis.uncertainty.declared',
  SYNTHESIS_GENERATED:          'synthesis.generated',
} as const;
```

### 16.2 Module Registry

`CalculationModuleRegistry` discovers and iterates calculation modules. Each module has:
- `manifest.json` (metadata, required fields, description)
- `module.py` (implements `calculate(profile)`)
- `schemas.py` (Pydantic input/output models)
- `brain/` (LLM prompt templates)

Registered modules: astrology, chinese_astrology, enneagram, gene_keys, human_design, kabbalah, mayan_calendar, name_analysis, numerology, vedic_astrology.

---

## Appendix: Key Formulas Quick Reference

| Formula | Expression |
|---------|-----------|
| **Birth Card** | `sv = 55 - (month×2 + day)`, map to suit by range |
| **I-Ching Gate** | `angle = (lon + 58) % 360; idx = floor(angle/360 × 64); gate = CIRCLE[idx]` |
| **I-Ching Line** | `floor((angle/360 × 384) % 6) + 1` |
| **Design Date** | Sun longitude − 88° (solar arc, not days) |
| **Recency Decay** | `e^(−(ln2/30) × days)`, floor 0.10 |
| **Position Factor** | `1 / (1 + 0.1 × position)` |
| **Effective Weight** | `base × reliability × recency × position` (or `× 2.0` for contradictions) |
| **Confidence** | `sigmoid(5 × (0.20 + Σ_weights × 0.12 − 0.5))` |
| **Initial Confidence** | `0.20 + base × rel × log(1+n)/log(11) × |r| × 0.5`, cap 0.75 |
| **Resonance** | Avg pairwise `ELEMENTAL_MATRIX[e1][e2]` across all systems |
| **Lunar Illumination** | `(1 + cos(phaseAngle)) / 2` |
| **Supermoon Score** | `(405500 − distance) / (405500 − 363300)` |
| **Sun Longitude (approx)** | `(280.46 + 0.9856474×d) + 1.915×sin(g) + 0.020×sin(2g)` |
| **Planetary Period** | 52 days each, Mercury → Neptune; Neptune gets remainder |
| **Quadration** | Deal 48 cards 3-at-a-time into 4 piles → stack → deal 1-at-a-time → stack |

---

*Generated from GUTTERS source at `C:\dev\GUTTERS\src`. All algorithms are stateless unless noted.*
