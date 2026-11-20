import { createDeck, shuffle, sortTiles, tileLabel, isFlower } from './tiles.js';
import {
  canDeclare, wouldWinWith, findClaimOptions, findPromotion, findJokerSwap, flowersIn,
} from './rules.js';
import { chooseDiscard, suggestDiscard, CLAIM_CHANCE } from './bots.js';
import { buildTutorialDeal, TUTORIAL_SCRIPT } from './tutorial-scenario.js';

export const PLAYER_NAMES = { 0: 'Você', 1: 'Bot Leste', 2: 'Bot Norte', 3: 'Bot Oeste' };
const LEVEL_NAMES = { easy: 'Fácil', normal: 'Normal', hard: 'Difícil' };

const TURN_ORDER = [1, 2, 3, 0];
const nextPlayer = id => TURN_ORDER[(TURN_ORDER.indexOf(id) + 1) % TURN_ORDER.length];

/**
 * Estado e regras de uma partida. Não toca no DOM: quem desenha a tela
 * escuta onChange e lê as propriedades públicas (wall, players, phase...).
 *
 * phase: 'draw' | 'discard' | 'claim' | 'bots' (só no tutorial) | 'ended'
 */
export class Game {
  constructor(mode, options = {}) {
    this.mode = mode;
    this.autoFlowers = options.autoFlowers ?? true;
    this.onChange = options.onChange ?? (() => {});
    this.onEnd = options.onEnd ?? (() => {});
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? (id => clearTimeout(id));
    this.timer = null;
    this.tutorial = { intro: 0, step: 0 };
    this.deal();
  }

  get isTutorial() { return this.mode === 'tutorial'; }
  get human() { return this.players[0]; }

  deal() {
    let wall;
    let hands;
    if (this.isTutorial) {
      ({ wall, hands } = buildTutorialDeal());
    } else {
      wall = shuffle(createDeck());
      hands = [13, 14, 13, 13].map(n => sortTiles(wall.splice(0, n)));
    }

    this.wall = wall;
    this.players = hands.map((hand, id) => ({ id, hand, melds: [], discards: [] }));
    this.turnId = this.isTutorial ? 0 : 1;
    this.phase = 'discard';
    this.lastDiscard = null;
    this.pendingClaim = null;
    this.winnerId = null;
    this.endReason = '';
    this.history = [];
    this.lastDrawnUid = null;
    this.hintUid = null;
    this.notice = '';
  }

  start() {
    this.addLog(this.isTutorial
      ? 'Tutorial iniciado. Siga os passos indicados.'
      : `Nova partida (${LEVEL_NAMES[this.mode]}). O Bot Leste começa.`);
    if (this.autoFlowersOn()) this.exposeFlowers(0);
    this.onChange();
    this.schedule();
  }

  stop() {
    if (this.timer) this.clearTimer(this.timer);
    this.timer = null;
  }

  after(ms, fn) {
    this.stop();
    this.timer = this.setTimer(fn, ms);
  }

  addLog(text) {
    this.history.unshift(text);
    if (this.history.length > 40) this.history.pop();
  }

  note(text) {
    this.notice = text;
    this.onChange();
  }

  autoFlowersOn() { return !this.isTutorial && this.autoFlowers; }

  /* fim de jogo */

  finish(winnerId, reason) {
    if (this.phase === 'ended') return;
    this.stop();
    this.phase = 'ended';
    this.pendingClaim = null;
    this.winnerId = winnerId;
    this.endReason = reason;
    this.hintUid = null;
    this.addLog(`${PLAYER_NAMES[winnerId]} fechou Mah Jongg`);
    this.onEnd(winnerId);
    this.onChange();
  }

  finishWithoutWinner() {
    if (this.phase === 'ended') return;
    this.stop();
    this.phase = 'ended';
    this.pendingClaim = null;
    this.winnerId = null;
    this.endReason = 'O muro acabou antes de alguém fechar Mah Jongg.';
    this.addLog('O muro acabou: empate');
    this.onEnd(null);
    this.onChange();
  }

  /* compra e flores */

