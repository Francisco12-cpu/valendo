// Atividade (§8): schema, validação, migração de versão, duplicação e busca. Lógica pura.
// Regra de ouro dos dados: versões novas do app NUNCA podem quebrar atividades antigas.
// Cada mudança de formato ganha uma função em MIGRACOES (n → n+1) e um teste.
import { novoId, idCurto } from './ids.js';
import { validarQuestao, tipoDe } from './questions/index.js';
import { baseQuestao } from './questions/base.js';

export const SCHEMA_ATUAL = 1;
export const MODALIDADES = ['quiz', 'passa-repassa', 'buzzer', 'prova', 'espiral', 'personalizada'];
export const DIFICULDADES = ['facil', 'media', 'dificil'];
export const NIVEIS_CONFIG = ['basica', 'avancada', 'personalizada'];
export const RANKINGS = ['completo', 'top5', 'oculto'];

export function regrasPadrao(modalidade = 'quiz') {
  return {
    pontuacao: {
      porAcerto: 1000,
      velocidade: modalidade === 'quiz', // mais rápido ganha mais pontos
      sequencia: false, // bônus por acertos seguidos
      erroTira: 0, // pontos tirados por erro
      passaRepassa: { acerto: 2, repassa: 1, erroRepassa: -1, torta: true },
    },
    tempo: { porPergunta: modalidade === 'prova' ? 0 : 20, total: modalidade === 'prova' ? 50 : 0 },
    embaralharPerguntas: false,
    embaralharOpcoes: false,
    mostrarExplicacao: true,
    fimDoTempo: 'travar-e-salvar',
  };
}

