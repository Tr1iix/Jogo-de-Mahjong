import { Game } from './engine/game.js';
import { render } from './ui/render.js';
import { getGuidance } from './ui/tutorial-guide.js';
import { loadStats, resetStats, recordResult } from './ui/stats.js';

const $ = id => document.getElementById(id);

let mode = 'tutorial';
let showBotHands = false;
let stats = loadStats();
let game = null;

function refresh() {
  const guide = game.isTutorial ? getGuidance(game) : null;
  render(game, { guide, showBotHands, stats });
}

function newGame() {
  game?.stop();
  game = new Game(mode, {
    autoFlowers: $('chk-auto-flowers').checked,
    onChange: refresh,
    onEnd: winnerId => {
      if (game.isTutorial) return;
      recordResult(stats, winnerId);
    },
  });
  game.onRestart = newGame;
  game.start();
}

$('mode-group').addEventListener('click', event => {
  const button = event.target.closest('.mode-btn');
  if (!button) return;
  mode = button.dataset.mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b === button));
  newGame();
});

$('btn-tutorial-next').addEventListener('click', () => {
  const guide = getGuidance(game);
  if (!guide.disabled) guide.run();
});

const hand = $('hand-0');
const discardFrom = target => {
  const tile = target.closest('.tile.can-discard');
  if (tile) game.discard(0, tile.dataset.uid);
};
hand.addEventListener('click', event => discardFrom(event.target));
hand.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  discardFrom(event.target);
});

$('btn-mahjong').addEventListener('click', () => game.humanDeclare());
$('btn-expose-flowers').addEventListener('click', () => game.humanExposeFlowers());
$('btn-swap-joker').addEventListener('click', () => game.humanSwapJoker());
$('btn-promote-meld').addEventListener('click', () => game.humanPromote());
$('btn-claim-pon').addEventListener('click', () => game.humanClaim('pon'));
$('btn-claim-kong').addEventListener('click', () => game.humanClaim('kong'));
$('btn-claim-quint').addEventListener('click', () => game.humanClaim('quint'));
$('btn-claim-win').addEventListener('click', () => game.humanClaimWin());
$('btn-pass-claim').addEventListener('click', () => game.humanPass());
$('btn-sort').addEventListener('click', () => game.sortHand());
$('btn-hint').addEventListener('click', () => game.requestHint());

$('chk-auto-flowers').addEventListener('change', event => {
  game.autoFlowers = event.target.checked;
  if (game.autoFlowersOn() && game.canAct) game.humanExposeFlowers();
});

$('btn-toggle-bots').addEventListener('click', event => {
  showBotHands = !showBotHands;
  event.target.textContent = showBotHands ? 'Esconder mãos dos bots' : 'Mostrar mãos dos bots';
  refresh();
});

$('btn-reset-stats').addEventListener('click', () => {
  stats = resetStats();
  refresh();
});

$('btn-deal').addEventListener('click', newGame);
$('btn-play-again').addEventListener('click', newGame);

const rules = $('rules-modal');
$('btn-rules').addEventListener('click', () => rules.classList.remove('hidden'));
$('btn-close-rules').addEventListener('click', () => rules.classList.add('hidden'));
rules.addEventListener('click', event => {
  if (event.target === rules) rules.classList.add('hidden');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') rules.classList.add('hidden');
});

newGame();
