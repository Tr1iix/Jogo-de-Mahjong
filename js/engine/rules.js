import { isFlower, isJoker, isSuitedValue } from './tiles.js';

export const flowersIn = hand => hand.filter(isFlower);

function withoutN(values, value, n) {
  const out = [];
  let left = n;
  for (const v of values) {
    if (v === value && left > 0) { left--; continue; }
    out.push(v);
  }
  return out;
}

function isSevenPairs(naturals, jokers) {
  if (naturals.length + jokers !== 14) return false;

  const counts = new Map();
  for (const t of naturals) counts.set(t.value, (counts.get(t.value) ?? 0) + 1);

  let pairs = 0;
  let singles = 0;
  for (const n of counts.values()) {
    pairs += Math.floor(n / 2);
    if (n % 2) singles++;
  }
  if (singles > jokers) return false;

  const spare = jokers - singles;
  return spare % 2 === 0 && pairs + singles + spare / 2 === 7;
}

// values vem ordenado. Tenta dividir tudo em grupos de 3 a 5 peças iguais
// ou sequências de 3, completando buracos com coringas.
function splitIntoMelds(values, jokers) {
  if (values.length === 0) return jokers === 0;

  const first = values[0];
  const copies = values.filter(v => v === first).length;

  for (let size = 3; size <= 5; size++) {
    for (let used = Math.min(copies, size); used >= 1; used--) {
      const missing = size - used;
      if (missing > jokers) break;
      if (splitIntoMelds(withoutN(values, first, used), jokers - missing)) return true;
    }
  }

  if (!isSuitedValue(first)) return false;

  const rank = first % 10;
  for (const shift of [0, -1, -2]) {
    const startRank = rank + shift;
    if (startRank < 1 || startRank > 7) continue;

    const rest = values.slice(1);
    let missing = 0;
    for (let k = 0; k < 3; k++) {
      const wanted = first + shift + k;
      if (wanted === first) continue;
      const at = rest.indexOf(wanted);
      if (at >= 0) rest.splice(at, 1);
      else missing++;
    }
    if (missing <= jokers && splitIntoMelds(rest, jokers - missing)) return true;
  }
  return false;
}

export function checkWin(hand, melds) {
  const exposed = melds.filter(m => m.type !== 'flowers');
  const exposedCount = exposed.reduce((sum, m) => sum + m.tiles.length, 0);
  const useful = hand.filter(t => !isFlower(t));
  if (useful.length + exposedCount !== 14) return false;

  const jokers = useful.filter(isJoker).length;
  const naturals = useful.filter(t => !isJoker(t));

  if (exposed.length === 0 && isSevenPairs(naturals, jokers)) return true;

  const counts = new Map();
  for (const t of naturals) counts.set(t.value, (counts.get(t.value) ?? 0) + 1);

  for (const [pairValue, n] of counts) {
    if (n < 2) continue;
    const rest = [];
    for (const [value, count] of counts) {
      const left = value === pairValue ? count - 2 : count;
      for (let i = 0; i < left; i++) rest.push(value);
    }
    rest.sort((a, b) => a - b);
    if (splitIntoMelds(rest, jokers)) return true;
  }
  return false;
}

export const canDeclare = player => checkWin(player.hand, player.melds);

export function wouldWinWith(player, tile) {
  if (!tile || isJoker(tile) || isFlower(tile)) return false;
  return checkWin([...player.hand, tile], player.melds);
}

export function findClaimOptions(hand, discarded, { allowJoker = true } = {}) {
  if (!discarded || isJoker(discarded) || isFlower(discarded)) return {};

  const matching = hand.filter(t => t.value === discarded.value);
  const jokers = allowJoker ? hand.filter(isJoker) : [];

  const build = need => {
    const naturals = matching.slice(0, need);
    const fillers = jokers.slice(0, need - naturals.length);
    const total = naturals.length + fillers.length;
    return total === need && naturals.length >= 1 ? [...naturals, ...fillers] : null;
  };

  const options = {};
  const pon = build(2);
  const kong = build(3);
  const quint = build(4);
  if (pon) options.pon = pon;
  if (kong) options.kong = kong;
  if (quint) options.quint = quint;
  return options;
}

export function findPromotion(player) {
  for (let i = 0; i < player.melds.length; i++) {
    const meld = player.melds[i];
    if (meld.type !== 'pon' && meld.type !== 'kong') continue;

    const base = meld.tiles.find(t => !isJoker(t));
    if (!base) continue;

    const targetSize = meld.type === 'pon' ? 4 : 5;
    const needed = targetSize - meld.tiles.length;
    if (needed <= 0) continue;

    const natural = player.hand.filter(t => t.value === base.value);
    const wild = player.hand.filter(isJoker);
    const picked = [...natural, ...wild].slice(0, needed);

    if (picked.length === needed) {
      return { meldIndex: i, newType: targetSize === 4 ? 'kong' : 'quint', tiles: picked };
    }
  }
  return null;
}

export function findJokerSwap(player, players) {
  for (const owner of players) {
    for (let meldIndex = 0; meldIndex < owner.melds.length; meldIndex++) {
      const meld = owner.melds[meldIndex];
      if (meld.type === 'flowers') continue;

      const base = meld.tiles.find(t => !isJoker(t) && !isFlower(t));
      if (!base) continue;

      const jokerIndex = meld.tiles.findIndex(isJoker);
      if (jokerIndex === -1) continue;

      const replacement = player.hand.find(t => t.value === base.value);
      if (replacement) return { ownerId: owner.id, meldIndex, jokerIndex, replacement };
    }
  }
  return null;
}
