import { createTile } from '../engine/tiles.js';
import { canDeclare, flowersIn } from '../engine/rules.js';
import { tileHtml } from './render.js';

const TOTAL_STEPS = 8;

function group(caption, codes, missing = 0) {
  const tiles = codes.map((code, i) => tileHtml(createTile(code, i), { mini: true })).join('');
  const blanks = '<div class="tile back mini"></div>'.repeat(missing);
  return `<div class="t-group${missing ? ' missing' : ''}">
    <div class="t-tiles">${tiles}${blanks}</div>
    <span class="t-caption">${caption}</span>
  </div>`;
}

const LEGEND = `<div class="t-legend">
  <strong>Caracteres</strong> 一 二 三… (1 a 9, com 萬) · <strong>Círculos</strong> (bolinhas, 1 a 9) · <strong>Bambus</strong> (varetas, 1 a 9)<br>
  <strong>Ventos</strong> 東 南 西 北 · <strong>Dragões</strong> 中 發 白 · <strong>Flores</strong> ❀ (bônus, não entram em grupos) · <strong>Coringa</strong> ★ (vale qualquer peça, só em grupos)
</div>`;

const INTRO = [
  {
    title: 'Bem-vindo: como o jogo funciona',
    desc: 'Pense num jogo de cartas feito com peças. A cada rodada você compra 1 peça do muro e descarta 1 da mão. O objetivo é formar uma mão de 14 peças com grupos de peças iguais mais 1 par, e clicar em "Mah Jongg!". Neste tutorial tudo é roteirizado: você vence em poucas jogadas e aprende a chamar o descarte de outro jogador (o Pon).',
    extra: '',
  },
  {
    title: 'Conheça as peças',
    desc: 'Passe o mouse sobre qualquer peça para ver o nome dela. Existem estes tipos:',
    extra: LEGEND,
  },
  {
    title: 'Sua mão: quase pronta',
    desc: 'Um grupo são 3 peças idênticas e o par são 2 idênticas. Você já tem 3 grupos prontos (um usa o Coringa). Faltam duas coisas: o segundo 9 de Bambu, que vem da flor, e o terceiro 7 de Círculo, que você vai pegar de um adversário com o Pon.',
    extra:
      group('Grupo: 3 Caracteres-1', ['1m', '1m', '1m']) +
      group('Grupo: 3 Círculos-5', ['5p', '5p', '5p']) +
      group('Grupo: 2 Bambus-3 + Coringa', ['3s', '3s', 'joker']) +
      group('Quase grupo: 7 Círculos (falta 1)', ['7p', '7p'], 1) +
      group('Par: 9 Bambus (falta 1)', ['9s'], 1),
  },
];

export function getGuidance(game) {
  const human = game.human;
  const badge = n => `Tutorial · passo ${n} de ${TOTAL_STEPS}`;
  const base = { total: TOTAL_STEPS, extra: '', highlight: [] };

  if (game.phase === 'ended') {
    return {
      ...base,
      step: TOTAL_STEPS,
      badge: 'Tutorial concluído',
      title: 'Você venceu',
      desc: 'Você viu o essencial: comprar e descartar, grupos, par, flor, coringa e a chamada de Pon. Agora experimente o modo Fácil: os bots jogam de verdade, você compra do muro e pode chamar Pon, Kong ou Quint sempre que um bot descartar uma peça de que você precisa.',
      actionLabel: 'Refazer o tutorial',
      run: () => game.onRestart?.(),
    };
  }

  const intro = game.tutorial.intro;
  if (intro < 3) {
    return {
      ...base,
      step: intro + 1,
      badge: badge(intro + 1),
      title: INTRO[intro].title,
      desc: INTRO[intro].desc,
      extra: INTRO[intro].extra,
      actionLabel: intro === 2 ? 'Entendi, vamos jogar' : 'Próximo',
      highlight: ['#btn-tutorial-next'],
      run: () => { game.tutorial.intro++; game.onChange(); },
    };
  }

  if (game.phase === 'discard' && canDeclare(human)) {
    return {
      ...base,
      step: 8,
      badge: badge(8),
      title: 'Declare Mah Jongg',
      desc: 'Conte: 3 + 3 + 3 + 3 (quatro grupos, um deles é o Pon que você acabou de chamar) + 2 (o par de 9 de Bambu) = 14 peças, todas encaixadas. Como a chamada completou a mão, você não precisa descartar. Clique no botão verde "Mah Jongg!".',
      actionLabel: 'Declarar Mah Jongg',
      highlight: ['#btn-mahjong'],
      run: () => game.humanDeclare(),
    };
  }

  if (game.phase === 'claim' && game.pendingClaim) {
    return {
      ...base,
      step: 7,
      badge: badge(7),
      title: 'Chame Pon',
      desc: 'O Bot Norte descartou um 7 de Círculo (a peça com borda amarela no rio). Você tem dois 7 de Círculo na mão, então pode chamar Pon: pegar o descarte para formar um grupo de 3, que fica exposto na mesa. Com 4 iguais seria Kong, com 5, Quint. Clique em "Chamar Pon". Neste passo o botão Passar fica desativado.',
      actionLabel: 'Chamar Pon agora',
      highlight: ['#btn-claim-pon', '#hand-0 [data-uid^="7p"]', '#river-2 .last-discard'],
      run: () => game.humanClaim('pon'),
    };
  }

  if (game.phase === 'bots') {
    return {
      ...base,
      step: 6,
      badge: badge(6),
      title: 'Vez dos bots',
      desc: 'Agora os adversários compram e descartam, um de cada vez, no sentido anti-horário. Acompanhe os descartes que aparecem no meio da mesa. Quando um servir para você, o jogo avisa.',
      actionLabel: 'Aguarde',
      disabled: true,
      run: () => {},
    };
  }

  if (game.canAct && flowersIn(human.hand).length > 0) {
    return {
      ...base,
      step: 4,
      badge: badge(4),
      title: 'Exponha sua flor',
      desc: 'A peça rosa ❀ na sua mão é uma flor: um bônus que não serve para montar grupos. Ao expô-la (mostrá-la na mesa), você compra uma peça nova do muro de graça. Clique em "Expor Flores".',
      actionLabel: 'Expor flores',
      highlight: ['#btn-expose-flowers', '#hand-0 [data-uid^="f1"]'],
      run: () => game.humanExposeFlowers(),
    };
  }

  const extra = human.hand.find(t => t.code === '2m');
  if (game.canAct && extra) {
    return {
      ...base,
      step: 5,
      badge: badge(5),
      title: 'Descarte a peça que sobrou',
      desc: 'Chegou o 9 de Bambu que faltava e o seu par está completo. Mas agora sobra uma peça que não combina com nada: o 2 de Caracteres. Clique nela para descartar. Depois disso os bots jogam.',
      actionLabel: 'Descartar 2 Caracteres',
      highlight: [`#hand-0 [data-uid="${extra.uid}"]`],
      run: () => game.discard(0, extra.uid),
    };
  }

  return {
    ...base,
    step: 5,
    badge: 'Tutorial',
    title: 'Algo saiu do roteiro',
    desc: 'Reinicie o tutorial para voltar ao começo.',
    actionLabel: 'Reiniciar tutorial',
    run: () => game.onRestart?.(),
  };
}
