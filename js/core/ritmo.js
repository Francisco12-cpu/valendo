// Quiz "no seu ritmo": cada aluno avança pelas perguntas no próprio celular.
// O host corrige e só devolve o gabarito daquela pergunta depois que o aluno respondeu.
import { corrigir, tipoDe } from './questions/index.js';
import { embaralhar } from './teams.js';
import { calcularPontos, perguntaSemGabarito } from './quiz.js';

export function criarRitmo(atividade, { rng = Math.random } = {}) {
  let perguntas = atividade.conteudo.perguntas.map((q) => structuredClone(q));
  if (atividade.regras.embaralharPerguntas) perguntas = embaralhar(perguntas, rng);
  if (atividade.regras.embaralharOpcoes) perguntas = perguntas.map((q) => (Array.isArray(q.opcoes) ? { ...q, opcoes: embaralhar(q.opcoes, rng) } : q));
  return { perguntas, regras: structuredClone(atividade.regras), alunos: {}, encerrado: false };
}

const aluno0 = (t) => ({ indice: 0, inicio: t, respostas: {}, pontos: 0, sequencia: 0, ultimo: null });

export function entrarNoRitmo(r, pid, t) {
  if (r.alunos[pid]) return r; // reconexão: continua de onde parou
  return { ...r, alunos: { ...r.alunos, [pid]: aluno0(t) } };
}

export function responderNoRitmo(r, pid, qid, resposta, t) {
  const a = r.alunos[pid];
  if (r.encerrado || !a) return r;
  const q = r.perguntas[a.indice];
  if (!q || q.id !== qid || a.respostas[qid]) return r; // fora de ordem ou repetida
  const temResposta = tipoDe(q)?.temResposta;
  const correta = temResposta ? corrigir(q, resposta).correta === true : null;
  const sequencia = correta ? a.sequencia + 1 : correta === false ? 0 : a.sequencia;
  const pontos = correta ? calcularPontos(r, q, t - a.inicio, sequencia) : correta === false && r.regras.pontuacao.erroTira ? -r.regras.pontuacao.erroTira : 0;
  const ultimo = { qid, correta, pontos, gabarito: temResposta ? corrigir(q, resposta).gabarito : null, explicacao: r.regras.mostrarExplicacao ? q.explicacao : '' };
  const novo = { ...a, indice: a.indice + 1, inicio: t, sequencia, pontos: a.pontos + pontos, respostas: { ...a.respostas, [qid]: { resposta, correta, pontos, t: t - a.inicio } }, ultimo };
  return { ...r, alunos: { ...r.alunos, [pid]: novo } };
}

export function encerrarRitmo(r) {
  return { ...r, encerrado: true };
}

export function progresso(r) {
  return Object.entries(r.alunos).map(([pid, a]) => ({ pid, respondidas: Object.keys(a.respostas).length, total: r.perguntas.length, pontos: a.pontos, terminou: a.indice >= r.perguntas.length }));
}

export function paraAlunoRitmo(r, pid) {
  const a = r.alunos[pid];
  if (!a) return { tipo: 'ritmo', aguardando: true };
  const terminou = a.indice >= r.perguntas.length || r.encerrado;
  return {
    tipo: 'ritmo',
    indice: a.indice,
    total: r.perguntas.length,
    meusPontos: a.pontos,
    terminou,
    pergunta: terminou ? null : perguntaSemGabarito(r.perguntas[a.indice]),
    ultimo: a.ultimo,
  };
}
