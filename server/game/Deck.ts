import { v4 as uuid } from 'uuid';
import type { CardId, CardInstance } from '../../shared/types.js';
import { DECK_COMPOSITION, AMBULANCE_COUNT } from './constants.js';

export class Deck {
  private drawPile: CardInstance[] = [];
  private discardPile: CardInstance[] = [];
  private removedCards: CardInstance[] = []; // permanently removed (ambulance)

  constructor(playerCount: number) {
    const cards: CardInstance[] = [];

    // Add regular cards
    for (const [cardId, count] of Object.entries(DECK_COMPOSITION)) {
      for (let i = 0; i < count; i++) {
        cards.push({ instanceId: uuid(), cardId: cardId as CardId });
      }
    }

    // Add ambulances based on player count
    const ambulanceCount = AMBULANCE_COUNT[playerCount] ?? 3;
    for (let i = 0; i < ambulanceCount; i++) {
      cards.push({ instanceId: uuid(), cardId: 'ambulance' });
    }

    this.drawPile = cards;
    this.shuffle();
  }

  shuffle(): void {
    for (let i = this.drawPile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.drawPile[i], this.drawPile[j]] = [this.drawPile[j], this.drawPile[i]];
    }
  }

  draw(count: number): CardInstance[] {
    const drawn: CardInstance[] = [];

    for (let i = 0; i < count; i++) {
      // If draw pile is empty, recycle discard pile
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break; // no cards left at all
        this.drawPile = [...this.discardPile];
        this.discardPile = [];
        this.shuffle();
      }
      const card = this.drawPile.pop();
      if (card) drawn.push(card);
    }

    return drawn;
  }

  discard(cards: CardInstance[]): void {
    this.discardPile.push(...cards);
  }

  removeFromGame(card: CardInstance): void {
    this.removedCards.push(card);
  }

  getDrawPileSize(): number {
    return this.drawPile.length;
  }

  getDiscardPileSize(): number {
    return this.discardPile.length;
  }

  getState(): { drawPile: CardInstance[]; discardPile: CardInstance[] } {
    return {
      drawPile: [...this.drawPile],
      discardPile: [...this.discardPile],
    };
  }
}
