// Prova em Espiral (rotação): N grupos × M provas. Lógica pura; o tempo vem de fora.
//
// Círculo de S = max(N, M) posições: as M primeiras são provas, as demais são "pausa".
// Na rodada r, o grupo g está na posição (g + sentido·r) mod S. Em S rodadas cada grupo
// passa uma vez por cada prova (e descansa S − M vezes quando há mais grupos que provas).
//
// "A prova anda, o grupo fica": o aparelho é do grupo e o conteúdo troca a cada rodada.
// "O grupo anda": o aparelho é da estação (prova) e quem chega nela muda.
// Fim do tempo: trava, salva e marca em branco o que ficou sem resposta.
import { corrigir, tipoDe } from './questions/index.js';
import { perguntaSemGabarito } from './quiz.js';

export const STATUS = Object.freeze({ PREPARANDO: 'preparando', RODANDO: 'rodando', PAUSADO: 'pausado', TROCA: 'troca', FIM: 'fim' });

// provas: [{ id, titulo, perguntas: [...], tempoMs? }]; grupos: [{ id, nome }]
export function criarRotacao({ grupos, provas, tempoRodadaMs = 5 * 60000, tempoPorProva = false, sentido = 1, avisoMs = 30000 }) {
  if (!grupos?.length || !provas?.length) throw new RangeError('Precisa de pelo menos 1 grupo e 1 prova.');
  return {
    grupos: grupos.map((g) => ({ id: g.id, nome: g.nome })),
    provas: provas.map((p) => ({ id: p.id, titulo: p.titulo, perguntas: structuredClone(p.perguntas), tempoMs: p.tempoMs ?? null })),
    posicoes: Math.max(grupos.length, provas.length),
    sentido: sentido === -1 ? -1 : 1,
    tempoRodadaMs,
    tempoPorProva,
    avisoMs,
    rodada: 0,
    status: STATUS.PREPARANDO,
    inicio: null, // quando a rodada atual começou (relógio do host)
    pausadoEm: null,
    pausaAcumulada: 0,
    prorrogacaoMs: 0,
    respostas: {}, // grupo → prova → qid → { resposta, t }
    travados: {}, // `${grupo}|${prova}` → true
    correcoes: {}, // `${grupo}|${prova}|${qid}` → true/false (correção manual)
    comentarios: {}, // `${grupo}|${prova}` → texto
    log: [],
  };
}

export const totalRodadas = (r) => r.posicoes;
const mod = (a, n) => ((a % n) + n) % n;

// Em que prova está cada grupo na rodada (null = pausa).
export function atribuicao(r, rodada = r.rodada) {
  const mapa = {};
  r.grupos.forEach((g, i) => {
    const pos = mod(i + r.sentido * rodada, r.posicoes);
    mapa[g.id] = pos < r.provas.length ? r.provas[pos].id : null;
  });
  return mapa;
}

// Quem está em cada estação (prova) na rodada (null = ninguém) — modo "o grupo anda".
export function grupoNaProva(r, provaId, rodada = r.rodada) {
  const mapa = atribuicao(r, rodada);
  return Object.keys(mapa).find((g) => mapa[g] === provaId) ?? null;
}

const provaPorId = (r, id) => r.provas.find((p) => p.id === id);

export function duracaoDe(r, provaId) {
  const prova = provaPorId(r, provaId);
  return (r.tempoPorProva && prova?.tempoMs ? prova.tempoMs : r.tempoRodadaMs) + r.prorrogacaoMs;
}

const decorrido = (r, t) => (r.inicio === null ? 0 : (r.pausadoEm ?? t) - r.inicio - r.pausaAcumulada);

// Tempo que falta para o grupo (cada um tem o prazo da sua prova).
export function restanteGrupo(r, grupoId, t) {
  const prova = atribuicao(r)[grupoId];
  if (!prova || r.status === STATUS.PREPARANDO) return null;
  return Math.max(0, duracaoDe(r, prova) - decorrido(r, t));
}

// A rodada dura o tempo da prova mais longa entre as ativas.
export function restanteRodada(r, t) {
  if (r.status === STATUS.PREPARANDO || r.status === STATUS.FIM) return null;
  const ativas = Object.values(atribuicao(r)).filter(Boolean);
  return Math.max(0, ...ativas.map((p) => duracaoDe(r, p) - decorrido(r, t)));
}

export const emAviso = (r, t) => r.status === STATUS.RODANDO && restanteRodada(r, t) <= r.avisoMs && restanteRodada(r, t) > 0;

