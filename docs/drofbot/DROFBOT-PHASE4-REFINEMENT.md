# DROFBOT: Phase 4 Refinement Pass

> **CONTEXT**: Phase 4 is complete (523 tests, clean build). This refinement pass addresses five areas: algorithm fidelity verification, agent tools for intelligence interaction, standalone cosmic calculation tools, memory schema completion, and self-configuration tools. This is NOT a rewrite — it's surgical additions and corrections to the existing Phase 4 code.

> **Do NOT run the full test suite (it takes 26 minutes). Write tests for new components only. Do not make git commits.**

---

## AREA 1: ALGORITHM FIDELITY VERIFICATION

Before anything else, verify these two critical algorithms match the GUTTERS Algorithmic Reference exactly.

### 1a. Cardology — Verify Quadration Algorithm

Open `src/brain/council/systems/cardology.ts` and verify:

- [ ] The **birth card formula** is `solarValue = 55 - (month * 2 + day)` with proper wrapping for negatives and Joker for Dec 31
- [ ] The **Natural Spread** is an 8×8 grid filled right-to-left, rows 1-7, with Crown row 0 holding J♠/Q♠/K♠
- [ ] The **quadration algorithm** is fully implemented: deal 48 cards 3-at-a-time into 4 piles, last 4 cards one-per-pile, stack 4th→3rd→2nd→1st, deal 1-per-pile into 4 new piles, stack again
- [ ] **Life Spread** = quadrate Natural once
- [ ] **Spiritual Spread** = quadrate Natural twice
- [ ] **Grand Solar Spread** for age N = quadrate Natural `(age % 90) + 1` times
- [ ] **Planetary periods** = 7 periods of 52 days each (Mercury → Neptune), Neptune gets remainder days
- [ ] **Planetary card navigation** = from birth card position in spread, move LEFT by planet offset (Mercury=1, Venus=2, Mars=3, Jupiter=4, Saturn=5, Uranus=6, Neptune=7), wrap across rows
- [ ] **Karma cards** = cross-reference Natural and Life spread positions, with Fixed cards (K♠, J♥, 8♣) having no karma, and semi-fixed pairs swapping

If ANY of the above are simplified, stubbed, or use a different algorithm — **reimplement faithfully** using the GUTTERS Algorithmic Reference §2 (Cardology Kernel). These are pure math functions. Every constant and step matters.

### 1b. I-Ching — Verify Sun Longitude Calculation

Open `src/brain/council/systems/iching.ts` and verify:

- [ ] Gate calculation uses **actual Sun ecliptic longitude**, NOT a date hash or day-of-year mapping
- [ ] The formula is: `angle = ((longitude + 58) % 360 + 360) % 360; gateIndex = Math.floor(angle / 360 * 64); gate = GATE_CIRCLE[gateIndex]`
- [ ] The **GATE_CIRCLE** array matches the Rave Mandala sequence: `[41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60]`
- [ ] **Line calculation**: `Math.floor((pct * 384) % 6) + 1` where `pct = angle / 360`
- [ ] **Color, tone, base** cascade correctly per §3.3 of the reference
- [ ] **Sun longitude** uses either the approximate formula (`(280.46 + 0.9856474 * d) + 1.915 * sin(g) + 0.020 * sin(2g)` where d = days from J2000.0) or an astronomy library — NOT a date hash
- [ ] **Earth gate** = Sun longitude + 180°

If the I-Ching system uses a date hash, day-of-year mapping, or any other shortcut instead of actual solar longitude → gate mapping, **reimplement faithfully** using the GUTTERS Algorithmic Reference §3 (I-Ching Kernel). The approximate Sun longitude formula (§3.4) gives ±1° accuracy which is sufficient for gate-level precision (each gate spans 5.625°).

**Write verification tests**: Given a known date, assert the correct gate and line. Example test cases:
- J2000.0 epoch (Jan 1, 2000 12:00 UTC): Sun longitude ≈ 280.46°, verify expected gate
- Equinoxes: March 20 (Sun ≈ 0°), September 22 (Sun ≈ 180°), verify expected gates

---

## AREA 2: AGENT TOOLS FOR INTELLIGENCE INTERACTION

The intelligence subsystem exists but the operator cannot interact with it through conversation yet. The LLM needs tools to query and modify intelligence data.

Register these as agent tools using the existing OpenClaw tool registration pattern (study how memory tools are registered in Phase 2).

