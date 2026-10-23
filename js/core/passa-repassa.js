// Passa ou Repassa: a equipe da vez responde ou passa; quem recebeu responde ou repassa
// (uma vez só) e quem passou é obrigado a responder. Pontos configuráveis e "torta" no erro.
// Puro: o professor julga (acertou/errou) ou toca na opção dita, e o núcleo calcula.
import { corrigir } from './questions/index.js';

export const ETAPAS = Object.freeze({ VEZ: 'vez', PASSOU: 'passou', REPASSOU: 'repassou', RESULTADO: 'resultado', FIM: 'fim' });

export function criarJogo(atividade, equipes) {
  if (!equipes || equipes.length < 2) throw new RangeError('Passa ou Repassa precisa de pelo menos 2 equipes.');
  return {
    perguntas: atividade.conteudo.perguntas.filter((q) => q.tipo !== 'slide' && q.tipo !== 'enquete').map((q) => structuredClone(q)),
    equipes: equipes.map((e) => ({ id: e.id, nome: e.nome, cor: e.cor ?? null })),
    regras: { ...atividade.regras.pontuacao.passaRepassa },
    pontos: Object.fromEntries(equipes.map((e) => [e.id, 0])),
    tortas: Object.fromEntries(equipes.map((e) => [e.id, 0])),
    indice: 0,
    etapa: ETAPAS.VEZ,
    daVez: equipes[0].id, // começa com a 1ª; depois alterna
    quemPassou: null,
    respondendo: equipes[0].id,
    ultimo: null, // { equipe, correta, pontos, torta, etapa }
    historico: [],
  };
}

const proximaEquipe = (j, id) => j.equipes[(j.equipes.findIndex((e) => e.id === id) + 1) % j.equipes.length].id;
export const perguntaAtual = (j) => j.perguntas[j.indice] ?? null;

// A equipe da vez passa a pergunta para a próxima.
export function passar(j) {
  if (j.etapa !== ETAPAS.VEZ) return j;
  return { ...j, etapa: ETAPAS.PASSOU, quemPassou: j.daVez, respondendo: proximaEquipe(j, j.daVez) };
}

// Quem recebeu devolve: quem passou tem que responder.
export function repassar(j) {
  if (j.etapa !== ETAPAS.PASSOU) return j;
  return { ...j, etapa: ETAPAS.REPASSOU, respondendo: j.quemPassou };
}

// julgamento: { correta: boolean } (oral) ou { resposta } (o professor toca na opção dita).
export function julgar(j, julgamento) {
  if (![ETAPAS.VEZ, ETAPAS.PASSOU, ETAPAS.REPASSOU].includes(j.etapa)) return j;
  const q = perguntaAtual(j);
  const correta = 'resposta' in julgamento ? corrigir(q, julgamento.resposta).correta === true : Boolean(julgamento.correta);
  const r = j.regras;
  let pontos = 0;
  if (j.etapa === ETAPAS.REPASSOU) pontos = correta ? r.repassa : r.erroRepassa;
  else pontos = correta ? r.acerto : 0;
  const torta = !correta && r.torta;
  const equipe = j.respondendo;
  const ultimo = { equipe, correta, pontos, torta, etapa: j.etapa, pergunta: q.id };
  return {
    ...j,
    etapa: ETAPAS.RESULTADO,
    pontos: { ...j.pontos, [equipe]: j.pontos[equipe] + pontos },
    tortas: { ...j.tortas, [equipe]: j.tortas[equipe] + (torta ? 1 : 0) },
    ultimo,
    historico: [...j.historico, ultimo],
  };
}

export function proxima(j) {
  if (j.etapa !== ETAPAS.RESULTADO) return j;
  const indice = j.indice + 1;
  if (indice >= j.perguntas.length) return { ...j, etapa: ETAPAS.FIM };
  const daVez = proximaEquipe(j, j.daVez);
  return { ...j, indice, etapa: ETAPAS.VEZ, daVez, respondendo: daVez, quemPassou: null, ultimo: null };
}

export function placarFinal(j) {
  const ordem = [...j.equipes].sort((a, b) => j.pontos[b.id] - j.pontos[a.id]);
  return ordem.map((e) => ({ ...e, pontos: j.pontos[e.id], tortas: j.tortas[e.id], posicao: ordem.findIndex((x) => j.pontos[x.id] === j.pontos[e.id]) + 1 }));
}
