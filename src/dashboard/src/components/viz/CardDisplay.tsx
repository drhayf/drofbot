/**
 * Card Display — Playing card renderer for Cardology
 *
 * Clean, typographic treatment. Suit symbol, card name, period info.
 * Karma card connections shown as subtle linked references.
 */

interface CardData {
  rank: number;
  rankName: string;
  suit: string;
  name?: string;
}

interface KarmaCards {
  debt?: { card: string; name: string };
  gift?: { card: string; name: string };
}

interface CardDisplayProps {
  /** The primary card (birth card or period card) */
  card: CardData | null;
  /** Karma card connections */
  karmaCards?: KarmaCards | null;
  /** Current planetary ruler e.g. "Jupiter" */
  currentPlanet?: string;
  /** Card type label e.g. "Birth Card" or "Period Card" */
  cardLabel?: string;
  className?: string;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: "var(--negative, #8a4a3d)",
  diamonds: "var(--negative, #8a4a3d)",
  clubs: "var(--ink-1, #1a1816)",
  spades: "var(--ink-1, #1a1816)",
};

function rankDisplay(rank: number): string {
  const map: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  return map[rank] ?? String(rank);
}

function normalizeSuit(suit: string): string {
  return suit.toLowerCase();
}

export function CardDisplay({
  card,
  karmaCards,
  currentPlanet,
  cardLabel,
  className = "",
}: CardDisplayProps) {
  if (!card) {
    return (
      <div
        className={`flex items-center justify-center rounded-card border border-border bg-surface-raised p-4 ${className}`}
        data-testid="card-display"
      >
        <span className="text-xs text-ink-4">No card data</span>
      </div>
    );
  }

  const suit = normalizeSuit(card.suit);
  const symbol = SUIT_SYMBOLS[suit] ?? "?";
  const color = SUIT_COLORS[suit] ?? "var(--ink-1)";
  const rank = rankDisplay(card.rank);
  const cardName = card.name ?? `${card.rankName} of ${card.suit}`;

  return (
    <div
      className={`rounded-card border border-border bg-surface-raised overflow-hidden ${className}`}
      data-testid="card-display"
    >
      {/* Card header */}
      {cardLabel && (
        <div className="px-3 py-1.5 border-b border-border-subtle">
          <span className="text-[10px] text-ink-4 uppercase tracking-wider font-medium">
            {cardLabel}
          </span>
        </div>
      )}

      {/* Card body */}
      <div className="p-4 flex items-center gap-4">
        {/* Rank + suit symbol */}
        <div className="flex flex-col items-center min-w-[3rem]" data-testid="card-symbol">
          <span className="text-3xl font-display font-bold leading-none" style={{ color }}>
            {rank}
          </span>
          <span className="text-2xl leading-none mt-0.5" style={{ color }}>
            {symbol}
          </span>
        </div>

        {/* Card info */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-ink-1 truncate" data-testid="card-name">
            {cardName}
          </span>
          {currentPlanet && (
            <span className="text-xs text-ink-3" data-testid="card-planet">
              {currentPlanet} period
            </span>
          )}
        </div>
      </div>

      {/* Karma connections */}
      {karmaCards && (karmaCards.debt || karmaCards.gift) && (
        <div
          className="px-4 pb-3 flex gap-4 border-t border-border-subtle pt-2"
          data-testid="karma-cards"
        >
          {karmaCards.debt && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-ink-4 uppercase tracking-wider">Debt</span>
              <span className="text-xs text-ink-2 font-medium">
                {karmaCards.debt.name || karmaCards.debt.card}
              </span>
            </div>
          )}
          {karmaCards.gift && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-ink-4 uppercase tracking-wider">Gift</span>
              <span className="text-xs text-ink-2 font-medium">
                {karmaCards.gift.name || karmaCards.gift.card}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CardDisplay;