### 2a. Hypothesis Tools

Create `src/brain/intelligence/tools.ts`:

```typescript
// Tool: hypothesis_list
// Description: "List hypotheses filtered by status. Returns id, statement, confidence, status, evidence count, last updated."
// Parameters: { status?: 'active' | 'confirmed' | 'rejected' | 'all' }
// Returns: Array of hypothesis summaries

// Tool: hypothesis_detail
// Description: "Get full details of a hypothesis including all evidence records, confidence history, and cosmic context."
// Parameters: { id: string }
// Returns: Full hypothesis with evidence chain

// Tool: hypothesis_confirm
// Description: "Record operator confirmation of a hypothesis. Adds USER_CONFIRMATION evidence (weight 1.00) and recalculates confidence."
// Parameters: { id: string, note?: string }
// Returns: Updated hypothesis with new confidence

// Tool: hypothesis_reject
// Description: "Record operator rejection of a hypothesis. Adds USER_REJECTION evidence (weight -1.50) and recalculates confidence."
// Parameters: { id: string, reason?: string }
// Returns: Updated hypothesis with new confidence

// Tool: hypothesis_create
// Description: "Manually create a hypothesis from operator statement. Use when operator shares a belief about themselves."
// Parameters: { statement: string, category: string, initialEvidence?: string }
// Returns: New hypothesis with initial confidence
```

### 2b. Observer Tools

```typescript
// Tool: pattern_list
// Description: "List detected patterns from the Observer. Shows pattern type, description, confidence, and supporting data."
// Parameters: { type?: string, minConfidence?: number }
// Returns: Array of pattern summaries

// Tool: pattern_detail
// Description: "Get full details of a detected pattern including statistical measures and cosmic correlations."
// Parameters: { id: string }
// Returns: Full pattern with evidence
```

### 2c. Progression Tools

```typescript
// Tool: progression_status
// Description: "Get current progression stats: XP, level, rank, sync rate, streak, frequency band."
// Parameters: {}
// Returns: Full progression snapshot

// Tool: quest_list
// Description: "List quests filtered by status."
// Parameters: { status?: 'active' | 'completed' | 'expired' | 'all' }
// Returns: Array of quest summaries

// Tool: quest_complete
// Description: "Mark a quest as completed. Awards XP, updates level/rank, records cosmic context."
// Parameters: { id: string, reflection?: string }
// Returns: Completion result with XP gain details

// Tool: quest_create
// Description: "Create a custom quest from operator request."
// Parameters: { title: string, description: string, difficulty: 'easy' | 'medium' | 'hard' | 'elite', expiresIn?: string }
// Returns: New quest
```

### 2d. Register All Tools

Wire these tools into the agent's tool registry following the same pattern used for memory tools. The LLM should be able to discover and call them naturally during conversation.

**Write tests** for each tool: verify correct data is returned, confirm/reject updates confidence appropriately, quest completion awards correct XP.

---

## AREA 3: STANDALONE COSMIC CALCULATION TOOLS

**This is critical.** The operator must be able to use the Council systems as independent calculation tools — for ANY date, ANY person, not just themselves. These are general-purpose cosmic calculators that happen to also power Drofbot's internal intelligence.

### 3a. Cardology Calculator Tool

```typescript
// Tool: cardology_calculate
// Description: "Calculate cardology information for any person or date. Can compute birth card, current planetary period, period card for any date, karma cards, ruling card, and full spread analysis."
// Parameters: {
//   birthMonth: number,
//   birthDay: number,
//   targetDate?: string,        // ISO date — defaults to today
//   includeSpread?: boolean,    // include full life/spiritual spread analysis
//   includeKarma?: boolean,     // include karma card calculation
//   includeRelationship?: {     // compare with another card
//     otherBirthMonth: number,
//     otherBirthDay: number
//   }
// }
// Returns: {
//   birthCard: { rank, suit, solarValue },
//   zodiacSign: string,
//   currentPeriod: { planet, card, dayInPeriod, totalDays, startDate, endDate },
//   allPeriods?: PlanetaryPeriod[],   // all 7 periods for the current year
//   karmaCards?: { first, second },
//   rulingCard?: Card,
//   relationship?: RelationshipConnection[]
// }
```

