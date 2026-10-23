// Múltipla escolha: uma ou várias corretas. Resposta = lista de ids das opções marcadas.
import { baseQuestao, validarBase } from './base.js';

export const tipo = 'multipla';
export const temResposta = true;

export function novo() {
  return baseQuestao(tipo, {
    opcoes: [
      { id: 'a', texto: '', correta: true },
      { id: 'b', texto: '', correta: false },
      { id: 'c', texto: '', correta: false },
      { id: 'd', texto: '', correta: false },
    ],
  });
}

export function validar(q) {
  const erros = validarBase(q);
  if (!Array.isArray(q.opcoes) || q.opcoes.length < 2) erros.push('precisa de pelo menos 2 opções');
  else {
    if (q.opcoes.some((o) => !String(o.texto ?? '').trim())) erros.push('opção sem texto');
    if (!q.opcoes.some((o) => o.correta)) erros.push('marque pelo menos uma correta');
    if (new Set(q.opcoes.map((o) => o.id)).size !== q.opcoes.length) erros.push('opções com id repetido');
  }
  return erros;
}

export const variasCorretas = (q) => q.opcoes.filter((o) => o.correta).length > 1;

export function corrigir(q, resposta) {
  const marcadas = new Set(Array.isArray(resposta) ? resposta : resposta == null ? [] : [resposta]);
  const certas = new Set(q.opcoes.filter((o) => o.correta).map((o) => o.id));
  const correta = marcadas.size === certas.size && [...certas].every((id) => marcadas.has(id));
  return { correta, gabarito: [...certas] };
}
