export const SUITS = {
  MAN: 'man',
  PIN: 'pin',
  SOU: 'sou',
  WIND: 'wind',
  DRAGON: 'dragon',
  FLOWER: 'flower',
  JOKER: 'joker',
};

const TYPES = [];

for (const [letter, suit, offset] of [['m', SUITS.MAN, 0], ['p', SUITS.PIN, 10], ['s', SUITS.SOU, 20]]) {
  for (let rank = 1; rank <= 9; rank++) {
    TYPES.push({ code: rank + letter, suit, rank, value: offset + rank });
  }
}

const HONORS = [
  ['east', '東', 31, SUITS.WIND],
  ['south', '南', 32, SUITS.WIND],
  ['west', '西', 33, SUITS.WIND],
  ['north', '北', 34, SUITS.WIND],
  ['red', '中', 41, SUITS.DRAGON],
  ['green', '發', 42, SUITS.DRAGON],
  ['white', '白', 43, SUITS.DRAGON],
];
for (const [code, symbol, value, suit] of HONORS) {
  TYPES.push({ code, suit, rank: null, value, symbol });
}

const FLOWERS = Array.from({ length: 8 }, (_, i) => ({
  code: `f${i + 1}`, suit: SUITS.FLOWER, rank: i + 1, value: 51 + i, symbol: '❀',
}));

const JOKER = { code: 'joker', suit: SUITS.JOKER, rank: null, value: 60, symbol: '★' };

const BY_CODE = new Map([...TYPES, ...FLOWERS, JOKER].map(t => [t.code, t]));

export const isFlower = tile => tile.suit === SUITS.FLOWER;
export const isJoker = tile => tile.suit === SUITS.JOKER;

// 1-9 de cada naipe (os valores de naipes diferentes nunca se sobrepõem)
export const isSuitedValue = value =>
  (value >= 1 && value <= 9) || (value >= 11 && value <= 19) || (value >= 21 && value <= 29);

export function createTile(code, copy = 0) {
  return { ...BY_CODE.get(code), uid: `${code}#${copy}` };
}

// 136 peças de naipe/honra + 8 flores + 8 coringas = 152
export function createDeck() {
  const deck = [];
  for (const type of TYPES) {
    for (let copy = 0; copy < 4; copy++) deck.push(createTile(type.code, copy));
  }
  for (const flower of FLOWERS) deck.push(createTile(flower.code));
  for (let copy = 0; copy < 8; copy++) deck.push(createTile('joker', copy));
  return deck;
}

export function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function sortTiles(tiles) {
  return [...tiles].sort((a, b) => a.value - b.value || a.uid.localeCompare(b.uid));
}

const SUIT_ABBR = { man: 'Caract.', pin: 'Círc.', sou: 'Bamb.' };
const HONOR_NAMES = {
  east: 'Leste', south: 'Sul', west: 'Oeste', north: 'Norte',
  red: 'Dr. Verm.', green: 'Dr. Verde', white: 'Dr. Branco', joker: 'Coringa',
};

export function tileLabel(tile) {
  if (SUIT_ABBR[tile.suit]) return `${tile.rank} ${SUIT_ABBR[tile.suit]}`;
  if (isFlower(tile)) return `Flor ${tile.rank}`;
  return HONOR_NAMES[tile.code] ?? tile.code;
}