This calls the existing CardologySystem's calculation methods but exposes them as a standalone tool. The operator can say:
- "What's my card for today?" → calls with their birth date, today's date
- "What card is my friend born July 4th?" → calls with July 4
- "What period was I in last October 15th?" → calls with their birth date, target date Oct 15
- "What's the relationship between me and someone born March 22?" → calls with both birth dates

### 3b. I-Ching / Gate Calculator Tool

```typescript
// Tool: iching_calculate
// Description: "Calculate I-Ching gate, line, and Gene Keys data for any date. Uses actual Sun longitude."
// Parameters: {
//   date?: string,              // ISO date — defaults to today
//   includeEarth?: boolean,     // include Earth gate (opposite)
//   includeGeneKeys?: boolean,  // include shadow/gift/siddhi
//   includeDesignDate?: boolean,// calculate design date (requires birthDate)
//   birthDate?: string          // for design date calculation
// }
// Returns: {
//   sunGate: number,
//   sunLine: number,
//   gateName: string,
//   sunColor?: number,
//   sunTone?: number,
//   sunBase?: number,
//   earthGate?: number,
//   earthLine?: number,
//   geneKey?: { shadow, gift, siddhi, codonRing },
//   designDate?: { date, sunGate, sunLine }
// }
```

The operator can say:
- "What gate is active today?" → today's date
- "What gate was active on my birthday?" → their birth date
- "What was the gate on February 3rd 2024?" → specific historical date
- "What's my design date?" → uses their birth date to find 88° solar arc

### 3c. Human Design Calculator Tool

```typescript
// Tool: human_design_calculate
// Description: "Calculate Human Design chart for a given birth date, time, and location. Returns type, authority, profile, defined centers, channels, and incarnation cross."
// Parameters: {
//   birthDate: string,          // ISO date
//   birthTime?: string,         // HH:MM (24h). If omitted, uses noon and flags uncertainty.
//   birthLatitude?: number,
//   birthLongitude?: number,
//   birthTimezone?: string
// }
// Returns: {
//   type: string,               // Generator, Projector, Manifestor, etc.
//   authority: string,
//   profile: string,            // e.g. "4/6"
//   definedCenters: string[],
//   undefinedCenters: string[],
//   definedChannels: { from, to, name }[],
//   incarnationCross: string,
//   uncertainBirthTime: boolean  // true if time wasn't provided
// }
```

### 3d. Solar Weather Tool

```typescript
// Tool: solar_weather
// Description: "Get current space weather data: Kp index, solar flares, solar wind, geomagnetic conditions."
// Parameters: {}
// Returns: { kpIndex, stormLevel, recentFlares, solarWindSpeed, bzOrientation, stormPotential }
```

### 3e. Lunar Phase Tool

```typescript
// Tool: lunar_calculate
// Description: "Calculate lunar phase for any date."
// Parameters: { date?: string }  // defaults to now
// Returns: { phaseName, illumination, zodiacSign, phaseAngle, supermoonScore }
```

### 3f. Transit Tool

```typescript
// Tool: transit_calculate
// Description: "Calculate current planetary transits, optionally compared to a natal chart."
// Parameters: {
//   date?: string,              // defaults to now
//   natalBirthDate?: string,    // for natal comparison
//   natalBirthTime?: string
// }
// Returns: {
//   planetPositions: { planet, longitude, sign, retrograde }[],
//   natalAspects?: { transitPlanet, natalPlanet, aspect, orb, applying }[]
// }
```

### 3g. Harmonic Synthesis Tool

```typescript
// Tool: cosmic_synthesis
// Description: "Get the full harmonic synthesis for a person on a given date. Combines all Council systems into a unified reading with resonance score."
// Parameters: {
//   birthMonth: number,
//   birthDay: number,
//   birthTime?: string,
//   date?: string               // defaults to today
// }
// Returns: {
//   resonanceScore: number,
//   resonanceType: string,
//   elementalBalance: Record<Element, number>,
//   systemReadings: SystemReading[],
//   guidance: string
// }
```

### Implementation Note

These tools should call the EXISTING Council system implementations. Do NOT duplicate calculation logic. The tools are thin wrappers that:
1. Parse the operator's natural language parameters
2. Call the relevant `CosmicSystem.calculate()` method (or the underlying calculation functions directly for standalone queries)
3. Format the result for conversational presentation

The key difference from the internal Council usage is: internal Council always uses the operator's configured birth data and current time. These standalone tools accept ANY birth data and ANY target date as parameters.

