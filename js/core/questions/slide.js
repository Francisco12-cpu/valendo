// "Slide": só texto/imagem para mostrar (explicação, abertura de tema). Sem resposta.
import { baseQuestao, validarBase } from './base.js';

export const tipo = 'slide';
export const temResposta = false;

export function novo() {
  return baseQuestao(tipo, { pontos: 0, tempo: 0, texto: '' });
}

export function validar(q) {
  return validarBase(q);
}

export function corrigir() {
  return { correta: null, gabarito: null };
}
