// Botão neo-brutalista que "afunda" ao apertar.
// O afundar é CSS (:active); a classe esta-pressionado cobre teclado (Espaço/Enter).
import { h, svg } from '../dom.js';
import { icones } from './icones.js';

export function Botao({ texto, variante, tamanho, icone, rotulo, desativado, bloco, tipo = 'button', aoClicar } = {}) {
  const classes = ['botao'];
  if (variante) classes.push(`botao--${variante}`);
  if (tamanho) classes.push(`botao--${tamanho}`);
  if (bloco) classes.push('botao--bloco');
  if (icone && !texto) classes.push('botao--icone');

  const el = h(
    'button',
    {
      type: tipo,
      class: classes.join(' '),
      'aria-label': rotulo,
      disabled: desativado,
      onClick: aoClicar,
    },
    icone ? svg(icones[icone]) : null,
    texto ? h('span', null, texto) : null
  );
  ativarAfundar(el);
  return el;
}

// Feedback de "afundar" também pelo teclado.
export function ativarAfundar(el) {
  el.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') el.classList.add('esta-pressionado');
  });
  const soltar = () => el.classList.remove('esta-pressionado');
  el.addEventListener('keyup', soltar);
  el.addEventListener('blur', soltar);
  return el;
}
