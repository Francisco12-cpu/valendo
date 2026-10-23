// Post-it colado com fita. Enfeite: use com moderação.
import { h } from '../dom.js';

export function PostIt({ texto, cor, inclinacao = -2 }) {
  const estilo = { '--inclinacao': `${inclinacao}deg` };
  if (cor) estilo['--cor'] = cor;
  return h('div', { class: 'postit', style: estilo }, texto);
}
