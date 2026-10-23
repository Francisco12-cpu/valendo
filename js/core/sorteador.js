// Sorteador sem repetição, com chamada de presença (ausentes não entram). Funções puras.

export function criarSorteio(itens) {
  return { itens: itens.map((it, i) => (typeof it === 'string' ? { id: `s${i + 1}`, nome: it } : it)), sorteados: [], ausentes: [] };
}

export function disponiveis(s) {
  return s.itens.filter((it) => !s.sorteados.includes(it.id) && !s.ausentes.includes(it.id));
}

export function sortear(s, rng = Math.random) {
  const livres = disponiveis(s);
  if (!livres.length) return { sorteio: s, item: null };
  const item = livres[Math.floor(rng() * livres.length)];
  return { sorteio: { ...s, sorteados: [...s.sorteados, item.id] }, item };
}

export function desfazerSorteio(s) {
  return s.sorteados.length ? { ...s, sorteados: s.sorteados.slice(0, -1) } : s;
}

export function reiniciar(s) {
  return { ...s, sorteados: [] };
}

export function marcarAusente(s, id, ausente) {
  const sem = s.ausentes.filter((x) => x !== id);
  return { ...s, ausentes: ausente ? [...sem, id] : sem };
}

export function historico(s) {
  return s.sorteados.map((id) => s.itens.find((it) => it.id === id)).filter(Boolean);
}