  draw(player) {
    if (this.wall.length === 0) {
      this.finishWithoutWinner();
      return null;
    }
    const tile = this.wall.shift();
    player.hand.push(tile);
    if (player.id === 0) this.lastDrawnUid = tile.uid;
    return tile;
  }

  exposeFlowers(playerId) {
    const player = this.players[playerId];
    let flowers = flowersIn(player.hand);
    if (flowers.length === 0) return false;
    const total = flowers.length;

    while (flowers.length > 0) {
      const ids = new Set(flowers.map(f => f.uid));
      player.hand = player.hand.filter(t => !ids.has(t.uid));

      let pile = player.melds.find(m => m.type === 'flowers');
      if (!pile) {
        pile = { type: 'flowers', tiles: [] };
        player.melds.push(pile);
      }
      pile.tiles.push(...flowers);

      for (let i = 0; i < flowers.length; i++) {
        if (!this.draw(player)) {
          player.hand = sortTiles(player.hand);
          return true;
        }
      }
      flowers = flowersIn(player.hand);
    }

    player.hand = sortTiles(player.hand);
    this.addLog(`${PLAYER_NAMES[playerId]} expôs ${total} ${total > 1 ? 'flores' : 'flor'} e comprou reposição`);
    return true;
  }

  swapJoker(playerId, swap) {
    const player = this.players[playerId];
    const owner = this.players[swap.ownerId];
    const meld = owner.melds[swap.meldIndex];
    const joker = meld.tiles[swap.jokerIndex];

    player.hand = player.hand.filter(t => t.uid !== swap.replacement.uid);
    meld.tiles[swap.jokerIndex] = swap.replacement;
    player.hand = sortTiles([...player.hand, joker]);
    this.addLog(`${PLAYER_NAMES[playerId]} trocou um coringa de ${PLAYER_NAMES[swap.ownerId]}`);
  }

  /* chamadas */

  removeFromRiver(playerId, tile) {
    const owner = this.players[playerId];
    owner.discards = owner.discards.filter(t => t.uid !== tile.uid);
  }

  claim(claimerId, type, data) {
    const used = data.options[type];
    if (!used) return;

    const claimer = this.players[claimerId];
    this.removeFromRiver(data.fromPlayerId, data.tile);

    const usedIds = new Set(used.map(t => t.uid));
    claimer.hand = sortTiles(claimer.hand.filter(t => !usedIds.has(t.uid)));
    claimer.melds.push({ type, tiles: [...used, data.tile] });

    this.pendingClaim = null;
    this.lastDiscard = null;
    this.turnId = claimerId;
    this.hintUid = null;
    this.notice = '';
    this.addLog(`${PLAYER_NAMES[claimerId]} chamou ${type.toUpperCase()} com ${tileLabel(data.tile)}`);

    if (claimerId !== 0 && canDeclare(claimer)) {
      this.finish(claimerId, `${PLAYER_NAMES[claimerId]} fechou a mão com uma chamada de ${type.toUpperCase()}.`);
      return;
    }

    this.phase = 'discard';
    this.onChange();
    if (claimerId !== 0 && !this.isTutorial) this.after(600, () => this.runBotTurn());
  }

  claimWin(winnerId, data) {
    const winner = this.players[winnerId];
    this.removeFromRiver(data.fromPlayerId, data.tile);
    winner.hand = sortTiles([...winner.hand, data.tile]);
    this.lastDiscard = null;
    this.finish(winnerId,
      `${PLAYER_NAMES[winnerId]} fechou com o descarte de ${PLAYER_NAMES[data.fromPlayerId]} (${tileLabel(data.tile)}).`);
  }

  /* descarte */

  canHumanDiscard(tile) {
    if (this.phase !== 'discard' || this.turnId !== 0 || isFlower(tile)) return false;
    if (!this.isTutorial) return true;
    return this.tutorial.intro >= 3 && tile.code === '2m' && flowersIn(this.human.hand).length === 0;
  }

