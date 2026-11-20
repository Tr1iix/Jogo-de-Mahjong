const KEY = 'mahjong:placar';

const empty = () => ({ games: 0, draws: 0, wins: [0, 0, 0, 0] });

export function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && Array.isArray(saved.wins) && saved.wins.length === 4) return saved;
  } catch {
    // localStorage indisponível ou conteúdo inválido
  }
  return empty();
}

export function saveStats(stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    // sem persistência, segue só na memória
  }
}

export function resetStats() {
  const stats = empty();
  saveStats(stats);
  return stats;
}

export function recordResult(stats, winnerId) {
  stats.games++;
  if (winnerId === null) stats.draws++;
  else stats.wins[winnerId]++;
  saveStats(stats);
}
