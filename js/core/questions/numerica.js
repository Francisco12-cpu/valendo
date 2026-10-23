// Resposta numérica, com tolerância (para mais ou para menos) e unidade opcional.
import { baseQuestao, validarBase, lerNumero } from './base.js';

export const tipo = 'numerica';
export const temResposta = true;

export function novo() {
  return baseQuestao(tipo, { valor: 0, tolerancia: 0, unidade: '' });
}

export function validar(q) {
  const erros = validarBase(q);
  if (!Number.isFinite(q.valor)) erros.push('valor correto inválido');
  if (!Number.isFinite(q.tolerancia) || q.tolerancia < 0) erros.push('tolerância inválida');
  return erros;
}

export function corrigir(q, resposta) {
  // Aceita "9,8 m/s²" quando a unidade é "m/s²".
  let texto = String(resposta ?? '').trim();
  if (q.unidade && texto.toLowerCase().endsWith(q.unidade.toLowerCase())) texto = texto.slice(0, -q.unidade.length);
  const n = lerNumero(texto);
  // Pequena folga para erros de ponto flutuante (0.1 + 0.2).
  const correta = Number.isFinite(n) && Math.abs(n - q.valor) <= q.tolerancia + 1e-9;
  return { correta, gabarito: q.valor };
}