For **historical date queries** (e.g., "what gate was active on Feb 3, 2024?"), the I-Ching system already supports arbitrary dates via its Sun longitude calculation. The cardology system already supports arbitrary target dates for period calculation. Solar and lunar systems may need to support historical date parameters — solar via NOAA historical API, lunar via astronomical calculation (which is inherently historical-capable).

**Write tests** for each tool with various date inputs including past dates.

---

## AREA 4: MEMORY SCHEMA COMPLETION

### 4a. Add Metadata Columns to Semantic and Procedural Banks

Currently only episodic (`context` JSONB) and relational (`metadata` JSONB) banks support cosmic enrichment. Semantic and procedural banks are missing a generic JSONB column.

Create a migration (or ALTER TABLE statements):

```sql
-- Add metadata JSONB to semantic memory
ALTER TABLE semantic_memory ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add metadata JSONB to procedural memory  
ALTER TABLE procedural_memory ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
```

### 4b. Wire Cosmic Enrichment to All Four Banks

Update the cosmic enrichment in `src/brain/council/enrichment.ts` (or wherever the store-time enrichment happens) to also enrich semantic and procedural memory entries. All four banks should call the enrichment function before inserting.

### 4c. Write Tests

- Verify all four banks store cosmic timestamps in their metadata
- Verify retrieval with cosmic filters works across all banks

---

## AREA 5: SELF-CONFIGURATION TOOLS

The operator must be able to modify Drofbot's behavior through natural conversation. These tools let the LLM update configuration in response to operator requests.

### 5a. Briefing Configuration Tool

```typescript
// Tool: update_briefing_config
// Description: "Update briefing schedule and preferences. Operator can change times, frequency, skip conditions, and content preferences."
// Parameters: {
//   morning?: { enabled: boolean, time?: string, daysOfWeek?: string[] },
//   midday?: { enabled: boolean, time?: string, daysOfWeek?: string[] },
//   evening?: { enabled: boolean, time?: string },
//   cosmicAlerts?: { enabled: boolean, kpThreshold?: number },
//   style?: string  // e.g. "concise", "detailed", "poetic"
// }
```

When the operator says "make midday check-ins every other day" or "only alert me for Kp above 7" or "make briefings shorter," the LLM calls this tool. The briefing runner reads these preferences before generating each briefing.

### 5b. Reminder Tool

```typescript
// Tool: create_reminder
// Description: "Create a one-time or recurring reminder. Delivered via the primary channel at the specified time."
// Parameters: {
//   message: string,
//   datetime?: string,          // ISO datetime for one-time
//   recurring?: { cron: string, until?: string },
//   checkUp?: boolean           // if true, Drofbot follows up to ask if it was done
// }
```

### 5c. Preference Tool

```typescript
// Tool: update_preferences
// Description: "Update operator preferences for communication style, notification frequency, and agent behavior."
// Parameters: {
//   communicationStyle?: string,   // "direct", "warm", "poetic", etc.
//   notificationFrequency?: string, // "minimal", "normal", "verbose"
//   timezone?: string,
//   wakeTime?: string,
//   sleepTime?: string,
//   primaryChannel?: string
// }
```

### 5d. Storage

Preferences are stored in a `preferences` table in Supabase (create if not exists) or as semantic memories with category "preference". The briefing runner, synthesis engine, and response generation all read from this store. Changes through conversation and changes through the dashboard (Phase 5) write to the same store.

**Write tests** for each configuration tool.

---

## VERIFICATION CHECKLIST

When complete, the following should all be true:

- [ ] Cardology quadration algorithm matches GUTTERS §2 exactly
- [ ] I-Ching gate calculation uses Sun longitude, not date hash
- [ ] Operator can ask "what hypotheses are active?" and get a real answer
- [ ] Operator can say "I'm definitely a Projector" and hypothesis updates to CONFIRMED
- [ ] Operator can say "what's my friend's birth card? They're born July 4th"
- [ ] Operator can say "what gate was active on February 3rd 2024?"
- [ ] Operator can say "what period was I in last October?"
- [ ] Operator can say "make morning briefings 30 minutes later"
- [ ] Operator can say "remind me to call the bank tomorrow at 2 PM"
- [ ] Cosmic timestamps are stored on ALL four memory banks
- [ ] All new tools are registered and discoverable by the LLM
- [ ] Tests pass for all new components
