import { isFlower, isJoker, isSuitedValue } from './tiles.js';

export const CLAIM_CHANCE = { easy: 0.3, normal: 0.6, hard: 1 };

// Quanto maior o número, mais a peça ajuda a mão.
export function usefulness(tile, hand, melds = []) {
  if (isJoker(tile) || isFlower(tile)) return Infinity;

  const copies = hand.filter(t => t.value === tile.value).length;
  let score = [0, 0, 6, 10, 12][Math.min(copies, 4)];

  if (isSuitedValue(tile.value)) {
    const has = delta => hand.some(t => t.suit === tile.suit && t.value === tile.value + delta);
    if (has(1)) score += 3;
    if (has(-1)) score += 3;
    if (has(2)) score += 1.5;
    if (has(-2)) score += 1.5;
    if (tile.rank >= 3 && tile.rank <= 7) score += 0.4;
  }

  if (melds.some(m => m.tiles.some(t => t.value === tile.value))) score += 5;
  return score;
}

function discardable(player) {
  const plain = player.hand.filter(t => !isJoker(t) && !isFlower(t));
  return plain.length ? plain : player.hand;
}

export function suggestDiscard(player) {
  const pool = player.hand.filter(t => !isJoker(t) && !isFlower(t));
  let best = null;
  let bestScore = Infinity;
  for (const tile of pool) {
    const score = usefulness(tile, player.hand, player.melds);
    if (score < bestScore) { best = tile; bestScore = score; }
  }
  return best;
}

export function chooseDiscard(player, level) {
  const pool = discardable(player);
  const random = list => list[Math.floor(Math.random() * list.length)];

  if (level === 'easy') return random(pool);

  if (level === 'normal') {
    const singles = pool.filter(t => player.hand.filter(x => x.value === t.value).length === 1);
    return random(singles.length ? singles : pool);
  }

  let best = pool[0];
  let bestScore = Infinity;
  for (const tile of pool) {
    const score = usefulness(tile, player.hand, player.melds) + Math.random() * 0.8;
    if (score < bestScore) { best = tile; bestScore = score; }
  }
  return best;
}