function registrar(r, evento, t) {
  return { ...r, log: [...r.log, { t, rodada: r.rodada, ...evento }].slice(-1000) };
}

export function iniciar(r, t) {
  if (r.status !== STATUS.PREPARANDO && r.status !== STATUS.TROCA) return r;
  return registrar({ ...r, status: STATUS.RODANDO, inicio: t, pausadoEm: null, pausaAcumulada: 0, prorrogacaoMs: 0 }, { tipo: 'inicio' }, t);
}

export function pausar(r, t) {
  if (r.status !== STATUS.RODANDO) return r;
  return registrar({ ...r, status: STATUS.PAUSADO, pausadoEm: t }, { tipo: 'pausa' }, t);
}

export function retomar(r, t) {
  if (r.status !== STATUS.PAUSADO) return r;
  return registrar({ ...r, status: STATUS.RODANDO, pausaAcumulada: r.pausaAcumulada + (t - r.pausadoEm), pausadoEm: null }, { tipo: 'retomada' }, t);
}

export function prorrogar(r, ms, t) {
  if (r.status !== STATUS.RODANDO && r.status !== STATUS.PAUSADO) return r;
  // Prorrogar destrava quem já tinha travado nesta rodada (o tempo voltou a existir).
  const travados = { ...r.travados };
  for (const [g, p] of Object.entries(atribuicao(r))) if (p) delete travados[`${g}|${p}`];
  return registrar({ ...r, prorrogacaoMs: r.prorrogacaoMs + ms, travados }, { tipo: 'prorrogacao', ms }, t);
}

// Trava quem passou do prazo (marca em branco o que ficou sem resposta).
export function verificarPrazos(r, t) {
  if (r.status !== STATUS.RODANDO) return r;
  let novo = r;
  for (const [g, p] of Object.entries(atribuicao(r))) {
    if (p && restanteGrupo(r, g, t) <= 0 && !r.travados[`${g}|${p}`]) novo = travar(novo, g, p, t);
  }
  if (restanteRodada(novo, t) <= 0) novo = registrar({ ...novo, status: STATUS.TROCA }, { tipo: 'fim-rodada' }, t);
  return novo;
}

function travar(r, grupoId, provaId, t) {
  const prova = provaPorId(r, provaId);
  const doGrupo = { ...r.respostas[grupoId] };
  const daProva = { ...doGrupo[provaId] };
  for (const q of prova.perguntas) if (!daProva[q.id] && tipoDe(q)?.temResposta) daProva[q.id] = { resposta: null, emBranco: true, t };
  doGrupo[provaId] = daProva;
  return registrar({ ...r, respostas: { ...r.respostas, [grupoId]: doGrupo }, travados: { ...r.travados, [`${grupoId}|${provaId}`]: true } }, { tipo: 'travou', grupo: grupoId, prova: provaId }, t);
}

// Trava todo mundo agora e passa para a próxima rodada (avanço manual) ou termina.
export function avancar(r, t) {
  if (r.status === STATUS.FIM || r.status === STATUS.PREPARANDO) return r;
  let novo = r;
  for (const [g, p] of Object.entries(atribuicao(r))) if (p && !novo.travados[`${g}|${p}`]) novo = travar(novo, g, p, t);
  if (r.rodada + 1 >= totalRodadas(r)) return registrar({ ...novo, status: STATUS.FIM, inicio: null }, { tipo: 'fim' }, t);
  return iniciar({ ...novo, rodada: r.rodada + 1, status: STATUS.TROCA }, t);
}

// Resposta de um grupo: só vale na prova em que ele está agora e antes de travar.
export function responder(r, grupoId, provaId, qid, resposta, t) {
  if (r.status !== STATUS.RODANDO) return { r, ok: false, motivo: r.status === STATUS.PAUSADO ? 'pausado' : 'fora-do-tempo' };
  if (atribuicao(r)[grupoId] !== provaId) return { r, ok: false, motivo: 'prova-errada' };
  if (r.travados[`${grupoId}|${provaId}`] || restanteGrupo(r, grupoId, t) <= 0) return { r, ok: false, motivo: 'travado' };
  const prova = provaPorId(r, provaId);
  if (!prova.perguntas.some((q) => q.id === qid)) return { r, ok: false, motivo: 'pergunta-desconhecida' };
  const doGrupo = { ...r.respostas[grupoId] };
  doGrupo[provaId] = { ...doGrupo[provaId], [qid]: { resposta, t } };
  return { r: { ...r, respostas: { ...r.respostas, [grupoId]: doGrupo } }, ok: true };
}

