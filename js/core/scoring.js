// Placar manual por equipe, com desfazer/refazer. Funções puras: cada uma devolve um placar novo.

const LIMITE_HISTORICO = 300;

export function criarPlacar(equipes) {
  return {
    equipes: equipes.map((e, i) => ({ id: e.id ?? `e${i + 1}`, nome: e.nome, cor: e.cor ?? null, pontos: Number(e.pontos) || 0 })),
    historico: [],
    futuro: [],
  };
}

const empilhar = (historico, item) => [...historico, item].slice(-LIMITE_HISTORICO);

export function pontuar(placar, id, delta) {
  if (!Number.isFinite(delta) || delta === 0 || !placar.equipes.some((e) => e.id === id)) return placar;
  return {
    equipes: placar.equipes.map((e) => (e.id === id ? { ...e, pontos: e.pontos + delta } : e)),
    historico: empilhar(placar.historico, { tipo: 'pontos', id, delta }),
    futuro: [],
  };
}

export function zerar(placar) {
  if (placar.equipes.every((e) => e.pontos === 0)) return placar;
  return {
    equipes: placar.equipes.map((e) => ({ ...e, pontos: 0 })),
    historico: empilhar(placar.historico, { tipo: 'zerar', anteriores: Object.fromEntries(placar.equipes.map((e) => [e.id, e.pontos])) }),
    futuro: [],
  };
}

function reverter(equipes, acao) {
  if (acao.tipo === 'pontos') return equipes.map((e) => (e.id === acao.id ? { ...e, pontos: e.pontos - acao.delta } : e));
  return equipes.map((e) => ({ ...e, pontos: acao.anteriores[e.id] ?? e.pontos }));
}

function reaplicar(equipes, acao) {
  if (acao.tipo === 'pontos') return equipes.map((e) => (e.id === acao.id ? { ...e, pontos: e.pontos + acao.delta } : e));
  return equipes.map((e) => ({ ...e, pontos: 0 }));
}

export function desfazer(placar) {
  const acao = placar.historico.at(-1);
  if (!acao) return placar;
  return { equipes: reverter(placar.equipes, acao), historico: placar.historico.slice(0, -1), futuro: [...placar.futuro, acao] };
}

export function refazer(placar) {
  const acao = placar.futuro.at(-1);
  if (!acao) return placar;
  return { equipes: reaplicar(placar.equipes, acao), historico: empilhar(placar.historico, acao), futuro: placar.futuro.slice(0, -1) };
}

export function renomear(placar, id, nome) {
  return { ...placar, equipes: placar.equipes.map((e) => (e.id === id ? { ...e, nome } : e)) };
}

// Ranking com empates dividindo a posição (1º, 1º, 3º...).
export function ranking(placar) {
  const ordenadas = [...placar.equipes].sort((a, b) => b.pontos - a.pontos);
  return ordenadas.map((e, i) => ({ ...e, posicao: ordenadas.findIndex((x) => x.pontos === e.pontos) + 1 }));
}
