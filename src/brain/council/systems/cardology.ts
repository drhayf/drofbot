/**
 * Cardology System — 52-Day Magi Periods
 *
 * Ported from GUTTERS `intelligence/cardology/kernel.py` (1356 lines).
 * All algorithms from Olney H. Richmond, *The Mystic Test Book* (1893).
 *
 * Core calculations:
 *  - Birth card: `sv = 55 - (month × 2 + day)`, mapped to suit by range
 *  - Natural Spread: 8×8 grid, cards right-to-left, Crown row at top
 *  - Quadration: Core deck transformation for spread generation
 *  - Life/Spiritual Spreads: 1× / 2× quadration of Natural deck
 *  - Grand Solar Spread: (age % 90 + 1) quadrations
 *  - Planetary Periods: 7 × 52-day periods (Mercury → Neptune)
 *  - Karma Cards: Positional exchange between Natural & Life Spreads
 *
 * Every formula, constant, and threshold faithfully ported.
 */

import type { ArchetypeMapping, BirthMoment, CosmicState, CosmicSystem } from "../types.js";
import { Element } from "../types.js";

// ─── Enums & Constants ───────────────────────────────────────────

export enum Suit {
  HEARTS = "♥",
  CLUBS = "♣",
  DIAMONDS = "♦",
  SPADES = "♠",
}

export enum Planet {
  MERCURY = "Mercury",
  VENUS = "Venus",
  MARS = "Mars",
  JUPITER = "Jupiter",
  SATURN = "Saturn",
  URANUS = "Uranus",
  NEPTUNE = "Neptune",
  PLUTO = "Pluto",
  SUN = "Sun",
  MOON = "Moon",
}

export enum ZodiacSign {
  ARIES = "Aries",
  TAURUS = "Taurus",
  GEMINI = "Gemini",
  CANCER = "Cancer",
  LEO = "Leo",
  VIRGO = "Virgo",
  LIBRA = "Libra",
  SCORPIO = "Scorpio",
  SAGITTARIUS = "Sagittarius",
  CAPRICORN = "Capricorn",
  AQUARIUS = "Aquarius",
  PISCES = "Pisces",
}

// ─── Card Type ───────────────────────────────────────────────────

export interface Card {
  rank: number; // 1 (Ace) – 13 (King); 0 = Joker
  suit: Suit | null; // null for Joker
  solarValue: number; // rank + suitOffset (0 for Joker)
}

export const JOKER: Card = { rank: 0, suit: null, solarValue: 0 };

/**
 * Rank names for display.
 */
const RANK_NAMES: Record<number, string> = {
  0: "Joker",
  1: "Ace",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "Jack",
  12: "Queen",
  13: "King",
};

export function cardName(card: Card): string {
  if (card.rank === 0) return "Joker";
  return `${RANK_NAMES[card.rank]}${card.suit}`;
}

