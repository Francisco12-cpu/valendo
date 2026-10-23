// Stepper: [−] valor [+], com limites. Também aceita digitar e as setas do teclado.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';

let contador = 0;

export function Stepper({ rotulo, valor = 0, min = -Infinity, max = Infinity, passo = 1, aoMudar }) {
  const id = `stepper-${++contador}`;
  const menos = h('button', { type: 'button', class: 'stepper__botao', 'aria-label': t('stepper.menos', { rotulo }) }, '−');
  const mais = h('button', { type: 'button', class: 'stepper__botao', 'aria-label': t('stepper.mais', { rotulo }) }, '+');
  const campo = h('input', {
    id,
    class: 'stepper__valor',
    type: 'number',
    inputmode: 'numeric',
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null,
    step: passo,
  });

  const definir = (novo, avisar = true) => {
    const limitado = Math.min(max, Math.max(min, Number.isFinite(novo) ? novo : valor));
    const mudou = limitado !== valor;
    valor = limitado;
    campo.value = String(valor);
    menos.disabled = valor <= min;
    mais.disabled = valor >= max;
    if (mudou && avisar && aoMudar) aoMudar(valor);
  };

  menos.addEventListener('click', () => definir(valor - passo));
  mais.addEventListener('click', () => definir(valor + passo));
  campo.addEventListener('change', () => definir(parseFloat(campo.value)));

  const el = h(
    'div',
    { class: 'stepper', role: 'group', 'aria-labelledby': `${id}-rotulo` },
    h('label', { class: 'stepper__rotulo', id: `${id}-rotulo`, for: id }, rotulo),
    h('div', { class: 'stepper__controles' }, menos, campo, mais)
  );

  definir(valor, false);
  el.definir = definir;
  return el;
}