  discard(playerId, uid) {
    if (this.phase !== 'discard' || this.turnId !== playerId) return false;

    const player = this.players[playerId];
    const index = player.hand.findIndex(t => t.uid === uid);
    if (index === -1) return false;

    const tile = player.hand[index];
    if (isFlower(tile)) return false;

    if (this.isTutorial && playerId === 0 && !this.canHumanDiscard(tile)) {
      this.note('No tutorial, siga o passo indicado acima.');
      return false;
    }

    player.hand.splice(index, 1);
    player.hand = sortTiles(player.hand);
    player.discards.push(tile);
    this.lastDiscard = { playerId, tile };
    this.hintUid = null;
    this.notice = '';
    if (playerId === 0) this.lastDrawnUid = null;
    this.addLog(`${PLAYER_NAMES[playerId]} descartou ${tileLabel(tile)}`);

    if (this.isTutorial && playerId === 0) {
      this.startTutorialBots();
      return true;
    }

    if (this.tryBotWins(tile, playerId)) return true;

    if (playerId !== 0) {
      const options = findClaimOptions(this.human.hand, tile, { allowJoker: !this.isTutorial });
      const canWin = !this.isTutorial && wouldWinWith(this.human, tile);
      if (options.pon || options.kong || options.quint || canWin) {
        this.phase = 'claim';
        this.pendingClaim = { tile, fromPlayerId: playerId, options, canWin };
        this.onChange();
        return true;
      }
    }

    if (this.tryBotClaims(tile, playerId)) return true;
    this.advance(playerId);
    return true;
  }

  botsAfter(fromId) {
    const order = [];
    let id = fromId;
    for (let i = 0; i < 3; i++) {
      id = nextPlayer(id);
      if (id !== 0) order.push(id);
    }
    return order;
  }

  tryBotWins(tile, fromPlayerId) {
    if (this.isTutorial) return false;
    for (const id of this.botsAfter(fromPlayerId)) {
      if (wouldWinWith(this.players[id], tile)) {
        this.claimWin(id, { tile, fromPlayerId });
        return true;
      }
    }
    return false;
  }

  tryBotClaims(tile, fromPlayerId) {
    if (this.isTutorial) return false;
    const chance = CLAIM_CHANCE[this.mode] ?? 0.6;

    for (const id of this.botsAfter(fromPlayerId)) {
      const options = findClaimOptions(this.players[id].hand, tile, { allowJoker: false });
      const type = options.quint ? 'quint' : options.kong ? 'kong' : options.pon ? 'pon' : null;
      if (type && Math.random() < chance) {
        this.claim(id, type, { tile, fromPlayerId, options });
        return true;
      }
    }
    return false;
  }

  advance(fromPlayerId) {
    if (this.phase === 'ended') return;

    if (this.isTutorial) {
      if (this.tutorial.step < TUTORIAL_SCRIPT.length) {
        this.phase = 'bots';
        this.turnId = TUTORIAL_SCRIPT[this.tutorial.step].bot;
        this.onChange();
        this.after(1100, () => this.tutorialBotStep());
      }
      return;
    }

    this.turnId = nextPlayer(fromPlayerId);
    this.phase = 'draw';
    this.onChange();
    this.schedule();
  }

  /* tutorial */

  startTutorialBots() {
    this.tutorial.step = 0;
    this.phase = 'bots';
    this.turnId = TUTORIAL_SCRIPT[0].bot;
    this.onChange();
    this.after(1100, () => this.tutorialBotStep());
  }

  tutorialBotStep() {
    const step = TUTORIAL_SCRIPT[this.tutorial.step++];
    if (!step || this.phase === 'ended') return;

    const bot = this.players[step.bot];
    this.turnId = step.bot;
    this.phase = 'discard';
    this.draw(bot);
    const tile = bot.hand.find(t => t.code === step.discard);
    this.discard(step.bot, tile.uid);
  }

  /* bots */

  schedule() {
    if (this.phase === 'ended' || this.phase === 'claim' || this.isTutorial) return;
    if (this.turnId === 0) this.after(350, () => this.humanDraw());
    else this.after(650, () => this.runBotTurn());
  }

