// 404 dentro do app: "folha arrancada do caderno".
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { Mascote } from '../components/mascote.js';

export const titulo = () => t('naoEncontrado.titulo');

export function FolhaArrancada() {
  return h(
    'div',
    { class: 'folha' },
    h(
      'div',
      { class: 'folha__papel pautado' },
      h('p', { class: 'folha__codigo', 'aria-hidden': 'true' }, '404'),
      Mascote({ humor: 'triste', tamanho: '6.5rem' }),
      h('h1', { tabindex: '-1', class: 'manuscrito' }, t('naoEncontrado.titulo')),
      h('p', { class: 'folha__texto' }, t('naoEncontrado.texto')),
      h('a', { class: 'botao botao--primario', href: '#/' }, t('naoEncontrado.voltar'))
    )
  );
}

export function render(alvo) {
  alvo.append(FolhaArrancada());
}
