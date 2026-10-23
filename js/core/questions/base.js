// Campos comuns a todas as questões (§8) e utilidades de correção.

export const PONTOS_PADRAO = 1000;
export const TEMPO_PADRAO = 20;

export function baseQuestao(tipo, extra = {}) {
  return {
    id: '',
    tipo,
    enunciado: '',
    midia: null,
    pontos: PONTOS_PADRAO,
    tempo: TEMPO_PADRAO,
    explicacao: '',
    tags: [],
    ...extra,
  };
}

export function validarBase(q) {
  const erros = [];
  if (!q || typeof q !== 'object') return ['questão inválida'];
  if (typeof q.enunciado !== 'string' || !q.enunciado.trim()) erros.push('enunciado vazio');
  if (!Number.isFinite(q.pontos) || q.pontos < 0) erros.push('pontos inválidos');
  if (!Number.isFinite(q.tempo) || q.tempo < 0) erros.push('tempo inválido');
  if (!Array.isArray(q.tags)) erros.push('tags inválidas');
  return erros;
}

// "  Mitocôndria " → "mitocondria" (sem acento, minúsculas, espaços únicos).
export function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// "3,14" → 3.14; "1.234,5" → 1234.5; "1e3" → 1000; inválido → NaN.
export function lerNumero(valor) {
  if (typeof valor === 'number') return valor;
  let s = String(valor ?? '').trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? Number(s) : NaN;
}