export function criarAtividade({ titulo = 'Nova atividade', modalidade = 'quiz', id = novoId('atv'), agora = new Date().toISOString() } = {}) {
  return {
    schema: SCHEMA_ATUAL,
    id,
    titulo,
    modalidade: MODALIDADES.includes(modalidade) ? modalidade : 'quiz',
    disciplina: '',
    dificuldade: 'media',
    tags: [],
    favorita: false,
    nivelConfig: 'basica',
    blocos: {},
    conteudo: { perguntas: [] },
    regras: regrasPadrao(modalidade),
    exibicao: { pergunta: 'projetor+alunos', ranking: 'top5' },
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

// Preenche campos que faltarem com os padrões (útil para arquivos editados à mão).
export function completar(a) {
  const base = criarAtividade({ titulo: a.titulo, modalidade: a.modalidade, id: a.id || novoId('atv'), agora: a.criadoEm || new Date().toISOString() });
  const padrao = regrasPadrao(base.modalidade);
  const regras = a.regras ?? {};
  const perguntas = Array.isArray(a.conteudo?.perguntas) ? a.conteudo.perguntas : [];
  const ids = [];
  return {
    ...base,
    ...a,
    id: a.id || base.id,
    titulo: typeof a.titulo === 'string' && a.titulo.trim() ? a.titulo : base.titulo,
    modalidade: base.modalidade,
    schema: SCHEMA_ATUAL,
    tags: Array.isArray(a.tags) ? a.tags.map(String) : [],
    favorita: a.favorita === true,
    nivelConfig: NIVEIS_CONFIG.includes(a.nivelConfig) ? a.nivelConfig : 'basica',
    dificuldade: DIFICULDADES.includes(a.dificuldade) ? a.dificuldade : 'media',
    conteudo: {
      ...a.conteudo,
      perguntas: perguntas.map((q) => {
        const tipo = tipoDe(q) ? q.tipo : 'slide';
        const id = q.id && !ids.includes(q.id) ? q.id : idCurto(ids, 'q');
        ids.push(id);
        return { ...baseQuestao(tipo), ...tipoDe({ tipo }).novo(), ...q, tipo, id, tags: Array.isArray(q.tags) ? q.tags : [] };
      }),
    },
    regras: {
      ...padrao,
      ...regras,
      pontuacao: { ...padrao.pontuacao, ...regras.pontuacao, passaRepassa: { ...padrao.pontuacao.passaRepassa, ...regras.pontuacao?.passaRepassa } },
      tempo: { ...padrao.tempo, ...regras.tempo },
    },
    exibicao: { ...base.exibicao, ...a.exibicao },
    atualizadoEm: a.atualizadoEm || base.atualizadoEm,
  };
}

export function validar(a) {
  const erros = [];
  if (!a || typeof a !== 'object') return { ok: false, erros: ['arquivo não é uma atividade'] };
  if (a.schema !== SCHEMA_ATUAL) erros.push(`schema ${a.schema} (esperado ${SCHEMA_ATUAL})`);
  if (!a.id) erros.push('sem id');
  if (typeof a.titulo !== 'string' || !a.titulo.trim()) erros.push('sem título');
  if (!MODALIDADES.includes(a.modalidade)) erros.push(`modalidade desconhecida: ${a.modalidade}`);
  if (!Array.isArray(a.conteudo?.perguntas)) erros.push('sem lista de perguntas');
  else {
    a.conteudo.perguntas.forEach((q, i) => {
      for (const erro of validarQuestao(q)) erros.push(`pergunta ${i + 1}: ${erro}`);
    });
    if (new Set(a.conteudo.perguntas.map((q) => q.id)).size !== a.conteudo.perguntas.length) erros.push('perguntas com id repetido');
  }
  return { ok: erros.length === 0, erros };
}

// ---------- Migrações ----------
// Formato "0": rascunho antigo, antes do schema (nome/questoes/alternativas/certa).
function de0para1(antiga) {
  const perguntas = (antiga.questoes ?? []).map((q, i) => {
    const alternativas = q.alternativas ?? [];
    const base = { id: `q${i + 1}`, enunciado: q.pergunta ?? q.enunciado ?? '', tempo: q.tempo ?? 20, pontos: q.pontos ?? 1000, explicacao: q.explicacao ?? '', tags: [] };
    if (!alternativas.length) return { ...base, tipo: 'slide', texto: '', pontos: 0 };
    return {
      ...base,
      tipo: 'multipla',
      opcoes: alternativas.map((texto, j) => ({ id: String.fromCharCode(97 + j), texto, correta: j === q.certa })),
    };
  });
  return completar({ titulo: antiga.nome ?? antiga.titulo ?? 'Atividade importada', modalidade: antiga.modalidade ?? 'quiz', id: antiga.id, conteudo: { perguntas } });
}

export const MIGRACOES = { 0: de0para1 };

export function versaoDe(a) {
  return Number.isInteger(a?.schema) ? a.schema : 0;
}

export function migrar(a, { migracoes = MIGRACOES, ate = SCHEMA_ATUAL } = {}) {
  let atual = structuredClone(a);
  let versao = versaoDe(atual);
  if (versao > ate) throw new Error(`Esta atividade foi feita numa versão mais nova do Valendo! (schema ${versao}). Atualize o app.`);
  while (versao < ate) {
    const passo = migracoes[versao];
    if (!passo) throw new Error(`Não sei migrar do schema ${versao}.`);
    atual = passo(atual);
    const nova = versaoDe(atual);
    if (nova <= versao) throw new Error(`Migração ${versao} não avançou o schema.`);
    versao = nova;
  }
  return atual;
}

// Abre qualquer atividade (antiga ou atual) já pronta para usar.
export function abrir(a) {
  const migrada = migrar(a);
  return completar(migrada);
}

// ---------- Ações ----------
export function duplicar(a, { titulo, agora = new Date().toISOString() } = {}) {
  return { ...structuredClone(a), id: novoId('atv'), titulo: titulo ?? `${a.titulo} (cópia)`, favorita: false, criadoEm: agora, atualizadoEm: agora };
}

export function buscar(atividades, { texto = '', tag = '', disciplina = '', dificuldade = '', favoritas = false } = {}) {
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const termo = norm(texto).trim();
  return atividades
    .filter((a) => !favoritas || a.favorita)
    .filter((a) => !disciplina || norm(a.disciplina) === norm(disciplina))
    .filter((a) => !dificuldade || a.dificuldade === dificuldade)
    .filter((a) => !tag || a.tags.some((t) => norm(t) === norm(tag)) || a.conteudo.perguntas.some((q) => q.tags.some((t) => norm(t) === norm(tag))))
    .filter((a) => {
      if (!termo) return true;
      const tudo = [a.titulo, a.disciplina, ...a.tags, ...a.conteudo.perguntas.map((q) => q.enunciado)].map(norm).join(' ');
      return termo.split(/\s+/).every((p) => tudo.includes(p));
    })
    .sort((x, y) => (y.favorita - x.favorita) || String(y.atualizadoEm).localeCompare(String(x.atualizadoEm)));
}

export function todasAsTags(atividades) {
  const tags = new Set();
  for (const a of atividades) {
    a.tags.forEach((t) => tags.add(t));
    a.conteudo.perguntas.forEach((q) => q.tags.forEach((t) => tags.add(t)));
  }
  return [...tags].sort((x, y) => x.localeCompare(y, 'pt-BR'));
}

export function todasAsDisciplinas(atividades) {
  return [...new Set(atividades.map((a) => a.disciplina).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'pt-BR'));
}
