// Cartão-pasta: cada modalidade é uma pasta com aba colorida.
// Com `href` vira link; com `desativado` vira botão aria-disabled que chama `aoClicarDesativado`.
import { h, svg } from '../dom.js';
import { icones } from './icones.js';

export function CartaoPasta({ titulo, aba, descricao, cor, sobreCor, icone, href, desativado, etiqueta, aoClicarDesativado }) {
  const estilo = { '--cor': cor };
  if (sobreCor) estilo['--sobre-cor'] = sobreCor;

  const conteudo = [
    h('span', { class: 'pasta__aba', 'aria-hidden': 'true' }, aba ?? titulo),
    h(
      'span',
      { class: 'pasta__corpo' },
      icone ? h('span', { class: 'pasta__icone' }, svg(icones[icone])) : null,
      h('span', { class: 'pasta__titulo' }, titulo),
      descricao ? h('span', { class: 'pasta__descricao' }, descricao) : null,
      etiqueta ? h('span', { class: 'etiqueta pasta__etiqueta' }, etiqueta) : null
    ),
  ];

  if (desativado) {
    return h(
      'button',
      { type: 'button', class: 'pasta', style: estilo, 'aria-disabled': 'true', onClick: aoClicarDesativado },
      conteudo
    );
  }
  return h('a', { class: 'pasta', href, style: estilo }, conteudo);
}
