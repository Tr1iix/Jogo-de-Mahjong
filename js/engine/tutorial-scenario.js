import { createDeck, createTile, shuffle, sortTiles, isFlower, isJoker } from './tiles.js';

// O que cada bot faz na cena do tutorial: o segundo descarte é o 7 de Círculo
// que o jogador vai chamar com Pon.
export const TUTORIAL_SCRIPT = [
  { bot: 1, discard: 'red' },
  { bot: 2, discard: '7p' },
];

export function buildTutorialDeal() {
  const player = sortTiles([
    createTile('1m', 0), createTile('1m', 1), createTile('1m', 2),
    createTile('5p', 0), createTile('5p', 1), createTile('5p', 2),
    createTile('7p', 0), createTile('7p', 1),
    createTile('3s', 0), createTile('3s', 1), createTile('joker', 0),
    createTile('9s', 0), createTile('2m', 0), createTile('f1', 0),
  ]);

  const taken = new Set(player.map(t => t.uid));
  const replacement = createTile('9s', 1);
  taken.add(replacement.uid);

  const pick = codes => {
    const hand = [];
    for (const code of codes) {
      for (let copy = 0; copy < 4; copy++) {
        const tile = createTile(code, copy);
        if (!taken.has(tile.uid)) {
          taken.add(tile.uid);
          hand.push(tile);
          break;
        }
      }
    }
    return sortTiles(hand);
  };

  const east = pick(['2p', '3p', '4p', '6s', '7s', '8s', 'east', 'south', 'west', 'north', 'red', 'green', 'white']);
  const north = pick(['3m', '4m', '5m', '6m', '7m', '8m', '9m', '2s', '4s', '5s', '6p', '8p', '7p']);
  const west = pick(['1s', '2s', '3m', '4m', '6s', '7s', 'east', 'south', 'west', 'north', '9p', '8m', '1p']);

  // sem flores nem coringas no muro, para a cena não sair do roteiro
  const wall = shuffle(createDeck())
    .filter(t => !taken.has(t.uid) && !isFlower(t) && !isJoker(t));
  wall.unshift(replacement);

  return { wall, hands: [player, east, north, west] };
}
