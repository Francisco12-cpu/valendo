// Motor do quiz (estilo projetor): abertura → pergunta → revelação → ranking → … → fim.
// Puro: o tempo (performance.now) e o gerador aleatório vêm de fora.
// Pronto para o controle remoto (Fase 5): toda mudança passa por estas funções,
// então um transporte de rede só precisa chamar as mesmas ações no aparelho host.
import { corrigir, tipoDe } from './questions/index.js';
import { embaralhar } from './teams.js';

export const FASES = Object.freeze({ ABERTURA: 'abertura', PERGUNTA: 'pergunta', REVELACAO: 'revelacao', RANKING: 'ranking', FIM: 'fim' });
export const BONUS_SEQUENCIA = 100;
export const MAX_BONUS_SEQUENCIA = 500;

export function criarPartida(atividade, participantes, { rng = Math.random } = {}) {
  const r = atividade.regras;
  let perguntas = atividade.conteudo.perguntas.map((q) => structuredClone(q));
  if (r.embaralharPerguntas) perguntas = embaralhar(perguntas, rng);
  if (r.embaralharOpcoes) perguntas = perguntas.map((q) => (Array.isArray(q.opcoes) ? { ...q, opcoes: embaralhar(q.opcoes, rng) } : q));
  return {
    fase: FASES.ABERTURA,
    indice: -1,
    perguntas,
    participantes: participantes.map((p) => ({ id: p.id, nome: p.nome, cor: p.cor ?? null })),
    regras: structuredClone(r),
    ranking: atividade.exibicao?.ranking ?? 'top5',
    respostas: {}, // qid → pid → { resposta, t, correta, pontos }
    pontos: Object.fromEntries(participantes.map((p) => [p.id, 0])),
    sequencias: Object.fromEntries(participantes.map((p) => [p.id, 0])),
    posicaoAnterior: {},
    inicio: null,
  };
}

export const perguntaAtual = (p) => p.perguntas[p.indice] ?? null;
export const multiplicador = (q) => (q?.multiplicador === 0 || q?.multiplicador === 2 ? q.multiplicador : 1);

// Tempo da pergunta em ms (0 = sem limite).
export function tempoLimite(p, q = perguntaAtual(p)) {
  if (!q || q.tipo === 'slide') return 0;
  const s = Number.isFinite(q.tempo) && q.tempo > 0 ? q.tempo : p.regras.tempo?.porPergunta ?? 0;
  return Math.max(0, s) * 1000;
}

export function prazo(p) {
  const limite = tempoLimite(p);
  return p.fase === FASES.PERGUNTA && limite ? p.inicio + limite : null;
}

export function proximaPergunta(p, t) {
  if (p.fase === FASES.PERGUNTA) return p;
  const indice = p.indice + 1;
  if (indice >= p.perguntas.length) return { ...p, fase: FASES.FIM };
  return { ...p, fase: FASES.PERGUNTA, indice, inicio: t, posicaoAnterior: posicoes(p) };
}

export function responder(p, pid, resposta, t) {
  const q = perguntaAtual(p);
  if (p.fase !== FASES.PERGUNTA || !q || !(pid in p.pontos)) return p;
  if (p.respostas[q.id]?.[pid]) return p; // uma resposta por participante
  const limite = prazo(p);
  if (limite !== null && t > limite) return p;
  const respostas = { ...p.respostas, [q.id]: { ...p.respostas[q.id], [pid]: { resposta, t: t - p.inicio } } };
  return { ...p, respostas };
}

export const todosResponderam = (p) => {
  const q = perguntaAtual(p);
  return Boolean(q) && p.participantes.every((x) => p.respostas[q.id]?.[x.id]);
};

// Pontos de uma resposta certa: base × multiplicador, com fator de velocidade (até metade
// dos pontos a menos para quem responde no fim) e bônus de sequência.
export function calcularPontos(p, q, tempoResposta, sequencia) {
  const pts = p.regras.pontuacao;
  const base = (q.pontos ?? pts.porAcerto) * multiplicador(q);
  const limite = tempoLimite(p, q);
  const fator = pts.velocidade && limite ? 1 - Math.min(1, Math.max(0, tempoResposta / limite)) / 2 : 1;
  const bonus = pts.sequencia && sequencia > 1 && multiplicador(q) > 0 ? Math.min(MAX_BONUS_SEQUENCIA, (sequencia - 1) * BONUS_SEQUENCIA) : 0;
  return Math.round(base * fator) + bonus;
}

