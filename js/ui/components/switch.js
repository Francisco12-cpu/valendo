// Switch liga/desliga acessível (role="switch"). O estado aparece em texto, não só na cor.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';

export function Switch({ rotulo, ligado = false, aoMudar }) {
  const estado = h('span', { class: 'switch__estado', 'aria-hidden': 'true' });
  const el = h(
    'button',
    { type: 'button', role: 'switch', class: 'switch' },
    h('span', null, rotulo),
    h('span', { class: 'linha' }, estado, h('span', { class: 'switch__trilho', 'aria-hidden': 'true' }, h('span', { class: 'switch__bolinha' })))
  );

  const aplicar = (valor) => {
    ligado = valor;
    el.setAttribute('aria-checked', String(ligado));
    estado.textContent = ligado ? t('switch.ligado') : t('switch.desligado');
  };
  aplicar(ligado);

  el.addEventListener('click', () => {
    aplicar(!ligado);
    if (aoMudar) aoMudar(ligado);
  });

  el.definir = aplicar;
  return el;
}
