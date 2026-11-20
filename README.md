# American Mah Jongg

Versão simplificada do Mah Jongg americano para jogar no navegador, contra três bots. Tem um tutorial guiado, três níveis de dificuldade, chamadas (Pon, Kong e Quint), flores e coringas.

As mãos são validadas por padrões gerais (grupos de 3 a 5, par, sequências e 7 pares). O jogo oficial usa o cartão anual da NMJL, que não está implementado aqui.

## Como rodar

O código usa módulos ES, então precisa de um servidor local (abrir o `index.html` direto com duplo clique não funciona em alguns navegadores):

```bash
npm start
# ou
python3 -m http.server 8000
```

Depois é só abrir http://localhost:8000.

No GitHub Pages funciona sem configuração extra: Settings > Pages > branch `main`, pasta `/ (root)`.

## Estrutura

```
index.html
css/style.css
js/
  main.js                  liga a interface ao jogo
  engine/                  regras e estado, sem DOM
    tiles.js               peças, baralho e rótulos
    rules.js               mão vencedora, chamadas, troca de coringa
    bots.js                escolha de descarte dos bots e dicas
    game.js                a partida (turnos, fases, ações)
    tutorial-scenario.js   mão e roteiro fixos do tutorial
  ui/                      tudo que mexe na tela
    render.js              desenha a mesa a partir do estado do jogo
    tutorial-guide.js      textos e passos do tutorial
    stats.js               placar salvo no localStorage
tests/simulate.js          simula partidas completas no Node
```

O `engine/` não depende do navegador. A classe `Game` avisa a interface por meio de `onChange` e `onEnd`, e a interface só lê o estado e chama os métodos públicos (`discard`, `humanClaim`, etc.).

## Testes

```bash
npm test
```

Roda o roteiro do tutorial e 200 partidas simuladas em cada dificuldade, conferindo que todas terminam.
