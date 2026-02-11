# DROFBOT: Phase 5 — The Visual Layer

> **What this is**: A comprehensive scope for the Drofbot frontend — a PWA dashboard that serves as the visual cockpit for the intelligence system built in Phases 1-4. This isn't admin tooling. This is the mirror through which the operator sees themselves reflected through the system's understanding.

> **What we're building on**: OpenClaw already has a "Control UI" — a browser-based admin dashboard for managing sessions, channels, config, and chat. That stays as-is for sysadmin tasks. Phase 5 is a **separate, purpose-built frontend application** — the Drofbot Dashboard — served from the same VPS but on its own port/subdomain (e.g. `dashboard.drofbot.yourdomain.com` via Cloudflare Tunnel).

> **Design philosophy**: GUTTERS had a frontend. We're not copying its design — we're evolving it. GUTTERS was a tracking tool with cosmic features. Drofbot is an intelligence with a visual interface. The design direction is **"Quiet Intelligence"** — an interface that earns authority through restraint, precision, and clarity. Light, clean, minimal. The depth is felt through the quality of the information and the care of the typography, not through decorative theming. Think: the calm focus of a research instrument, the editorial clarity of a well-typeset journal, the understated confidence of something that doesn't need to announce what it is.

---

## ARCHITECTURE

### Tech Stack

```
Frontend:         Vite + React 18 + TypeScript
Styling:          Tailwind CSS + custom CSS for animations/effects
State:            Zustand (lightweight, no boilerplate)
Data:             Supabase JS client (direct DB reads) + Drofbot REST API (writes/actions)
Charts:           D3.js for cosmic visualizations, Recharts for simple data
PWA:              Vite PWA plugin (manifest + service worker + push notifications)
Deployment:       Static build served by Caddy/Nginx on VPS, behind Cloudflare Tunnel
```

### Why This Stack

