// Enquete: opções sem resposta certa (opinião). Não pontua.
import { baseQuestao, validarBase } from './base.js';

export const tipo = 'enquete';
export const temResposta = false;

export function novo() {
  return baseQuestao(tipo, {
    pontos: 0,
    opcoes: [
      { id: 'a', texto: '' },
      { id: 'b', texto: '' },
    ],
  });
}

export function validar(q) {
  const erros = validarBase(q);
  if (!Array.isArray(q.opcoes) || q.opcoes.length < 2) erros.push('precisa de pelo menos 2 opções');
  else if (q.opcoes.some((o) => !String(o.texto ?? '').trim())) erros.push('opção sem texto');
  return erros;
}

export function corrigir() {
  return { correta: null, gabarito: null };
}