export function encerrarPergunta(p) {
  const q = perguntaAtual(p);
  if (p.fase !== FASES.PERGUNTA || !q) return p;
  const temResposta = tipoDe(q)?.temResposta;
  const pontos = { ...p.pontos };
  const sequencias = { ...p.sequencias };
  const daPergunta = { ...p.respostas[q.id] };
  for (const part of p.participantes) {
    const r = daPergunta[part.id];
    if (!temResposta) {
      if (r) daPergunta[part.id] = { ...r, correta: null, pontos: 0 };
      continue;
    }
    const correta = r ? corrigir(q, r.resposta).correta === true : false;
    sequencias[part.id] = correta ? sequencias[part.id] + 1 : 0;
    let ganho = 0;
    if (correta) ganho = calcularPontos(p, q, r.t, sequencias[part.id]);
    else if (r && p.regras.pontuacao.erroTira) ganho = -p.regras.pontuacao.erroTira * multiplicador(q);
    pontos[part.id] += ganho;
    if (r) daPergunta[part.id] = { ...r, correta, pontos: ganho };
  }
  return { ...p, fase: FASES.REVELACAO, pontos, sequencias, respostas: { ...p.respostas, [q.id]: daPergunta } };
}

// Quantos escolheram cada opção (ou certo/errado nas abertas).
export function distribuicao(p, q = perguntaAtual(p)) {
  const respostas = Object.values(p.respostas[q.id] ?? {});
  if (Array.isArray(q.opcoes)) {
    const contagem = Object.fromEntries(q.opcoes.map((o) => [o.id, 0]));
    for (const r of respostas) for (const id of [].concat(r.resposta ?? [])) if (id in contagem) contagem[id] += 1;
    return { tipo: 'opcoes', contagem, total: respostas.length };
  }
  if (q.tipo === 'vf') {
    return { tipo: 'vf', contagem: { true: respostas.filter((r) => r.resposta === true).length, false: respostas.filter((r) => r.resposta === false).length }, total: respostas.length };
  }
  const certas = respostas.filter((r) => corrigir(q, r.resposta).correta).length;
  return { tipo: 'aberta', contagem: { certas, erradas: respostas.length - certas }, total: respostas.length };
}

export function posicoes(p) {
  const ordem = [...p.participantes].sort((a, b) => p.pontos[b.id] - p.pontos[a.id]);
  return Object.fromEntries(ordem.map((x) => [x.id, ordem.findIndex((y) => p.pontos[y.id] === p.pontos[x.id]) + 1]));
}

// Ranking com variação de posição desde a pergunta anterior (↑ ↓).
export function ranking(p) {
  const pos = posicoes(p);
  return [...p.participantes]
    .map((x) => ({ ...x, pontos: p.pontos[x.id], posicao: pos[x.id], subiu: (p.posicaoAnterior[x.id] ?? pos[x.id]) - pos[x.id], sequencia: p.sequencias[x.id] }))
    .sort((a, b) => a.posicao - b.posicao || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function mostrarRanking(p) {
  if (p.fase !== FASES.REVELACAO) return p;
  return { ...p, fase: p.ranking === 'oculto' ? p.fase : FASES.RANKING };
}

export function podio(p) {
  return ranking(p).filter((x) => x.posicao <= 3);
}

// Resumo para guardar em "resultados" (relatórios na Fase 7).
export function resumo(p, atividade, { data = new Date().toISOString() } = {}) {
  return {
    atividadeId: atividade.id,
    titulo: atividade.titulo,
    modalidade: atividade.modalidade,
    data,
    participantes: ranking(p).map(({ id, nome, pontos, posicao }) => ({ id, nome, pontos, posicao })),
    perguntas: p.perguntas.map((q) => ({
      id: q.id,
      enunciado: q.enunciado,
      tipo: q.tipo,
      respostas: Object.fromEntries(Object.entries(p.respostas[q.id] ?? {}).map(([pid, r]) => [pid, { correta: r.correta ?? null, pontos: r.pontos ?? 0, t: r.t }])),
    })),
  };
}