- **Vite + React**: Fast builds, HMR in dev, tiny production bundles. No SSR needed — this is a single-user dashboard, not a public website.
- **Supabase client**: The frontend reads directly from the same Supabase instance that Drofbot writes to. Real-time subscriptions mean the dashboard updates live as the agent stores memories, detects patterns, generates hypotheses.
- **Drofbot REST API**: A thin Express API layer added to the Drofbot process. Handles authenticated writes — quest completion, hypothesis confirmation, preference updates, journal entry creation. The frontend doesn't write to Supabase directly to maintain data integrity (everything goes through the same validation pipeline as Telegram commands).
- **PWA**: manifest.json + service worker via `vite-plugin-pwa`. Add to home screen on iOS/Android. Push notifications via Web Push API for briefings and cosmic alerts (complements Telegram, doesn't replace it).

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Dashboard      │────▶│  Supabase       │◀────│   Drofbot       │
│   (React PWA)    │ read│  (PostgreSQL)   │write│   (Node.js)     │
│                  │◀────│                 │     │                 │
│                  │ RT  │  Real-time subs │     │  Brain/Council  │
│                  │     └─────────────────┘     │  Memory/Intel   │
│                  │                              │  Observer/Hypo  │
│                  │────▶ Drofbot REST API ──────▶│  Progression    │
│                  │write (authenticated)          │  Preferences    │
└─────────────────┘                              └─────────────────┘
```

The dashboard is a **read-heavy, write-light** application. Most interactions are viewing data. Writes (journal entries, quest completion, preference changes) go through the API to ensure cosmic enrichment and intelligence pipeline integration.

---

## API LAYER

### New file: `src/api/dashboard.ts`

A lightweight Express router mounted on the Drofbot process (or a separate port). Endpoints:

```
Authentication:
  POST   /api/auth/login          — API key or token-based auth (single-user, simple)

Journal:
  POST   /api/journal/entry       — Create journal entry (gets cosmic enrichment + memory storage)
  GET    /api/journal/entries      — List entries with pagination, date range, cosmic filters
  GET    /api/journal/:id          — Full entry with cosmic context

Intelligence:
  GET    /api/hypotheses           — List with status filter
  POST   /api/hypotheses/:id/confirm  — Confirm hypothesis (same as chat tool)
  POST   /api/hypotheses/:id/reject   — Reject hypothesis
  GET    /api/patterns             — List Observer patterns
  GET    /api/patterns/:id         — Pattern detail with statistics

Progression:
  GET    /api/progression          — Current stats (XP, level, rank, streak, sync, frequency)
  GET    /api/quests               — Active/completed/expired quests
  POST   /api/quests/:id/complete  — Complete quest with optional reflection
  POST   /api/quests               — Create custom quest

Council:
  GET    /api/cosmic/current       — Current cosmic weather (all 6 systems)
  GET    /api/cosmic/synthesis     — Full Master Synthesis (same as system prompt injection)
  GET    /api/cosmic/card          — Today's card + planetary period
  GET    /api/cosmic/gate          — Current gate + line + Gene Keys
  GET    /api/cosmic/solar         — Space weather
  GET    /api/cosmic/lunar         — Moon phase
  GET    /api/cosmic/transits      — Planetary transits + natal aspects
  POST   /api/cosmic/calculate     — Standalone calculation for any date/person

Profile:
  GET    /api/profile              — Operator profile (birth data, confirmed facts, HD type, etc.)
  GET    /api/profile/synthesis    — Current Master Synthesis document

Preferences:
  GET    /api/preferences          — All current preferences
  PUT    /api/preferences          — Update preferences
  GET    /api/preferences/briefings — Briefing config
  PUT    /api/preferences/briefings — Update briefing config

Memory:
  GET    /api/memory/recent        — Recent memories across all banks
  GET    /api/memory/search        — Semantic search across memories
  GET    /api/memory/stats         — Memory bank statistics

Identity:
  GET    /api/identity/self        — Drofbot's own profile (its chart, its cosmic state)
  GET    /api/identity/relationship — Operator↔Drofbot cosmic relationship
```

### Authentication

Simple bearer token auth. A single API key stored in the Drofbot config that the dashboard sends with every request. No user accounts, no OAuth — this is a single-operator system. The token is set during deployment and stored in the PWA's localStorage (or a secure cookie).

---

## PAGES & COMPONENTS

### Page 1: HOME — "The Observatory"

The landing view. Everything at a glance.

**Layout**: Full-screen dashboard with modular cards. No scrolling for the primary view — everything visible at once on desktop, scrollable stack on mobile.

**Components**:

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Drofbot identity + operator name + cosmic time │
│  (current gate, moon phase icon, Kp indicator, period)  │
├───────────────────────┬─────────────────────────────────┤
│                       │                                 │
│  COSMIC WEATHER       │  TODAY'S CARD                   │
│  (radial viz of all   │  (visual card + period info     │
│   6 Council systems   │   + karma connections)          │
│   as a mandala)       │                                 │
│                       │                                 │
├───────────────────────┼─────────────────────────────────┤
│                       │                                 │
│  ACTIVE QUESTS        │  PROGRESSION                    │
│  (top 3 quests with   │  (XP bar, rank badge, level,   │
│   cosmic alignment)   │   streak flame, frequency band) │
│                       │                                 │
├───────────────────────┼─────────────────────────────────┤
│                       │                                 │
│  LATEST INSIGHT       │  OBSERVER PULSE                 │
│  (most recent hypo    │  (live pattern detection feed   │
│   or confirmed find)  │   with confidence indicators)   │
│                       │                                 │
└───────────────────────┴─────────────────────────────────┘
```

**Key interactions**:
- Clicking any card navigates to its detail page
- Cosmic weather mandala animates subtly with real data
- Quest cards show cosmic alignment score (resonance with current weather)
- Real-time updates via Supabase subscriptions

---

### Page 2: JOURNAL — "The Chronicle"

Where the operator records and reviews their experience. This is the primary write interface.

**Journal Entry Creation**:
- Rich text editor (Markdown support, or clean textarea with preview)
- Optional mood/energy/clarity sliders (1-10, operator-configurable which to show)
- Optional tags (free-form)
- Automatic cosmic context badge (shows current gate, period, moon phase at time of writing)
- "Quick capture" mode — just a text input, one tap to submit
- Voice note support (if browser supports MediaRecorder API — record, transcribe client-side or send audio to API)

**Journal Entry Storage Flow**:
```
User writes entry in PWA
  → POST /api/journal/entry { content, mood, energy, tags }
  → Drofbot API receives
  → Cosmic enrichment (full CosmicTimestamp of current moment)
  → Memory classifier routes to episodic bank
  → Hypothesis Engine tests against active hypotheses
  → Observer adds to pattern detection corpus
  → Response: { id, cosmicContext, matchedHypotheses }
  → Dashboard shows entry with cosmic ribbon
```

**Journal Timeline View**:
- Chronological feed (newest first)
- Each entry shows: date, cosmic context ribbon (gate icon, period planet, moon phase), content preview, mood indicators, matched hypotheses
- Filter by: date range, tag, mood range, cosmic period, gate, moon phase
- "Cosmic calendar" view — calendar grid with entries color-coded by resonance score or mood

**Journal Detail View**:
- Full entry text
- Cosmic context panel (what was happening in every Council system when this was written)
- Related Observer patterns (if this entry contributed to a pattern detection)
- Hypothesis evidence (if this entry was used as evidence for any hypothesis)
- Navigation to adjacent entries

**Integration with Chat**:
Journal entries created through Telegram conversation (when the operator journals by chatting) also appear here. The API endpoint is the same — the memory classifier detects journal-like content and stores it appropriately. The dashboard reads the same episodic memory bank regardless of entry source.

---

### Page 3: QUESTS — "The Path"

Active quest board and completion interface.

**Layout**: Kanban-style columns — Active | Available | Completed | Expired

**Quest Card**:
- Title + description
- Difficulty badge (Easy/Medium/Hard/Elite) with XP reward
- Cosmic alignment indicator (how well this quest resonates with current cosmic weather)
- Source indicator (auto-generated from Observer vs. cosmic event vs. custom)
- Expiry countdown if applicable
- "Complete" button → opens reflection modal (optional text, optional mood)

**Quest Detail**:
- Full description
- Cosmic context of when quest was generated
- Why it was generated (which pattern or cosmic event triggered it)
- Insight multiplier eligibility (linked to confirmed hypothesis? → 1.5× XP)
- Completion history for similar quests

**Quest Creation**:
- Title, description, difficulty selector
- Optional: link to hypothesis (for insight multiplier)
- Optional: expiry date
- Optional: recurring (daily/weekly)

---

### Page 4: COSMOS — "The Weather"

Full cosmic weather display with all 6 Council systems.

**Primary Visualization: The Mandala**
A circular visualization showing all active cosmic data simultaneously:

```
                    ┌── GATE (I-Ching wheel, 64 segments) ──┐
                   /                                          \
              ┌── TRANSITS (planetary ring) ──┐                │
             /                                 \               │
        ┌── CARD (current period planet) ──┐    │              │
       /                                    \   │              │
  ┌── MOON (phase in center) ──┐             │  │              │
  │         🌓                  │             │  │              │
  └────────────────────────────┘             │  │              │
       \                                    /   │              │
        └──────────────────────────────────┘    │              │
             \                                 /               │
              └────────────────────────────────┘               │
                   \                                          /
                    └─────────────────────────────────────────┘
```

This is a custom D3.js component — nested rings representing each system with the current state highlighted. The outermost ring shows the 64 I-Ching gates with the current gate illuminated. Next ring shows transit positions. Inner ring shows the current card period. Center shows moon phase.

**System Detail Panels** (below mandala, or on click):

1. **Cardology Panel**: Birth card visual, current planetary period with progress bar (day X of 52), current period card, karma cards, upcoming period transition date
2. **I-Ching / Gene Keys Panel**: Current gate number + name, line, color/tone/base, Gene Keys shadow/gift/siddhi, gate transit timeline (when current gate started, when it ends)
3. **Human Design Panel**: Type, authority, profile, defined/undefined centers visualization (bodygraph simplified), current transit activations
4. **Solar Panel**: Kp index gauge, recent flare activity, solar wind speed, geomagnetic storm level, historical Kp chart (last 7 days)
5. **Lunar Panel**: Moon phase visual, illumination percentage, zodiac sign, days to next phase transitions, supermoon score
6. **Transits Panel**: Planet positions table with signs, retrograde indicators, active aspects to natal chart

**Harmonic Synthesis Bar**: A horizontal bar at the top showing the overall resonance score with elemental breakdown (fire/water/air/earth/ether proportions).

---

### Page 5: INTELLIGENCE — "The Mirror"

The hypothesis tracker and Observer findings. Where the operator sees what the system has learned about them.

**Hypothesis Board**:
- Cards grouped by status: FORMING | TESTING | CONFIRMED | REJECTED
- Each card shows: statement, confidence gauge (0-1 with color), evidence count, last updated, category
- Click → detail view with full evidence chain:
  - Timeline of evidence records (each with type, weight, source, date, cosmic context)
  - Confidence history chart (how confidence changed over time)
  - Confirm/Reject buttons (same as chat tools)
  - Related patterns

**Observer Findings**:
- Feed of detected patterns, most significant first
- Each pattern shows: type badge (cyclical/cosmic/temporal/threshold/absence), description, confidence, statistical measures (Pearson r, p-value, fold-increase)
- Click → detail view with:
  - Data visualization (scatter plot for correlations, bar chart for period comparisons)
  - Supporting episodes (which memories triggered this pattern)
  - Related hypotheses (which theories were generated from this pattern)

**Profile View (The Identity)**:
- Confirmed facts (birth data, HD type, authority, profile, birth card)
- Uncertain facts (things Drofbot suspects but hasn't confirmed, with confidence scores)
- Communication preferences
- Behavioral tendencies (observed patterns about the operator's habits)

---

### Page 6: PROGRESSION — "The Ascent"

Gamification visualization. Where growth becomes tangible.

**Primary Display**:
- Large rank badge with rank name (e.g. "C — Cultivation")
- Level number with XP progress bar to next level
- XP earned today / this week / this month
- Streak tracker (fire animation for active streaks)
- Sync rate gauge (cosmic alignment percentage)
- Gene Keys frequency band visualization (Shadow → Gift → Siddhi continuum with current position)

**XP History Chart**: 
Line chart showing XP accumulation over time, with cosmic period annotations (vertical lines for period transitions, gate changes, significant cosmic events).

**Achievement Timeline**:
Chronological feed of level-ups, rank promotions, quest completions, hypotheses confirmed, patterns discovered — each with cosmic context.

**Quest Statistics**:
- Completion rate by difficulty
- Average completion time
- Most common quest themes
- XP earned by quest type

---

### Page 7: SETTINGS — "The Forge"

Configuration interface that reads/writes to the same preferences store as the chat tools.

**Sections**:

1. **Briefing Schedule**:
   - Toggle: Morning / Midday / Evening / Cosmic Alerts
   - Time picker for each
   - Day-of-week selector for midday (daily, weekdays, MWF, etc.)
   - Kp threshold slider for cosmic alerts
   - Briefing style selector (concise / detailed / poetic)

2. **Communication Preferences**:
   - Style: direct / warm / poetic / technical
   - Verbosity: minimal / normal / verbose
   - Timezone selector
   - Wake/sleep time (controls quiet hours for notifications)
   - Primary channel: Telegram / Discord / WhatsApp

3. **Journal Configuration**:
   - Which sliders to show (mood, energy, clarity, custom)
   - Default tags
   - Quick capture shortcut
   - Auto-prompt frequency (how often Drofbot nudges for journal entries)

4. **Progression Configuration**:
   - Quest generation frequency
   - Difficulty bias (more easy / balanced / more hard)
   - Notification on level-up: yes/no
   - Notification on quest expiry: yes/no

5. **Display Preferences**:
   - Theme: light (default) / dark / system
   - Dashboard density: default / compact / expanded
   - Which home cards to show/hide
   - Number format: decimal / percentage

6. **Identity Data**:
   - Birth date, time, location (editable — triggers recalculation)
   - Confirmed/uncertain toggle for birth time
   - Drofbot birth datetime configuration

7. **System Info**:
   - Drofbot version, uptime, last cron runs
   - Memory bank stats (entries per bank, total size)
   - Model configuration (current models per tier)
   - Soul Archive: Export / Import buttons

---

## PWA CONFIGURATION

### manifest.json
```json
{
  "name": "Drofbot",
  "short_name": "Drofbot",
  "description": "Your Sovereign Intelligence Dashboard",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f8f6f1",
  "theme_color": "#f8f6f1",
  "orientation": "any",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Service Worker
- **Offline caching**: Cache the app shell (HTML, CSS, JS, fonts, icons) so the dashboard loads instantly even offline. Data requires network.
- **Push notifications**: Register for Web Push. The Drofbot cron system sends push events for briefings and cosmic alerts to registered endpoints. This means your morning briefing appears as both a Telegram message AND a PWA notification (tapping opens the dashboard to the briefing view).
- **Background sync**: If you write a journal entry while offline, it queues and syncs when reconnected.

### Installation Flow
1. User opens `dashboard.drofbot.yourdomain.com` in mobile Safari/Chrome
2. Browser detects PWA manifest, shows "Add to Home Screen" prompt
3. User adds → Drofbot icon appears on home screen
4. Tapping opens full-screen (no browser chrome)
5. Push notification permission requested on first open

---

## DESIGN LANGUAGE

### Aesthetic Direction: "Quiet Intelligence"

The interface doesn't announce that it's cosmic or mystical. It presents deeply intelligent information with such clarity and precision that the depth speaks for itself. Cosmic data is treated with the same visual gravity as a well-designed research tool — functional beauty, zero ornamentation. Sophistication through restraint.

The feeling when you open it: calm, focused, grounded. Like opening a beautifully typeset book. Like a tool made by someone who respects your attention. You immediately know this was built with intention because nothing is wasted.

**Reference points** (for the implementing agent's intuition):
- Linear — clean surfaces, precise type, restrained color
- Stripe Dashboard — information density without clutter
- Things 3 — warmth and care in a productivity tool
- Apple Health — scientific data presented with editorial clarity
- A well-typeset academic journal — the depth is in the content, the design serves it

**Color Palette**:
```css
:root {
  /* Ground — warm light backgrounds with paper-like quality */
  --ground-1: #f8f6f1;           /* Primary background — warm off-white, like good paper */
  --ground-2: #f0ede6;           /* Secondary background — slightly deeper, for cards */
  --ground-3: #e8e4db;           /* Tertiary — used for hover states, active elements */
  --ground-4: #ddd8cd;           /* Borders, dividers — visible but quiet */
  
  /* Ink — text hierarchy through weight and opacity, not color variety */
  --ink-1: #1a1816;              /* Primary text — near-black with warmth, not pure #000 */
  --ink-2: #4a4640;              /* Secondary text — descriptions, metadata */
  --ink-3: #8a8580;              /* Tertiary — timestamps, labels, placeholders */
  --ink-4: #b5b0a8;             /* Quaternary — disabled, decorative */
  
  /* Accent — ONE color used sparingly, earns attention by rarity */
  --accent: #2c5a4a;             /* Deep sage — grounded, natural, intelligent */
  --accent-light: #3d7a66;       /* Lighter variant for hover */
  --accent-subtle: rgba(44, 90, 74, 0.08);  /* Background tint for accent areas */
  
  /* Semantic — quiet, desaturated tones that communicate without screaming */
  --positive: #3d7a56;           /* Confirmation, high confidence — forest green */
  --caution: #8a7a3d;            /* Warning, moderate confidence — muted amber */
  --negative: #8a4a3d;           /* Rejection, low confidence — muted brick */
  --neutral: #6a6a6a;            /* Neutral state */
  
  /* Frequency bands (Gene Keys) — desaturated, sophisticated */
  --shadow: #7a5a6a;             /* Dusty mauve — shadow frequency */
  --gift: #5a7a6a;               /* Sage — gift frequency */
  --siddhi: #7a7a5a;             /* Warm olive — siddhi frequency */
  
  /* Elements — muted earth tones, not saturated primaries */
  --fire: #b07050;               /* Terracotta */
  --water: #507090;              /* Slate blue */
  --air: #90905a;                /* Dried grass */
  --earth: #608050;              /* Moss */
  --ether: #706090;              /* Lavender grey */
  
  /* Confidence spectrum — subtle gradient from cool to warm */
  --confidence-low: #b5b0a8;     /* Same as ink-4, barely there */
  --confidence-mid: #8a7a3d;     /* Amber hint */
  --confidence-high: #3d7a56;    /* Forest green */
  --confidence-confirmed: #2c5a4a; /* Full accent — earned */
  
  /* Surface layers — for elevation and cards */
  --surface-raised: #ffffff;     /* Cards, modals — pure white against warm ground */
  --surface-inset: #f3f0e9;     /* Inset areas, code blocks */
  --border: #e0dbd2;            /* Default border — warm grey */
  --border-subtle: #ebe8e1;     /* Lighter border — card edges */
  
  /* Shadow — warm, not grey */
  --shadow-sm: 0 1px 2px rgba(26, 24, 22, 0.04);
  --shadow-md: 0 2px 8px rgba(26, 24, 22, 0.06);
  --shadow-lg: 0 4px 16px rgba(26, 24, 22, 0.08);
}
```

**Typography**:
```css
/* 
 * Two fonts only. Restraint is the point.
 * The contrast between serif display and clean sans body 
 * creates all the visual hierarchy needed.
 */

/* Display — serif with character and warmth */
@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,300;400;600&display=swap');

/* Body + UI + Data — one family, different weights do the work */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;400;500;600&display=swap');

:root {
  --font-display: 'Source Serif 4', Georgia, serif;
  /* Headings, page titles, rank names, card names, 
     hypothesis statements — anything that deserves 
     to feel considered and weighty */
     
  --font-body: 'DM Sans', -apple-system, sans-serif;
  /* Everything else: body text, labels, data values, 
     timestamps, buttons, navigation. 
     Mono-width numerals via font-variant-numeric: tabular-nums 
     for data alignment — no separate mono font needed */
}

/* Key typographic rules */
body {
  font-family: var(--font-body);
  font-size: 15px;              /* Slightly above default — comfortable reading */
  line-height: 1.6;
  color: var(--ink-1);
  -webkit-font-smoothing: antialiased;
  font-variant-numeric: tabular-nums; /* Aligned numbers everywhere */
}

h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: 400;             /* Light weight — confidence doesn't need bold */
  letter-spacing: -0.01em;      /* Slight tightening for display sizes */
}

/* Data values get specific treatment */
.data-value {
  font-family: var(--font-body);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;       /* Slightly open for readability */
}
```

**Spatial Rules**:
- **Generous whitespace.** The most important design element. Space around cards, between sections, around data. White space is what makes the information breathe and communicates that nothing here is an afterthought.
- **Consistent spacing scale.** 4px base: 4, 8, 12, 16, 24, 32, 48, 64. No arbitrary values.
- **Cards**: White (`--surface-raised`) with `--border-subtle` borders (1px), `--shadow-sm` elevation. No rounded corners beyond 6px. No colored backgrounds on cards — the content provides the visual interest.
- **Content width**: Maximum 1120px for main content. Narrower (680px) for single-column views like journal entries. Data density is controlled by width, not by shrinking elements.
- **Grid**: CSS Grid for page layouts, not flexbox hacks. 12-column on desktop, single-column on mobile. Gutters: 24px.

**Interaction & Motion**:
- **Transitions**: Fast and functional — 150-200ms, ease-out. Nothing theatrical. A button responds, a card lifts on hover, a page crossfades. The interface feels responsive, not animated.
- **Hover states**: Subtle. Background shift to `--ground-3`, border darkens slightly. Cards get `--shadow-md`. That's it.
- **Page transitions**: Simple crossfade (opacity 0→1, 200ms). No sliding, no scaling.
- **Data loading**: Skeleton placeholders in `--ground-3` that pulse gently. Never spinners.
- **The one exception**: The cosmic mandala on the Cosmos page. This single component is allowed to be visually rich — it's a D3 data visualization, and precision visualizations SHOULD be detailed. But even here, the aesthetic is "scientific instrument" not "magical portal." Clean lines, precise positioning, muted colors from the palette.

**What This Is NOT**:
- Dark mode by default (dark is offered as an option, not the identity)
- Themed to look "cosmic" or "mystical" or "spiritual"
- Decorated with gradients, glows, particle effects, or noise textures
- Using color to create mood — color is used for information
- Trying to impress — it's trying to be useful
- Over-animated or effect-heavy
- Using more than two font families

**What This IS**:
- A clean, warm, light interface that feels like a well-made tool
- Sophisticated through typography, spacing, and information hierarchy
- Deep because the CONTENT is deep, not the visual treatment
- The kind of interface where you notice how good it feels to use, not how it looks
- Designed so that a hypothesis with confidence 0.73 just READS as important — no gauge, no glow needed (though a thin bar is fine)
- Something you open every morning and it immediately orients you without competing for your attention
- Quiet enough that the cosmic data feels like natural phenomena being observed, not spectacle being performed

---

## FILE STRUCTURE

```
src/dashboard/
├── index.html
├── main.tsx
├── App.tsx
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── api/                          # API client
│   ├── client.ts                 # Fetch wrapper with auth
│   ├── journal.ts                # Journal endpoints
│   ├── intelligence.ts           # Hypothesis/pattern endpoints
│   ├── progression.ts            # Quest/XP endpoints
│   ├── cosmic.ts                 # Council/weather endpoints
│   ├── preferences.ts            # Settings endpoints
│   └── supabase.ts               # Direct Supabase client for reads + real-time
│
├── stores/                       # Zustand stores
│   ├── cosmic.ts                 # Current cosmic weather state
│   ├── progression.ts            # XP, level, rank, quests
│   ├── intelligence.ts           # Hypotheses, patterns
│   ├── journal.ts                # Journal entries
│   ├── preferences.ts            # User preferences
│   └── auth.ts                   # Auth token
│
├── pages/
│   ├── Home.tsx                  # The Observatory
│   ├── Journal.tsx               # The Chronicle
│   ├── JournalEntry.tsx          # Single entry view
│   ├── JournalCreate.tsx         # New entry editor
│   ├── Quests.tsx                # The Path
│   ├── QuestDetail.tsx
│   ├── Cosmos.tsx                # The Weather
│   ├── Intelligence.tsx          # The Mirror
│   ├── HypothesisDetail.tsx
│   ├── PatternDetail.tsx
│   ├── Progression.tsx           # The Ascent
│   └── Settings.tsx              # The Forge
│
├── components/
│   ├── layout/
│   │   ├── Shell.tsx             # App shell with nav
│   │   ├── Header.tsx            # Top bar with cosmic time
│   │   ├── Nav.tsx               # Side/bottom navigation
│   │   └── PageTransition.tsx    # Route transitions
│   │
│   ├── cosmic/
│   │   ├── Mandala.tsx           # The circular cosmic visualization (D3)
│   │   ├── CardDisplay.tsx       # Playing card visual
│   │   ├── GateWheel.tsx         # I-Ching gate wheel segment
│   │   ├── MoonPhase.tsx         # Calculated moon phase SVG
│   │   ├── KpGauge.tsx           # Solar activity arc gauge
│   │   ├── PlanetRow.tsx         # Transit planet position
│   │   ├── ResonanceBar.tsx      # Elemental harmony bar
│   │   ├── PeriodProgress.tsx    # Magi period progress indicator
│   │   └── CosmicRibbon.tsx      # Inline cosmic context summary
│   │
│   ├── intelligence/
│   │   ├── HypothesisCard.tsx    # Hypothesis summary card
│   │   ├── ConfidenceGauge.tsx   # Arc-style confidence meter
│   │   ├── EvidenceTimeline.tsx  # Evidence chain visualization
│   │   ├── PatternCard.tsx       # Observer pattern card
│   │   └── StatChart.tsx         # Pattern statistics visualization
│   │
│   ├── progression/
│   │   ├── RankBadge.tsx         # Rank visual (E through SS)
│   │   ├── XPBar.tsx             # Experience progress bar
│   │   ├── StreakFlame.tsx       # Animated streak indicator
│   │   ├── FrequencyBand.tsx     # Shadow/Gift/Siddhi continuum
│   │   ├── QuestCard.tsx         # Quest summary card
│   │   └── SyncGauge.tsx         # Cosmic sync rate
│   │
│   ├── journal/
│   │   ├── EntryEditor.tsx       # Rich entry creation form
│   │   ├── EntryCard.tsx         # Entry in timeline
│   │   ├── MoodSlider.tsx        # Slider with cosmic correlation
│   │   ├── TagInput.tsx          # Tag management
│   │   ├── CosmicCalendar.tsx    # Calendar view with cosmic annotations
│   │   └── QuickCapture.tsx      # Minimal fast-entry component
│   │
│   └── shared/
│       ├── Card.tsx              # Base card component
│       ├── Badge.tsx             # Status/type badges
│       ├── Gauge.tsx             # Arc gauge base component
│       ├── Timeline.tsx          # Generic timeline
│       ├── LoadingPulse.tsx      # Loading state
│       └── EmptyState.tsx        # Empty state messaging
│
├── hooks/
│   ├── useCosmicWeather.ts       # Polls/subscribes to cosmic state
│   ├── useRealtime.ts            # Supabase real-time subscription wrapper
│   ├── useAuth.ts                # Auth token management
│   └── usePushNotifications.ts   # Web Push registration
│
├── utils/
│   ├── cosmic-icons.ts           # SVG icon mapping for gates, planets, phases
│   ├── card-visuals.ts           # Playing card rendering helpers
│   ├── format.ts                 # Date, number, cosmic formatting
│   └── colors.ts                 # Dynamic color calculations
│
├── assets/
│   ├── noise.svg                 # Texture overlay
│   ├── cards/                    # Card face images (or SVG generation)
│   └── icons/                    # PWA icons + nav icons
│
└── pwa/
    ├── sw.ts                     # Service worker
    └── push.ts                   # Push notification handlers
```

---

## SERVER-SIDE: API LAYER

### New files in Drofbot codebase:

```
src/api/
├── server.ts                     # Express app setup, CORS, auth middleware
├── routes/
│   ├── journal.ts                # Journal CRUD
│   ├── intelligence.ts           # Hypothesis/pattern endpoints
│   ├── progression.ts            # Quest/XP endpoints
│   ├── cosmic.ts                 # Council calculations
│   ├── preferences.ts            # Settings CRUD
│   ├── profile.ts                # Operator profile
│   ├── memory.ts                 # Memory search/stats
│   └── identity.ts               # Drofbot self-awareness data
├── middleware/
│   ├── auth.ts                   # Bearer token validation
│   └── cosmic-enrich.ts          # Auto-enrich requests with cosmic context
└── push/
    └── web-push.ts               # Web Push notification sender
```

### Integration with existing Drofbot process

The Express API runs inside the same Node.js process as the agent. It imports and calls the same functions the agent tools call:

```typescript
// Example: POST /api/journal/entry
import { episodicBank } from '../brain/memory/banks/episodic';
import { enrichWithCosmic } from '../brain/council/enrichment';
import { hypothesisEngine } from '../brain/intelligence/hypothesis';

router.post('/entry', auth, async (req, res) => {
  const { content, mood, energy, tags } = req.body;
  
  // Same pipeline as when operator journals through chat
  const cosmicContext = await enrichWithCosmic(new Date());
  const entry = await episodicBank.store({
    content,
    metadata: { mood, energy, tags, source: 'dashboard', ...cosmicContext }
  });
  
  // Test against hypotheses (same as chat flow)
  const matches = await hypothesisEngine.testEvidence(entry);
  
  res.json({ entry, cosmicContext, matchedHypotheses: matches });
});
```

This ensures the dashboard and Telegram are equivalent entry points into the same intelligence system. Data created through either channel is indistinguishable once stored.

---

## IMPLEMENTATION PHASES

### Phase 5a: API Layer + Foundation (est. ~80 tests)

1. Express API server with auth middleware
2. All API routes (journal, intelligence, progression, cosmic, preferences, profile, memory, identity)
3. Web Push notification integration with briefing cron
4. Vite + React project scaffolding with routing, Zustand stores, Supabase client
5. PWA configuration (manifest, service worker, icons)
6. App shell (layout, navigation, header with cosmic time)

**Deliverable**: The API works, the app loads, navigation between pages works, auth works, PWA installs.

### Phase 5b: Core Visualizations (est. ~40 tests)

1. Cosmic Mandala component (D3.js — the centerpiece)
2. Card display component (visual playing card)
3. Moon phase SVG (calculated, not static)
4. Kp gauge, resonance bar, period progress
5. Confidence gauge (arc meter)
6. Rank badge, XP bar, streak flame, frequency band
7. Cosmic ribbon (inline cosmic context summary)

**Deliverable**: All visual components render with real data from the API.

### Phase 5c: Page Implementation (est. ~60 tests)

1. Home page ("The Observatory") — all cards with real data, real-time updates
2. Journal page ("The Chronicle") — timeline, create, detail, cosmic calendar
3. Quests page ("The Path") — kanban board, complete/create, detail
4. Cosmos page ("The Weather") — mandala + all system detail panels
5. Intelligence page ("The Mirror") — hypothesis board, pattern feed, profile view
6. Progression page ("The Ascent") — stats, XP chart, achievement timeline
7. Settings page ("The Forge") — all preference panels with real read/write

**Deliverable**: Every page functional with real data, all writes go through API and persist.

### Phase 5d: Polish & PWA (est. ~20 tests)

1. Animations and transitions (page transitions, card hover states, gauge animations)
2. Responsive design (mobile-first for PWA home screen use)
3. Push notification flow (register, receive, tap-to-open-page)
4. Offline shell caching
5. Background sync for journal entries
6. Loading states, empty states, error handling
7. Theme consistency pass — every component matches the design language

**Deliverable**: Production-ready PWA that installs, receives notifications, works offline for shell, and looks beautiful.

---

## TOTAL ESTIMATED SCOPE

- **API routes**: ~15 endpoints
- **React components**: ~40 components
- **Pages**: 7 main pages + sub-pages
- **New tests**: ~200 (API + component + integration)
- **New files**: ~80 files (frontend) + ~15 files (API server)

This is the largest phase by file count but much of it is presentation logic — React components rendering data that already exists in the database. The hard work (calculations, intelligence, memory, patterns) is already done in Phases 2-4. Phase 5 is giving it a face.

---

## WHAT GUTTERS HAD vs. WHAT DROFBOT WILL HAVE

| Feature | GUTTERS | Drofbot Dashboard |
|---------|---------|-------------------|
| Journal | Manual entries in web form | Entries from chat OR PWA, cosmic-enriched, auto-tested against hypotheses |
| Quests | Static task list | Dynamic quests generated from cosmic weather + Observer patterns, XP rewards |
| Card Display | Static birth card | Live period card with timeline, karma connections, spread navigation |
| Cosmic Weather | Basic display | Full mandala with all 6 systems, real-time, interactive |
| Patterns | Summary text | Statistical visualizations with confidence, evidence chains |
| Hypotheses | None | Full lifecycle management with confirm/reject from dashboard |
| Progression | Basic level | XP, 7 ranks, Gene Keys frequency, sync rate, streaks, achievements |
| Configuration | Settings page | Self-configuring — chat OR dashboard, same preferences store |
| PWA | No | Full PWA with push notifications, offline shell, add to home screen |
| Real-time | Page refresh | Supabase real-time subscriptions, live updates |
| Drofbot's Own Chart | No | Drofbot's cosmic state + relationship to operator's weather |

---

## INSTRUCTION FORMAT

This scope document is the **what**. The implementation instruction documents (one per sub-phase: 5a, 5b, 5c, 5d) will be the **how** — surgical guides with exact file paths, code patterns, test expectations. Same format as the Phase 4 instruction and refinement documents.

The agent will need:
- The Drofbot codebase (for the API layer and existing types/functions)
- The GUTTERS frontend source (for reference on journal/quest/card UI patterns)
- This scope document (for the architectural decisions and design language)

---

## DEPLOYMENT NOTE

The dashboard is built as a static Vite bundle (`npm run build` → `dist/` folder). In production:

```
VPS
├── Drofbot process (Node.js)
│   ├── Agent runtime (Telegram, tools, cron)
│   ├── Dashboard API (Express, port 3001)
│   └── WebSocket (Gateway, port 18789)
├── Caddy or Nginx
│   ├── dashboard.drofbot.yourdomain.com → serves dist/ static files + proxies /api to :3001
│   └── gateway.drofbot.yourdomain.com → proxies to :18789
├── PostgreSQL (Supabase or local)
└── Cloudflare Tunnel (routes external traffic to Caddy)
```

One VPS. One `docker-compose.yml`. Everything lives together. The dashboard is just static HTML/CSS/JS served alongside the agent process.