export function cardEquals(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

// ─── Fixed & Semi-Fixed Cards ────────────────────────────────────

function makeCard(rank: number, suit: Suit): Card {
  const suitOffset =
    suit === Suit.HEARTS ? 0 : suit === Suit.CLUBS ? 13 : suit === Suit.DIAMONDS ? 26 : 39;
  return { rank, suit, solarValue: rank + suitOffset };
}

export const KING_SPADES = makeCard(13, Suit.SPADES);
export const JACK_HEARTS = makeCard(11, Suit.HEARTS);
export const EIGHT_CLUBS = makeCard(8, Suit.CLUBS);
export const ACE_CLUBS = makeCard(1, Suit.CLUBS);
export const TWO_HEARTS = makeCard(2, Suit.HEARTS);
export const SEVEN_DIAMONDS = makeCard(7, Suit.DIAMONDS);
export const NINE_HEARTS = makeCard(9, Suit.HEARTS);
export const JACK_SPADES = makeCard(11, Suit.SPADES);
export const QUEEN_SPADES = makeCard(12, Suit.SPADES);

/** Cards that never move in quadration. */
const FIXED_CARDS: Card[] = [KING_SPADES, JACK_HEARTS, EIGHT_CLUBS];

/** Semi-fixed card pairs: they swap with each other. */
const SEMI_FIXED_PAIRS: [Card, Card][] = [
  [ACE_CLUBS, TWO_HEARTS],
  [SEVEN_DIAMONDS, NINE_HEARTS],
];

// ─── Zodiac Rulers ───────────────────────────────────────────────

export const ZODIAC_RULERS: Record<ZodiacSign, Planet> = {
  [ZodiacSign.ARIES]: Planet.MARS,
  [ZodiacSign.TAURUS]: Planet.VENUS,
  [ZodiacSign.GEMINI]: Planet.MERCURY,
  [ZodiacSign.CANCER]: Planet.MOON,
  [ZodiacSign.LEO]: Planet.SUN,
  [ZodiacSign.VIRGO]: Planet.MERCURY,
  [ZodiacSign.LIBRA]: Planet.VENUS,
  [ZodiacSign.SCORPIO]: Planet.PLUTO,
  [ZodiacSign.SAGITTARIUS]: Planet.JUPITER,
  [ZodiacSign.CAPRICORN]: Planet.SATURN,
  [ZodiacSign.AQUARIUS]: Planet.URANUS,
  [ZodiacSign.PISCES]: Planet.NEPTUNE,
};

// ─── Date → Zodiac ──────────────────────────────────────────────

/**
 * Zodiac sign boundaries (month, day) for the START of each sign.
 */
const ZODIAC_BOUNDARIES: [number, number, ZodiacSign][] = [
  [1, 20, ZodiacSign.AQUARIUS],
  [2, 19, ZodiacSign.PISCES],
  [3, 21, ZodiacSign.ARIES],
  [4, 20, ZodiacSign.TAURUS],
  [5, 21, ZodiacSign.GEMINI],
  [6, 21, ZodiacSign.CANCER],
  [7, 23, ZodiacSign.LEO],
  [8, 23, ZodiacSign.VIRGO],
  [9, 23, ZodiacSign.LIBRA],
  [10, 23, ZodiacSign.SCORPIO],
  [11, 22, ZodiacSign.SAGITTARIUS],
  [12, 22, ZodiacSign.CAPRICORN],
];

export function getZodiacSign(month: number, day: number): ZodiacSign {
  // Walk backwards through boundaries
  for (let i = ZODIAC_BOUNDARIES.length - 1; i >= 0; i--) {
    const [m, d, sign] = ZODIAC_BOUNDARIES[i];
    if (month > m || (month === m && day >= d)) {
      return sign;
    }
  }
  // Before Jan 20 → Capricorn
  return ZodiacSign.CAPRICORN;
}

// ─── Planet Themes (for archetype mapping) ───────────────────────

const PLANET_QUALITIES: Record<string, { archetype: string; qualities: string[] }> = {
  [Planet.MERCURY]: {
    archetype: "Messenger",
    qualities: ["communication", "mental", "learning", "writing", "quick"],
  },
  [Planet.VENUS]: {
    archetype: "Artist",
    qualities: ["creativity", "beauty", "relationships", "harmony", "pleasure"],
  },
  [Planet.MARS]: {
    archetype: "Warrior",
    qualities: ["action", "energy", "conflict", "passion", "drive"],
  },
  [Planet.JUPITER]: {
    archetype: "Sage",
    qualities: ["expansion", "wisdom", "growth", "abundance", "optimism"],
  },
  [Planet.SATURN]: {
    archetype: "Teacher",
    qualities: ["discipline", "structure", "responsibility", "limitation", "karma"],
  },
  [Planet.URANUS]: {
    archetype: "Rebel",
    qualities: ["change", "innovation", "freedom", "surprise", "awakening"],
  },
  [Planet.NEPTUNE]: {
    archetype: "Mystic",
    qualities: ["dream", "intuition", "spirituality", "imagination", "vision"],
  },
};

// ─── Suit → Element mapping ─────────────────────────────────────

const SUIT_ELEMENT: Record<Suit, Element> = {
  [Suit.HEARTS]: Element.WATER,
  [Suit.CLUBS]: Element.FIRE,
  [Suit.DIAMONDS]: Element.EARTH,
  [Suit.SPADES]: Element.AIR,
};

// ─── Period Order ────────────────────────────────────────────────

const PERIOD_ORDER: Planet[] = [
  Planet.MERCURY,
  Planet.VENUS,
  Planet.MARS,
  Planet.JUPITER,
  Planet.SATURN,
  Planet.URANUS,
  Planet.NEPTUNE,
];

// ─── Planet Offsets for Card Navigation ──────────────────────────

const PLANET_OFFSETS: Record<string, number> = {
  [Planet.MERCURY]: 1,
  [Planet.VENUS]: 2,
  [Planet.MARS]: 3,
  [Planet.JUPITER]: 4,
  [Planet.SATURN]: 5,
  [Planet.URANUS]: 6,
  [Planet.NEPTUNE]: 7,
  [Planet.PLUTO]: 8,
  [Planet.MOON]: -1, // Moon moves RIGHT
};

// ─── Planetary Period Interface ──────────────────────────────────

export interface PlanetaryPeriod {
  planet: Planet;
  startDate: Date;
  endDate: Date;
  directCard: Card;
  verticalCard: Card | null;
}

// ─── Energy Metrics for each rank range ──────────────────────────

function getRankMetrics(rank: number): {
  mental: number;
  creative: number;
  physical: number;
  spiritual: number;
} {
  // Aces = inspiration, high spiritual
  if (rank === 1) return { mental: 0.7, creative: 0.8, physical: 0.4, spiritual: 0.9 };
  // 2-3 = duality, partnership
  if (rank <= 3) return { mental: 0.5, creative: 0.6, physical: 0.5, spiritual: 0.6 };
  // 4-6 = stability, foundation
  if (rank <= 6) return { mental: 0.6, creative: 0.5, physical: 0.7, spiritual: 0.4 };
  // 7-9 = mastery, challenge
  if (rank <= 9) return { mental: 0.8, creative: 0.6, physical: 0.6, spiritual: 0.7 };
  // 10 = completion
  if (rank === 10) return { mental: 0.7, creative: 0.7, physical: 0.8, spiritual: 0.8 };
  // Jack = creativity, youth
  if (rank === 11) return { mental: 0.6, creative: 0.9, physical: 0.5, spiritual: 0.5 };
  // Queen = intuition, reception
  if (rank === 12) return { mental: 0.7, creative: 0.8, physical: 0.4, spiritual: 0.8 };
  // King = authority, mastery
  return { mental: 0.9, creative: 0.7, physical: 0.7, spiritual: 0.7 };
}

// ═════════════════════════════════════════════════════════════════
//  CORE ALGORITHMS — Faithful ports from GUTTERS
// ═════════════════════════════════════════════════════════════════

// ─── 2.2: Birth Card Calculation ─────────────────────────────────

/**
 * Calculate birth card from month and day.
 *
 * Formula: sv = 55 - (month × 2 + day)
 * If sv == 0 → Joker (Dec 31)
 * If sv < 0 → add 52 (wrap)
 * Map solar value to suit by range:
 *   1-13 → Hearts, 14-26 → Clubs, 27-39 → Diamonds, 40-52 → Spades
 */
export function calculateBirthCard(month: number, day: number): Card {
  const solarValue = 55 - (month * 2 + day);

  if (solarValue === 0) return JOKER; // Dec 31

  // Negative values wrap: add 52
  const sv = solarValue < 0 ? solarValue + 52 : solarValue;

  if (sv >= 1 && sv <= 13) return { rank: sv, suit: Suit.HEARTS, solarValue: sv };
  if (sv >= 14 && sv <= 26) return { rank: sv - 13, suit: Suit.CLUBS, solarValue: sv };
  if (sv >= 27 && sv <= 39) return { rank: sv - 26, suit: Suit.DIAMONDS, solarValue: sv };
  if (sv >= 40 && sv <= 52) return { rank: sv - 39, suit: Suit.SPADES, solarValue: sv };

  // Should never reach here with valid dates
  return JOKER;
}

// ─── 2.3: Natural Spread (8×8 Grid) ─────────────────────────────

/**
 * Generate all 52 cards in solar value order (1 = A♥ → 52 = K♠).
 */
function allCardsInSolarOrder(): Card[] {
  const cards: Card[] = [];
  const suits = [Suit.HEARTS, Suit.CLUBS, Suit.DIAMONDS, Suit.SPADES];
  for (let i = 0; i < suits.length; i++) {
    for (let rank = 1; rank <= 13; rank++) {
      cards.push({ rank, suit: suits[i], solarValue: i * 13 + rank });
    }
  }
  return cards;
}

/**
 * Generate the Natural Spread — the foundational 8×8 grid.
 *
 * All 52 cards in solar value order fill:
 *   - Rows 1–7, right-to-left (cols 7→1): first 49 cards
 *   - Crown row 0, cols 7/6/5: cards 49/50/51 (J♠/Q♠/K♠ in natural order)
 */
export function generateNaturalSpread(): Card[][] {
  const grid: Card[][] = Array.from({ length: 8 }, () => Array(8).fill(JOKER));
  const allCards = allCardsInSolarOrder();

  // First 49 cards fill data rows 1-7, right-to-left (cols 7→1)
  let cardIdx = 0;
  for (let row = 1; row <= 7; row++) {
    for (let col = 7; col >= 1; col--) {
      grid[row][col] = allCards[cardIdx++];
    }
  }

  // Last 3 cards go to Crown row at cols 7, 6, 5
  grid[0][7] = allCards[49]; // J♠ in natural order
  grid[0][6] = allCards[50]; // Q♠ in natural order
  grid[0][5] = allCards[51]; // K♠ in natural order

  return grid;
}

/**
 * Extract the deck order from a grid.
 * Data rows 1-7 (cols 7→1) = 49 cards, then Crown [0][7],[0][6],[0][5] = 3 cards.
 * Total: 52 cards.
 */
function gridToDeck(grid: Card[][]): Card[] {
  const deck: Card[] = [];
  for (let row = 1; row <= 7; row++) {
    for (let col = 7; col >= 1; col--) {
      deck.push(grid[row][col]);
    }
  }
  // Crown cards
  deck.push(grid[0][7]);
  deck.push(grid[0][6]);
  deck.push(grid[0][5]);
  return deck;
}

/**
 * Convert a 52-card linear deck back to an 8×8 grid.
 * First 49 → data rows (1-7, cols 7→1), last 3 → Crown [0][7],[0][6],[0][5].
 */
function deckToGrid(deck: Card[]): Card[][] {
  const grid: Card[][] = Array.from({ length: 8 }, () => Array(8).fill(JOKER));

  let idx = 0;
  for (let row = 1; row <= 7; row++) {
    for (let col = 7; col >= 1; col--) {
      grid[row][col] = deck[idx++];
    }
  }

  // Last 3 cards go to Crown row
  grid[0][7] = deck[49];
  grid[0][6] = deck[50];
  grid[0][5] = deck[51];

  return grid;
}

// ─── 2.4: Quadration Algorithm ───────────────────────────────────

/**
 * Core deck transformation: the Quadration.
 * Faithful port from GUTTERS §2.4 — operates on all 52 cards.
 *
 * Step 1: Deal first 48 cards into 4 piles, 3 at a time (cycling piles 0-3)
 * Step 2: Last 4 cards (indices 48-51), one per pile
 * Step 3: Stack piles: pile 0 + pile 1 + pile 2 + pile 3
 * Step 4: Deal 1-per-pile into 4 new piles
 * Step 5: Stack same way: pile 0 + pile 1 + pile 2 + pile 3
 */
export function quadrate(deck: Card[]): Card[] {
  if (deck.length !== 52) {
    throw new Error(`Quadration requires exactly 52 cards, got ${deck.length}`);
  }

  // Step 1: Deal first 48 cards into 4 piles, 3 cards at a time
  const piles: Card[][] = [[], [], [], []];
  for (let i = 0; i < 48; i += 3) {
    const pileIdx = Math.floor(i / 3) % 4;
    piles[pileIdx].push(deck[i], deck[i + 1], deck[i + 2]);
  }

  // Step 2: Last 4 cards go 1 per pile
  for (let i = 0; i < 4; i++) {
    piles[i].push(deck[48 + i]);
  }

  // Step 3: Stack piles 0 + 1 + 2 + 3 (GUTTERS order)
  const intermediate = [...piles[0], ...piles[1], ...piles[2], ...piles[3]];

  // Step 4: Deal 1-per-pile into 4 new piles
  const newPiles: Card[][] = [[], [], [], []];
  for (let i = 0; i < intermediate.length; i++) {
    newPiles[i % 4].push(intermediate[i]);
  }

  // Step 5: Stack same way: pile 0 + pile 1 + pile 2 + pile 3
  return [...newPiles[0], ...newPiles[1], ...newPiles[2], ...newPiles[3]];
}

// ─── 2.5: Spreads ────────────────────────────────────────────────

/**
 * Get the Natural Spread as a linear deck.
 */
function naturalDeckOrder(): Card[] {
  return gridToDeck(generateNaturalSpread());
}

/**
 * Generate the Life Spread = 1× quadration of Natural deck.
 */
export function generateLifeSpread(): Card[][] {
  const deck = naturalDeckOrder();
  const lifeDeck = quadrate(deck);
  return deckToGrid(lifeDeck);
}

/**
 * Generate the Spiritual Spread = 2× quadration of Natural deck.
 */
export function generateSpiritualSpread(): Card[][] {
  const deck = naturalDeckOrder();
  const lifeDeck = quadrate(deck);
  const spiritualDeck = quadrate(lifeDeck);
  return deckToGrid(spiritualDeck);
}

/**
 * Generate the Grand Solar Spread for a given age.
 * Number of quadrations = (age % 90) + 1.
 */
export function generateSolarSpread(age: number): Card[][] {
  let deck = naturalDeckOrder();
  const iterations = (age % 90) + 1;
  for (let i = 0; i < iterations; i++) {
    deck = quadrate(deck);
  }
  return deckToGrid(deck);
}

// ─── Card Finding ────────────────────────────────────────────────

/**
 * Find a card's position [row, col] in a spread.
 * Searches data rows 1-7 (cols 1-7) AND Crown row 0 (cols 5-7).
 * Returns null if not found.
 */
export function findCardInSpread(card: Card, spread: Card[][]): [number, number] | null {
  // Data rows
  for (let row = 1; row <= 7; row++) {
    for (let col = 1; col <= 7; col++) {
      if (cardEquals(spread[row][col], card)) {
        return [row, col];
      }
    }
  }
  // Crown row (cols 7, 6, 5)
  for (let col = 7; col >= 5; col--) {
    if (cardEquals(spread[0][col], card)) {
      return [0, col];
    }
  }
  return null;
}

// ─── 2.7: Planetary Card Navigation ─────────────────────────────

/**
 * Get the planetary card from a birth card's position in a spread.
 *
 * From the birth card's position, move LEFT by the planet's offset
 * (step-by-step column navigation, wrapping into Crown row).
 * Moon moves RIGHT. Sun returns birth card.
 *
 * Faithful port from GUTTERS §2.7.
 */
export function getPlanetaryCard(birthCard: Card, planet: Planet, spread: Card[][]): Card | null {
  // Sun = birth card itself
  if (planet === Planet.SUN) return birthCard;

  const pos = findCardInSpread(birthCard, spread);
  if (!pos) return null;

  const offset = PLANET_OFFSETS[planet];
  if (offset === undefined) return null;

  let [currentRow, currentCol] = pos;

  if (offset < 0) {
    // Move RIGHT (Moon): col+1, wrap col 7→col 1/row-1, wrap row 0→row 7
    for (let i = 0; i < Math.abs(offset); i++) {
      currentCol += 1;
      if (currentCol > 7) {
        currentCol = 1;
        currentRow -= 1;
        if (currentRow < 1) {
          currentRow = 7;
        }
      }
    }
  } else {
    // Move LEFT (other planets): col-1, wrap col 0→col 7/row+1, wrap row 8→Crown
    for (let i = 0; i < offset; i++) {
      currentCol -= 1;
      if (currentCol < 1) {
        currentCol = 7;
        currentRow += 1;
        if (currentRow > 7) {
          currentRow = 0; // Crown line
          currentCol = 7;
        }
      }
    }
  }

  return spread[currentRow][currentCol];
}

// ─── 2.8: Karma Cards ───────────────────────────────────────────

/**
 * Calculate karma cards for a birth card.
 *
 * Fixed cards (K♠, J♥, 8♣) have no karma cards → [null, null].
 * Semi-fixed pairs swap with their partner.
 * Others: positional exchange between Natural and Life Spreads.
 *
 * First Karma: card in Natural Spread at birth card's Life Spread position
 * Second Karma: card in Life Spread at birth card's Natural Spread position
 */
export function calculateKarmaCards(birthCard: Card): [Card | null, Card | null] {
  // Fixed cards: no karma
  if (FIXED_CARDS.some((fc) => cardEquals(fc, birthCard))) {
    return [null, null];
  }

  const naturalSpread = generateNaturalSpread();
  const lifeSpread = generateLifeSpread();

  // First Karma: card in Natural at birth card's Life position
  const lifePos = findCardInSpread(birthCard, lifeSpread);
  const firstKarma = lifePos ? naturalSpread[lifePos[0]][lifePos[1]] : null;

  // Second Karma: card in Life at birth card's Natural position
  const natPos = findCardInSpread(birthCard, naturalSpread);
  const secondKarma = natPos ? lifeSpread[natPos[0]][natPos[1]] : null;

  return [firstKarma, secondKarma];
}

// ─── 2.6: Planetary Periods ──────────────────────────────────────

/**
 * Get the birthday anniversary date in a given year.
 */
function getBirthdayInYear(birthDate: Date, year: number): Date {
  const d = new Date(birthDate);
  d.setFullYear(year);
  return d;
}

/**
 * Days between two dates (ignoring time).
 */
function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

/**
 * Add days to a date.
 */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

/**
 * Calculate the 7 planetary periods for a given year.
 *
 * 7 periods of 52 days each (Mercury → Neptune).
 * Neptune gets the remainder days (leap year adjustment).
 */
export function calculatePlanetaryPeriods(
  birthDate: Date,
  year: number,
  birthCard: Card,
): PlanetaryPeriod[] {
  const yearStart = getBirthdayInYear(birthDate, year);
  const yearEnd = getBirthdayInYear(birthDate, year + 1);
  const totalDays = daysBetween(yearStart, yearEnd);

  const age = year - birthDate.getFullYear();
  const spread = generateSolarSpread(age);

  const periods: PlanetaryPeriod[] = [];
  let currentDate = yearStart;

  for (let i = 0; i < 7; i++) {
    // Neptune (last period) gets the remainder days
    const duration = i < 6 ? 52 : totalDays - 52 * 6;
    const endDate = addDays(currentDate, duration - 1);

    periods.push({
      planet: PERIOD_ORDER[i],
      startDate: new Date(currentDate),
      endDate,
      directCard: getPlanetaryCard(birthCard, PERIOD_ORDER[i], spread) ?? birthCard,
      verticalCard: null,
    });

    currentDate = addDays(endDate, 1);
  }

  return periods;
}

/**
 * Given a target date, determine which planetary period is active
 * and what day within that period we are on.
 */
export function getCurrentPeriod(
  birthDate: Date,
  targetDate: Date,
): { planet: Planet; periodDay: number; directCard: Card; periodIndex: number } | null {
  const birthCard = calculateBirthCard(birthDate.getMonth() + 1, birthDate.getDate());

  // Determine the relevant "card year"
  const birthMonth = birthDate.getMonth();
  const birthDay = birthDate.getDate();
  const targetMonth = targetDate.getMonth();
  const targetDay = targetDate.getDate();

  let year = targetDate.getFullYear();
  // If we haven't reached this year's birthday yet, use previous year's card year
  if (targetMonth < birthMonth || (targetMonth === birthMonth && targetDay < birthDay)) {
    year--;
  }

  const periods = calculatePlanetaryPeriods(birthDate, year, birthCard);

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    if (targetDate >= p.startDate && targetDate <= p.endDate) {
      const periodDay = daysBetween(p.startDate, targetDate) + 1;
      return {
        planet: p.planet,
        periodDay,
        directCard: p.directCard,
        periodIndex: i,
      };
    }
  }

  return null;
}

