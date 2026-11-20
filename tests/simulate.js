import assert from 'node:assert/strict';
import { Game } from '../js/engine/game.js';
import { canDeclare } from '../js/engine/rules.js';
import { suggestDiscard } from '../js/engine/bots.js';

// sem timers: quem dirige a partida é o próprio teste
const manual = { setTimer: () => 0, clearTimer: () => {} };

function tutorialRun() {
  const game = new Game('tutorial', manual);
  game.start();
  assert.equal(game.human.hand.length, 14);

  game.tutorial.intro = 3;
  game.humanExposeFlowers();
  assert.equal(game.human.hand.filter(t => t.code === '9s').length, 2);

  const extra = game.human.hand.find(t => t.code === '2m');
  assert.ok(game.discard(0, extra.uid));
  assert.equal(game.phase, 'bots');

  game.tutorialBotStep();
  game.advance(1);
  game.tutorialBotStep();
  assert.equal(game.phase, 'claim');
  assert.deepEqual(Object.keys(game.pendingClaim.options), ['pon']);
  assert.equal(game.pendingClaim.canWin, false);

  game.humanClaim('pon');
  assert.ok(canDeclare(game.human));
  game.humanDeclare();
  assert.equal(game.winnerId, 0);
}

function playFull(level) {
  const game = new Game(level, manual);
  game.start();

  for (let turns = 0; game.phase !== 'ended' && turns < 2000; turns++) {
    if (game.phase === 'claim') {
      if (game.pendingClaim.canWin) game.humanClaimWin();
      else game.humanPass();
    } else if (game.turnId !== 0) {
      game.runBotTurn();
    } else if (game.phase === 'draw') {
      game.humanDraw();
    } else {
      if (canDeclare(game.human)) { game.humanDeclare(); break; }
      game.exposeFlowers(0);
      game.discard(0, suggestDiscard(game.human).uid);
    }
  }
  assert.equal(game.phase, 'ended', `partida ${level} não terminou`);
  return game.winnerId;
}

tutorialRun();
console.log('tutorial ok');

for (const level of ['easy', 'normal', 'hard']) {
  const results = {};
  for (let i = 0; i < 200; i++) {
    const winner = playFull(level);
    results[winner] = (results[winner] ?? 0) + 1;
  }
  console.log(level, results);
}
