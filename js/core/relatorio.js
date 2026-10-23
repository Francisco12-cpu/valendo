// Relatórios: acertos por questão, desempenho por participante e questões mais erradas,
// a partir dos resultados salvos (quiz, Passa ou Repassa, prova, espiral). Lógica pura.
import { criarAtividade } from './activity.js';

// Deixa todo tipo de resultado no mesmo formato:
// { titulo, data, modalidade, participantes: [{ id, nome, pontos }], perguntas: [{ id, enunciado, respostas: { pid: true|false|null } }] }
export function normalizarResultado(r) {
  const base = { id: r.id, titulo: r.titulo, data: r.data, modalidade: r.modalidade, atividadeId: r.atividadeId ?? null };
  if (Array.isArray(r.perguntas)) {
    return {
      ...base,
      participantes: (r.participantes ?? []).map((p) => ({ id: p.id, nome: p.nome, pontos: p.pontos ?? 0 })),
      perguntas: r.perguntas.map((q) => ({ id: q.id, enunciado: q.enunciado, respostas: Object.fromEntries(Object.entries(q.respostas ?? {}).map(([pid, x]) => [pid, x.correta ?? null])) })),
    };
  }
  if (Array.isArray(r.grade)) {
    // Prova (aluno) ou espiral (grupo): cada linha tem células com as questões.
    const perguntas = new Map();
    const participantes = r.grade.map((l) => {
      const id = l.pid ?? l.grupo;
      const celulas = l.celulas ?? [l];
      for (const c of celulas) {
        for (const q of c.questoes) {
          const chave = c.prova ? `${c.prova}:${q.qid}` : q.qid;
          if (!perguntas.has(chave)) perguntas.set(chave, { id: chave, enunciado: q.enunciado, respostas: {} });
          perguntas.get(chave).respostas[id] = q.emBranco ? false : q.correta;
        }
      }
      return { id, nome: l.nome, pontos: l.pontos ?? 0 };
    });
    return { ...base, participantes, perguntas: [...perguntas.values()] };
  }
  if (Array.isArray(r.historico)) {
    // Passa ou Repassa: cada pergunta foi respondida por uma equipe.
    const perguntas = r.historico.map((hst, i) => ({ id: hst.pergunta ?? `p${i + 1}`, enunciado: hst.enunciado ?? `Pergunta ${i + 1}`, respostas: { [hst.equipe]: hst.correta } }));
    return { ...base, participantes: (r.participantes ?? []).map((p) => ({ id: p.id, nome: p.nome, pontos: p.pontos ?? 0 })), perguntas };
  }
  return { ...base, participantes: [], perguntas: [] };
}

export function acertosPorQuestao(n) {
  return n.perguntas.map((q) => {
    const valores = Object.values(q.respostas).filter((v) => v !== null && v !== undefined);
    const certas = valores.filter(Boolean).length;
    return { id: q.id, enunciado: q.enunciado, certas, total: valores.length, taxa: valores.length ? certas / valores.length : null };
  });
}

export function desempenho(n) {
  return n.participantes
    .map((p) => {
      const valores = n.perguntas.map((q) => q.respostas[p.id]).filter((v) => v !== null && v !== undefined);
      const certas = valores.filter(Boolean).length;
      return { id: p.id, nome: p.nome, pontos: p.pontos, certas, total: valores.length, taxa: valores.length ? certas / valores.length : null };
    })
    .sort((a, b) => (b.taxa ?? -1) - (a.taxa ?? -1) || b.pontos - a.pontos);
}

// As mais erradas primeiro (só as que tiveram resposta e não foram 100%).
export function maisErradas(n, limite = 5) {
  return acertosPorQuestao(n)
    .filter((q) => q.taxa !== null && q.taxa < 1)
    .sort((a, b) => a.taxa - b.taxa || b.total - a.total)
    .slice(0, limite);
}

export function resumoGeral(n) {
  const qs = acertosPorQuestao(n).filter((q) => q.taxa !== null);
  const certas = qs.reduce((s, q) => s + q.certas, 0);
  const total = qs.reduce((s, q) => s + q.total, 0);
  return { participantes: n.participantes.length, perguntas: n.perguntas.length, taxa: total ? certas / total : null };
}

// "Refazer as erradas": nova atividade só com as questões abaixo do limite de acerto.
export function refazerErradas(atividade, n, { limite = 0.6, titulo } = {}) {
  const fracas = new Set(acertosPorQuestao(n).filter((q) => q.taxa !== null && q.taxa < limite).map((q) => String(q.id).split(':').pop()));
  const nova = criarAtividade({ titulo: titulo ?? `${atividade.titulo} — refazer as erradas`, modalidade: atividade.modalidade === 'espiral' ? 'quiz' : atividade.modalidade });
  nova.disciplina = atividade.disciplina;
  nova.tags = [...new Set([...(atividade.tags ?? []), 'revisão'])];
  nova.regras = structuredClone(atividade.regras);
  nova.conteudo.perguntas = atividade.conteudo.perguntas.filter((q) => fracas.has(q.id)).map((q) => structuredClone(q));
  return nova;
}
