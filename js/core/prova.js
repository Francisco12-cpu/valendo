// Prova individual: horário de início, limite de tempo, embaralhamento por aluno (fixo:
// a mesma ordem se ele cair e voltar) e tempo extra individual. Lógica pura.
import { corrigir, tipoDe } from './questions/index.js';
import { embaralhar } from './teams.js';
import { rngDeSemente } from './aleatorio.js';

export const STATUS_ALUNO = Object.freeze({ AGUARDANDO: 'aguardando', FAZENDO: 'fazendo', ENTREGUE: 'entregue', ENCERRADA: 'encerrada' });

// inicioEm: horário (relógio do host) em que a prova abre; duracaoMs: limite de tempo.
export function criarProva(atividade, { duracaoMs = 50 * 60000, inicioEm = 0, embaralharPerguntas = true, embaralharOpcoes = true } = {}) {
  return {
    atividadeId: atividade.id,
    titulo: atividade.titulo,
    perguntas: atividade.conteudo.perguntas.map((q) => structuredClone(q)),
    duracaoMs,
    inicioEm,
    embaralharPerguntas,
    embaralharOpcoes,
    alunos: {}, // pid → { extraMs, respostas: { qid: { resposta, t } }, entregueEm, encerrada }
    correcoes: {}, // `${pid}|${qid}` → boolean
    comentarios: {}, // pid → texto
    encerradaEm: null,
  };
}

export function entrarNaProva(p, pid) {
  if (p.alunos[pid]) return p;
  return { ...p, alunos: { ...p.alunos, [pid]: { extraMs: 0, respostas: {}, entregueEm: null, encerrada: false } } };
}

export const prazoDe = (p, pid) => p.inicioEm + p.duracaoMs + (p.alunos[pid]?.extraMs ?? 0);

export function statusDe(p, pid, t) {
  const a = p.alunos[pid];
  if (!a) return null;
  if (a.entregueEm !== null) return STATUS_ALUNO.ENTREGUE;
  if (a.encerrada || p.encerradaEm !== null || t >= prazoDe(p, pid)) return STATUS_ALUNO.ENCERRADA;
  if (t < p.inicioEm) return STATUS_ALUNO.AGUARDANDO;
  return STATUS_ALUNO.FAZENDO;
}

export function darTempoExtra(p, pid, ms) {
  const a = p.alunos[pid];
  if (!a) return p;
  return { ...p, alunos: { ...p.alunos, [pid]: { ...a, extraMs: Math.max(0, a.extraMs + ms), encerrada: false } } };
}

// Ordem própria de cada aluno (sempre a mesma para o mesmo aluno).
export function perguntasDoAluno(p, pid) {
  const rng = rngDeSemente(`${p.atividadeId}|${pid}`);
  let lista = p.embaralharPerguntas ? embaralhar(p.perguntas, rng) : [...p.perguntas];
  if (p.embaralharOpcoes) lista = lista.map((q) => (Array.isArray(q.opcoes) ? { ...q, opcoes: embaralhar(q.opcoes, rng) } : q));
  return lista;
}

export function responderProva(p, pid, qid, resposta, t) {
  if (statusDe(p, pid, t) !== STATUS_ALUNO.FAZENDO) return { p, ok: false, motivo: statusDe(p, pid, t) ?? 'desconhecido' };
  if (!p.perguntas.some((q) => q.id === qid)) return { p, ok: false, motivo: 'pergunta-desconhecida' };
  const a = p.alunos[pid];
  return { p: { ...p, alunos: { ...p.alunos, [pid]: { ...a, respostas: { ...a.respostas, [qid]: { resposta, t } } } } }, ok: true };
}

export function entregar(p, pid, t) {
  if (statusDe(p, pid, t) !== STATUS_ALUNO.FAZENDO) return p;
  return { ...p, alunos: { ...p.alunos, [pid]: { ...p.alunos[pid], entregueEm: t } } };
}

export function encerrarTodos(p, t) {
  return { ...p, encerradaEm: t };
}

export const corrigirManualProva = (p, pid, qid, correta) => {
  const correcoes = { ...p.correcoes };
  if (correta === null) delete correcoes[`${pid}|${qid}`];
  else correcoes[`${pid}|${qid}`] = Boolean(correta);
  return { ...p, correcoes };
};

export const comentarProva = (p, pid, texto) => ({ ...p, comentarios: { ...p.comentarios, [pid]: String(texto ?? '').slice(0, 1000) } });

// Grade aluno × questão (em branco = sem resposta quando a prova travou).
export function gradeProva(p, nomes = {}) {
  const avaliaveis = p.perguntas.filter((q) => tipoDe(q)?.temResposta);
  return Object.entries(p.alunos).map(([pid, a]) => {
    const questoes = avaliaveis.map((q) => {
      const dada = a.respostas[q.id];
      const manual = p.correcoes[`${pid}|${q.id}`];
      const auto = dada && dada.resposta !== null && dada.resposta !== '' ? corrigir(q, dada.resposta).correta : false;
      const correta = manual ?? auto;
      return { qid: q.id, enunciado: q.enunciado, resposta: dada?.resposta ?? null, emBranco: !dada, auto, manual: manual ?? null, correta, pontos: correta ? q.pontos ?? 1 : 0 };
    });
    return {
      pid,
      nome: nomes[pid] ?? pid,
      extraMs: a.extraMs,
      entregue: a.entregueEm !== null,
      acertos: questoes.filter((x) => x.correta).length,
      total: questoes.length,
      emBranco: questoes.filter((x) => x.emBranco).length,
      pontos: questoes.reduce((s, x) => s + x.pontos, 0),
      comentario: p.comentarios[pid] ?? '',
      questoes,
    };
  });
}

// O que o aluno recebe: perguntas na ordem dele, sem gabarito, e o que ele já respondeu.
export function paraAlunoProva(p, pid, t, semGabarito) {
  const a = p.alunos[pid];
  if (!a) return { tipo: 'prova', aguardando: true };
  const status = statusDe(p, pid, t);
  const base = { tipo: 'prova', titulo: p.titulo, status, inicioEmMs: Math.max(0, p.inicioEm - t), restaMs: Math.max(0, prazoDe(p, pid) - t), extraMs: a.extraMs };
  if (status === STATUS_ALUNO.AGUARDANDO) return base;
  return {
    ...base,
    perguntas: perguntasDoAluno(p, pid).map(semGabarito),
    respostas: Object.fromEntries(Object.entries(a.respostas).map(([qid, r]) => [qid, r.resposta])),
  };
}
