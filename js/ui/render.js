import { SUITS, tileLabel, isFlower, isJoker } from '../engine/tiles.js';
import { PLAYER_NAMES } from '../engine/game.js';
import { canDeclare, findJokerSwap, findPromotion, flowersIn } from '../engine/rules.js';

const $ = id => document.getElementById(id);

const KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

const PIPS = {
  1: [4],
  2: [1, 7],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
  7: [0, 2, 3, 4, 5, 6, 8],
  8: [0, 1, 2, 3, 5, 6, 7, 8],
  9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

function faceHtml(tile) {
  switch (tile.suit) {
    case SUITS.MAN:
      return `<span class="face-main suit-man">${KANJI[tile.rank]}</span><span class="face-sub suit-man">萬</span>`;

    case SUITS.PIN:
    case SUITS.SOU: {
      const cells = PIPS[tile.rank];
      let html = '';
      for (let i = 0; i < 9; i++) {
        html += cells.includes(i) ? `<i${tile.rank === 1 ? ' class="big"' : ''}></i>` : '<b></b>';
      }
      return `<span class="pips ${tile.suit}">${html}</span>`;
    }

    case SUITS.WIND:
      return `<span class="face-main suit-wind">${tile.symbol}</span>`;

    case SUITS.DRAGON:
      if (tile.code === 'white') return '<span class="dragon-white"></span>';
      return `<span class="face-main suit-dragon-${tile.code}">${tile.symbol}</span>`;

    case SUITS.FLOWER:
      return `<span class="face-main suit-flower">❀</span><span class="face-sub suit-flower">${tile.rank}</span>`;

    case SUITS.JOKER:
      return '<span class="face-main suit-joker">★</span>';

    default:
      return '';
  }
}

export function tileHtml(tile, { mini = false, faceDown = false, clickable = false, lastDiscard = false, fresh = false } = {}) {
  if (faceDown) return `<div class="tile back${mini ? ' mini' : ''}"></div>`;

  const classes = ['tile'];
  if (mini) classes.push('mini');
  if (clickable) classes.push('can-discard');
  if (lastDiscard) classes.push('last-discard');
  if (fresh) classes.push('new-tile');

  const attrs = clickable ? ' tabindex="0" role="button"' : '';
  return `<div class="${classes.join(' ')}" data-uid="${tile.uid}" title="${tileLabel(tile)}"${attrs}>
    <span class="tile-corner">${tile.rank ?? ''}</span>
    <span class="tile-face">${faceHtml(tile)}</span>
    <span class="tile-name">${tileLabel(tile)}</span>
  </div>`;
}

const show = (id, visible) => { $(id).style.display = visible ? 'inline-block' : 'none'; };

function renderTutorialBox(game, guide) {
  const box = $('tutorial-box');
  box.classList.toggle('hidden', !guide);
  if (!guide) return;

  $('tutorial-badge').textContent = guide.badge;
  $('tutorial-title').textContent = guide.title;
  $('tutorial-desc').textContent = guide.desc;
  $('tutorial-extra').innerHTML = guide.extra ?? '';
  $('tutorial-bar').style.width = `${Math.round((guide.step / guide.total) * 100)}%`;

  const button = $('btn-tutorial-next');
  button.textContent = guide.actionLabel;
  button.disabled = Boolean(guide.disabled);
}

function renderResult(game) {
  const banner = $('win-banner');
  const ended = game.phase === 'ended';
  banner.classList.toggle('hidden', !ended);
  if (!ended) return;

  banner.classList.toggle('draw', game.winnerId === null);

  let title = 'Muro vazio: empate';
  if (game.winnerId === 0) title = 'Mah Jongg! Você venceu';
  else if (game.winnerId !== null) title = `Mah Jongg! ${PLAYER_NAMES[game.winnerId]} venceu`;
  $('win-title').textContent = title;
  $('win-desc').textContent = game.endReason;

  let tiles = '';
  if (game.winnerId !== null) {
    const winner = game.players[game.winnerId];
    const shown = [
      ...winner.melds.filter(m => m.type !== 'flowers').flatMap(m => m.tiles),
      ...winner.hand.filter(t => !isFlower(t)),
    ];
    tiles = shown.map(t => tileHtml(t, { mini: true })).join('');
  }
  $('win-hand').innerHTML = tiles;
}

function renderActions(game) {
  const human = game.human;
  const claimBar = $('claim-bar');
  const actionBar = $('turn-actions-bar');
  const hint = $('south-hint');
  const tutorial = game.isTutorial;

  show('btn-hint', !tutorial);
  show('btn-sort', !tutorial);

  if (game.phase === 'claim' && game.pendingClaim) {
    const { options, canWin, tile, fromPlayerId } = game.pendingClaim;
    claimBar.classList.remove('hidden');
    actionBar.classList.add('hidden');
    show('btn-claim-win', canWin);
    show('btn-claim-pon', options.pon);
    show('btn-claim-kong', options.kong);
    show('btn-claim-quint', options.quint);
    show('btn-pass-claim', !tutorial);
    hint.textContent = `${PLAYER_NAMES[fromPlayerId]} descartou ${tileLabel(tile)}. Chame ou passe.`;
    return;
  }

  claimBar.classList.add('hidden');

  const active = game.canAct;
  const canWin = active && canDeclare(human);
  const hasFlowers = active && flowersIn(human.hand).length > 0;
  const canSwap = active && !tutorial && Boolean(findJokerSwap(human, game.players));
  const canPromote = active && !tutorial && Boolean(findPromotion(human));

  actionBar.classList.toggle('hidden', !(canWin || hasFlowers || canSwap || canPromote));
  show('btn-mahjong', canWin);
  show('btn-expose-flowers', hasFlowers);
  show('btn-swap-joker', canSwap);
  show('btn-promote-meld', canPromote);

  let text = '';
  if (game.phase === 'ended') text = game.endReason;
  else if (game.notice) text = game.notice;
  else if (canWin) text = 'Mão completa. Clique em "Mah Jongg!".';
  else if (active) text = tutorial ? 'Siga o destaque amarelo.' : 'Sua vez: escolha uma ação ou clique numa peça para descartar.';
  hint.textContent = text;
}

function renderSeats(game, showBotHands) {
  const lastUid = game.lastDiscard?.tile.uid ?? null;
  const ended = game.phase === 'ended';

  for (const player of game.players) {
    const mine = player.id === 0;
    const seat = $(`seat-${player.id}`);
    seat.classList.toggle('active-turn', game.turnId === player.id && !ended);
    seat.classList.toggle('winner-seat', ended && game.winnerId === player.id);

    const flowerCount = player.melds
      .filter(m => m.type === 'flowers')
      .reduce((sum, m) => sum + m.tiles.length, 0);
    let meta = `${player.hand.length} na mão`;
    if (flowerCount) meta += ` · ❀${flowerCount}`;
    if (mine) meta += ` · ★${player.hand.filter(isJoker).length}`;
    $(`meta-${player.id}`).textContent = meta;

    const faceDown = !mine && !showBotHands && !ended;
    const hand = $(`hand-${player.id}`);
    hand.classList.toggle('backs-only', faceDown);
    hand.innerHTML = player.hand.map(tile => tileHtml(tile, {
      faceDown,
      mini: !mine && !faceDown,
      clickable: mine && game.canHumanDiscard(tile),
      fresh: mine && tile.uid === game.lastDrawnUid,
    })).join('');

    $(`melds-${player.id}`).innerHTML = player.melds.map(meld => `
      <div class="meld${meld.type === 'flowers' ? ' flowers' : ''}">
        <span class="meld-tag">${meld.type}</span>
        ${meld.tiles.map(t => tileHtml(t, { mini: true })).join('')}
      </div>`).join('');

    $(`river-${player.id}`).innerHTML = player.discards
      .map(tile => tileHtml(tile, { mini: true, lastDiscard: tile.uid === lastUid }))
      .join('');
  }
}

function renderStats(stats) {
  const [you, east, north, west] = stats.wins;
  $('stats-text').textContent =
    `Partidas: ${stats.games} · Você: ${you} · Leste: ${east} · Norte: ${north} · Oeste: ${west} · Empates: ${stats.draws}`;
}

export function render(game, { guide, showBotHands, stats }) {
  $('wall-count').textContent = game.wall.length;

  const ended = game.phase === 'ended';
  if (ended) {
    $('turn-badge').textContent = game.winnerId === null ? 'Empate' : `Vitória: ${PLAYER_NAMES[game.winnerId]}`;
  } else if (game.phase === 'claim') {
    $('turn-badge').textContent = 'Chamada disponível';
  } else {
    $('turn-badge').textContent = `Vez: ${PLAYER_NAMES[game.turnId]}`;
  }

  renderTutorialBox(game, guide);
  renderResult(game);
  renderActions(game);
  renderSeats(game, showBotHands);

  $('log-list').innerHTML = game.history.slice(0, 12).map(line => `<li>${line}</li>`).join('');
  renderStats(stats);

  document.querySelectorAll('.pulse').forEach(el => el.classList.remove('pulse'));
  for (const selector of guide?.highlight ?? []) {
    document.querySelectorAll(selector).forEach(el => el.classList.add('pulse'));
  }
  if (game.hintUid) {
    document.querySelector(`#hand-0 [data-uid="${game.hintUid}"]`)?.classList.add('pulse');
  }
}
