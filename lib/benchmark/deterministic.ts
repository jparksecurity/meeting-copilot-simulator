import { CardResult } from '../types';
import { DeterministicResult } from './types';

const VALID_CARD_TYPES = new Set([
  'ask', 'frame', 'summarize', 'challenge',
  'search', 'decide', 'relate', 'capture',
]);

export function validateCard(card: CardResult, index: number): DeterministicResult {
  const words = card.text.trim().split(/\s+/);
  const word_count = words.length;
  const char_count = card.text.length;
  const has_bullets = /^[\-\*\u2022]\s/m.test(card.text);
  const has_semicolons = card.text.includes(';');
  const validType = VALID_CARD_TYPES.has(card.type);

  const passes =
    word_count <= 18 &&
    char_count <= 120 &&
    !has_bullets &&
    !has_semicolons &&
    validType;

  return { card_index: index, word_count, char_count, has_bullets, has_semicolons, passes };
}

export function validateCards(cards: CardResult[]): {
  results: DeterministicResult[];
  allPass: boolean;
  cardCountValid: boolean;
} {
  const results = cards.map((c, i) => validateCard(c, i));
  const cardCountValid = cards.length <= 3;
  const allPass = results.every((r) => r.passes) && cardCountValid;
  return { results, allPass, cardCountValid };
}
