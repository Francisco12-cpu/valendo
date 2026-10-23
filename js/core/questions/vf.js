// Verdadeiro ou falso. Resposta = true | false.
import { baseQuestao, validarBase } from './base.js';

export const tipo = 'vf';
export const temResposta = true;

export function novo() {
  return baseQuestao(tipo, { correta: true });
}

export function validar(q) {
  const erros = validarBase(q);
  if (typeof q.correta !== 'boolean') erros.push('defina se é verdadeiro ou falso');
  return erros;
}

export function corrigir(q, resposta) {
  return { correta: resposta === q.correta, gabarito: q.correta };
}
