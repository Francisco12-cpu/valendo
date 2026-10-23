// Resposta curta, com variações aceitas. Ignora acentos, maiúsculas e espaços extras.
import { baseQuestao, validarBase, normalizarTexto } from './base.js';

export const tipo = 'curta';
export const temResposta = true;

export function novo() {
  return baseQuestao(tipo, { aceitas: [''] });
}

export function validar(q) {
  const erros = validarBase(q);
  if (!Array.isArray(q.aceitas) || !q.aceitas.some((a) => String(a ?? '').trim())) erros.push('informe pelo menos uma resposta aceita');
  return erros;
}

export function corrigir(q, resposta) {
  const dada = normalizarTexto(resposta);
  const aceitas = q.aceitas.map(normalizarTexto).filter(Boolean);
  return { correta: Boolean(dada) && aceitas.includes(dada), gabarito: q.aceitas.filter((a) => String(a).trim()) };
}
