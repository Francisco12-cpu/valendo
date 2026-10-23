// Escolha única em cartões (grupo de rádios nativo: setas do teclado já funcionam).
import { h } from '../dom.js';

let contador = 0;

export function Escolha({ rotulo, opcoes, valor, aoMudar, compacta = false }) {
  const nome = `escolha-${++contador}`;
  const el = h(
    'fieldset',
    { class: `escolha${compacta ? ' escolha--compacta' : ''}` },
    h('legend', { class: 'escolha__rotulo' }, rotulo),
    h(
      'div',
      { class: 'escolha__opcoes' },
      opcoes.map((op) => {
        const input = h('input', { type: 'radio', name: nome, value: op.valor, class: 'escolha__input' });
        input.checked = op.valor === valor;
        input.addEventListener('change', () => {
          if (input.checked && aoMudar) aoMudar(op.valor);
        });
        return h(
          'label',
          { class: 'escolha__opcao' },
          input,
          h(
            'span',
            { class: 'escolha__cartao' },
            h('span', { class: 'escolha__texto' }, op.texto),
            op.descricao ? h('span', { class: 'escolha__descricao' }, op.descricao) : null
          )
        );
      })
    )
  );
  return el;
}