export function corrigirManual(r, grupoId, provaId, qid, correta) {
  const chave = `${grupoId}|${provaId}|${qid}`;
  const correcoes = { ...r.correcoes };
  if (correta === null) delete correcoes[chave];
  else correcoes[chave] = Boolean(correta);
  return { ...r, correcoes };
}

export function comentar(r, grupoId, provaId, texto) {
  return { ...r, comentarios: { ...r.comentarios, [`${grupoId}|${provaId}`]: String(texto ?? '').slice(0, 1000) } };
}

// Grade final grupo × prova (correção automática + manual por cima).
export function grade(r) {
  return r.grupos.map((g) => {
    const celulas = r.provas.map((p) => {
      const resp = r.respostas[g.id]?.[p.id] ?? {};
      const questoes = p.perguntas.filter((q) => tipoDe(q)?.temResposta).map((q) => {
        const dada = resp[q.id];
        const manual = r.correcoes[`${g.id}|${p.id}|${q.id}`];
        const auto = dada && !dada.emBranco && dada.resposta !== null ? corrigir(q, dada.resposta).correta : false;
        const correta = manual ?? auto;
        return { qid: q.id, enunciado: q.enunciado, resposta: dada?.resposta ?? null, emBranco: !dada || dada.emBranco === true, auto, manual: manual ?? null, correta, pontos: correta ? q.pontos ?? 1 : 0 };
      });
      const visitou = Object.keys(resp).length > 0;
      return {
        prova: p.id,
        visitou,
        acertos: questoes.filter((x) => x.correta).length,
        total: questoes.length,
        emBranco: questoes.filter((x) => x.emBranco).length,
        pontos: questoes.reduce((s, x) => s + x.pontos, 0),
        comentario: r.comentarios[`${g.id}|${p.id}`] ?? '',
        questoes,
      };
    });
    return { grupo: g.id, nome: g.nome, celulas, acertos: celulas.reduce((s, c) => s + c.acertos, 0), total: celulas.reduce((s, c) => s + c.total, 0), pontos: celulas.reduce((s, c) => s + c.pontos, 0) };
  });
}

// O que o aparelho de um grupo recebe ("a prova anda, o grupo fica"): a prova da vez sem
// gabarito, o tempo, as respostas já salvas (para recuperar depois de cair) e a próxima.
export function paraGrupo(r, grupoId, t) {
  const g = r.grupos.find((x) => x.id === grupoId);
  if (!g) return { tipo: 'espiral', espectador: true };
  const provaId = atribuicao(r)[grupoId];
  const prova = provaId ? provaPorId(r, provaId) : null;
  const proxima = r.rodada + 1 < totalRodadas(r) ? atribuicao(r, r.rodada + 1)[grupoId] : undefined;
  return {
    tipo: 'espiral',
    modo: 'grupo',
    status: r.status,
    grupo: g.nome,
    rodada: r.rodada + 1,
    total: totalRodadas(r),
    pausa: !prova,
    prova: prova ? { id: prova.id, titulo: prova.titulo, perguntas: prova.perguntas.map(perguntaSemGabarito) } : null,
    respostas: prova ? Object.fromEntries(Object.entries(r.respostas[grupoId]?.[provaId] ?? {}).map(([qid, x]) => [qid, x.resposta])) : {},
    travado: prova ? Boolean(r.travados[`${grupoId}|${provaId}`]) : false,
    restaMs: restanteGrupo(r, grupoId, t),
    aviso: emAviso(r, t),
    proxima: proxima === undefined ? undefined : proxima ? provaPorId(r, proxima).titulo : null,
  };
}

// "O grupo anda": o aparelho é da estação; quem responde é o grupo que está nela agora.
export function paraEstacao(r, provaId, t) {
  const prova = provaPorId(r, provaId);
  if (!prova) return { tipo: 'espiral', espectador: true };
  const grupoId = grupoNaProva(r, provaId);
  const base = paraGrupo(r, grupoId ?? '__ninguem__', t);
  return {
    ...base,
    tipo: 'espiral',
    modo: 'estacao',
    estacao: prova.titulo,
    grupo: grupoId ? r.grupos.find((g) => g.id === grupoId).nome : null,
    pausa: !grupoId,
    prova: grupoId ? base.prova : { id: prova.id, titulo: prova.titulo, perguntas: [] },
  };
}
