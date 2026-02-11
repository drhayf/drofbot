import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CardDisplay } from "../../components/viz/CardDisplay";

describe("CardDisplay", () => {
  const mockCard = {
    rank: 7,
    rankName: "Seven",
    suit: "Hearts",
    name: "Seven of Hearts",
  };

  it("renders card with name and symbol", () => {
    render(<CardDisplay card={mockCard} />);
    expect(screen.getByTestId("card-display")).toBeInTheDocument();
    expect(screen.getByTestId("card-name")).toHaveTextContent("Seven of Hearts");
    expect(screen.getByTestId("card-symbol")).toBeInTheDocument();
  });

  it("renders empty state when card is null", () => {
    render(<CardDisplay card={null} />);
    expect(screen.getByText("No card data")).toBeInTheDocument();
  });

  it("shows card label header", () => {
    render(<CardDisplay card={mockCard} cardLabel="Birth Card" />);
    expect(screen.getByText("Birth Card")).toBeInTheDocument();
  });

  it("shows planet period", () => {
    render(<CardDisplay card={mockCard} currentPlanet="Jupiter" />);
    expect(screen.getByTestId("card-planet")).toHaveTextContent("Jupiter period");
  });

  it("renders karma cards when provided", () => {
    const karma = {
      debt: { card: "9H", name: "Nine of Hearts" },
      gift: { card: "5C", name: "Five of Clubs" },
    };
    render(<CardDisplay card={mockCard} karmaCards={karma} />);
    expect(screen.getByTestId("karma-cards")).toBeInTheDocument();
    expect(screen.getByText("Nine of Hearts")).toBeInTheDocument();
    expect(screen.getByText("Five of Clubs")).toBeInTheDocument();
  });

  it("hides karma section when no karma cards", () => {
    render(<CardDisplay card={mockCard} />);
    expect(screen.queryByTestId("karma-cards")).toBeNull();
  });

  it("displays rank as A for rank 1", () => {
    const ace = { rank: 1, rankName: "Ace", suit: "Spades" };
    render(<CardDisplay card={ace} />);
    expect(screen.getByTestId("card-symbol")).toHaveTextContent("A");
  });

  it("displays rank as K for rank 13", () => {
    const king = { rank: 13, rankName: "King", suit: "Diamonds" };
    render(<CardDisplay card={king} />);
    expect(screen.getByTestId("card-symbol")).toHaveTextContent("K");
  });
});