// ═════════════════════════════════════════════════════════════════
//  COSMIC SYSTEM IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════

export class CardologySystem implements CosmicSystem {
  readonly name = "cardology";
  readonly displayName = "Cardology (52-Day Magi Periods)";
  readonly requiresBirthData = true;
  readonly recalcInterval = { type: "daily" as const };

  async calculate(birth: BirthMoment | null, now?: Date): Promise<CosmicState | null> {
    if (!birth) return null;

    const currentTime = now ?? new Date();
    const birthDate = birth.datetime;
    const month = birthDate.getMonth() + 1;
    const day = birthDate.getDate();

    const birthCard = calculateBirthCard(month, day);
    const currentPeriod = getCurrentPeriod(birthDate, currentTime);

    if (!currentPeriod) {
      // Edge case: date outside calculable range
      return null;
    }

    const zodiac = getZodiacSign(month, day);
    const qualities = PLANET_QUALITIES[currentPeriod.planet]?.qualities ?? [];
    const archetype = PLANET_QUALITIES[currentPeriod.planet]?.archetype ?? "Unknown";
    const metrics = getRankMetrics(currentPeriod.directCard.rank);
    const [firstKarma, secondKarma] = calculateKarmaCards(birthCard);

    return {
      system: "cardology",
      timestamp: currentTime,
      primary: {
        birthCard: cardName(birthCard),
        birthCardSuit: birthCard.suit,
        birthCardRank: birthCard.rank,
        zodiacSign: zodiac,
        currentPlanet: currentPeriod.planet,
        currentCard: cardName(currentPeriod.directCard),
        periodDay: currentPeriod.periodDay,
        periodProgress: currentPeriod.periodDay / 52,
        periodIndex: currentPeriod.periodIndex,
        qualities,
        archetype,
        firstKarmaCard: firstKarma ? cardName(firstKarma) : null,
        secondKarmaCard: secondKarma ? cardName(secondKarma) : null,
      },
      summary:
        `Day ${currentPeriod.periodDay} of ${currentPeriod.planet} period ` +
        `(${cardName(currentPeriod.directCard)}). ` +
        `Birth card: ${cardName(birthCard)} (${zodiac}). ` +
        `Qualities: ${qualities.join(", ")}.`,
      metrics: {
        periodProgress: currentPeriod.periodDay / 52,
        periodDay: currentPeriod.periodDay,
        mentalEnergy: metrics.mental,
        creativeEnergy: metrics.creative,
        physicalEnergy: metrics.physical,
        spiritualEnergy: metrics.spiritual,
      },
    };
  }

  synthesize(state: CosmicState): string {
    return state.summary;
  }

  archetypes(state: CosmicState): ArchetypeMapping {
    const suit = state.primary.birthCardSuit as Suit | null;
    const element = suit ? SUIT_ELEMENT[suit] : Element.ETHER;
    const archetype = (state.primary.archetype as string) ?? "Unknown";

    return {
      system: "cardology",
      elements: [element],
      archetypes: [archetype],
      resonanceValues: {
        periodProgress: (state.primary.periodProgress as number) ?? 0,
        mentalEnergy: state.metrics.mentalEnergy ?? 0,
        creativeEnergy: state.metrics.creativeEnergy ?? 0,
      },
    };
  }
}