  runBotTurn() {
    if (this.phase === 'ended' || this.phase === 'claim' || this.isTutorial) return;
    const id = this.turnId;
    if (id === 0) return;
    const bot = this.players[id];

    if (this.phase === 'draw') {
      if (!this.draw(bot)) return;
      this.exposeFlowers(id);
      if (this.phase === 'ended') return;

      const swap = findJokerSwap(bot, this.players);
      if (swap) this.swapJoker(id, swap);

      if (canDeclare(bot)) {
        this.finish(id, `${PLAYER_NAMES[id]} completou uma mão vencedora de 14 peças.`);
        return;
      }
      this.phase = 'discard';
      this.onChange();
      this.after(450, () => this.runBotTurn());
      return;
    }

    if (this.phase === 'discard') {
      this.exposeFlowers(id);
      if (this.phase === 'ended') return;
      if (canDeclare(bot)) {
        this.finish(id, `${PLAYER_NAMES[id]} completou uma mão vencedora.`);
        return;
      }
      this.discard(id, chooseDiscard(bot, this.mode).uid);
    }
  }

  /* ações do jogador */

  humanDraw() {
    if (this.phase !== 'draw' || this.turnId !== 0) return;
    const tile = this.draw(this.human);
    if (!tile) return;

    this.phase = 'discard';
    this.hintUid = null;
    this.notice = '';
    this.addLog(`Você comprou ${tileLabel(tile)}`);
    if (this.autoFlowersOn()) this.exposeFlowers(0);
    this.onChange();
  }

  get canAct() { return this.phase === 'discard' && this.turnId === 0; }

  humanExposeFlowers() {
    if (!this.canAct) return;
    if (this.exposeFlowers(0)) this.onChange();
  }

  humanSwapJoker() {
    if (!this.canAct || this.isTutorial) return;
    const swap = findJokerSwap(this.human, this.players);
    if (swap) {
      this.swapJoker(0, swap);
      this.onChange();
    }
  }

  humanPromote() {
    if (!this.canAct || this.isTutorial) return;
    const promo = findPromotion(this.human);
    if (!promo) return;

    const ids = new Set(promo.tiles.map(t => t.uid));
    this.human.hand = sortTiles(this.human.hand.filter(t => !ids.has(t.uid)));
    const meld = this.human.melds[promo.meldIndex];
    meld.type = promo.newType;
    meld.tiles = [...meld.tiles, ...promo.tiles];
    this.addLog(`Você promoveu um meld para ${promo.newType.toUpperCase()}`);
    this.onChange();
  }

  humanDeclare() {
    if (this.phase === 'ended' || !canDeclare(this.human)) return;
    this.finish(0, this.isTutorial
      ? 'Vitória guiada no modo tutorial.'
      : 'Você completou uma mão vencedora de 14 peças.');
  }

  humanClaim(type) {
    if (this.phase !== 'claim' || !this.pendingClaim) return;
    this.claim(0, type, this.pendingClaim);
  }

  humanClaimWin() {
    if (this.phase !== 'claim' || !this.pendingClaim?.canWin) return;
    this.claimWin(0, this.pendingClaim);
  }

  humanPass() {
    if (this.phase !== 'claim' || !this.pendingClaim || this.isTutorial) return;
    const { tile, fromPlayerId } = this.pendingClaim;
    this.pendingClaim = null;
    this.addLog('Você passou a chamada');
    if (this.tryBotClaims(tile, fromPlayerId)) return;
    this.advance(fromPlayerId);
  }

  sortHand() {
    this.human.hand = sortTiles(this.human.hand);
    this.onChange();
  }

  requestHint() {
    if (!this.canAct) return this.note('A dica funciona na sua vez de descartar.');
    if (canDeclare(this.human)) return this.note('Sua mão está completa: clique em "Mah Jongg!".');
    if (flowersIn(this.human.hand).length) return this.note('Exponha suas flores primeiro.');

    const tile = suggestDiscard(this.human);
    if (!tile) return;
    this.hintUid = tile.uid;
    this.note(`${tileLabel(tile)} é a peça que menos ajuda a sua mão.`);
  }
}
