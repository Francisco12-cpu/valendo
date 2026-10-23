// Toast: aviso curto no rodapé da tela, anunciado por leitores de tela.
// Tipos: info · sucesso · aviso · erro (cada um com ícone, não só cor).
import { h, svg } from '../dom.js';
import { icones } from './icones.js';

const MAX_VISIVEIS = 3;

function regiao() {
  let el = document.getElementById('toasts');
  if (!el) {
    el = h('div', { id: 'toasts', class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  return el;
}

export function toast(mensagem, { tipo = 'info', duracao = 3500 } = {}) {
  const area = regiao();
  const el = h(
    'div',
    { class: `toast toast--${tipo}` },
    h('span', { class: 'toast__icone' }, svg(icones[tipo] || icones.info)),
    h('span', null, mensagem)
  );

  while (area.children.length >= MAX_VISIVEIS) area.firstElementChild.remove();
  area.append(el);

  const remover = () => {
    el.classList.add('esta-saindo');
    setTimeout(() => el.remove(), 200);
  };
  const timer = setTimeout(remover, duracao);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    remover();
  });
  return remover;
}
