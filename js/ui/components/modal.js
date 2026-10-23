// Modal sobre <dialog> nativo: prende o foco, fecha com Esc e devolve o foco a quem abriu.
// abrirModal(...) retorna uma Promise com o `valor` da ação escolhida (ou null se fechou).
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { Botao } from './botao.js';

let contador = 0;

export function abrirModal({ titulo, conteudo, acoes = [] }) {
  return new Promise((resolver) => {
    const origem = document.activeElement;
    const idTitulo = `modal-titulo-${++contador}`;
    let terminado = false;

    const dialogo = h('dialog', { class: 'modal', 'aria-labelledby': idTitulo });
    // Resolve na hora (não espera o evento "close", que o navegador pode adiar).
    const finalizar = (v) => {
      if (terminado) return;
      terminado = true;
      if (dialogo.open) dialogo.close();
      dialogo.remove();
      if (origem && typeof origem.focus === 'function' && origem.isConnected) origem.focus();
      resolver(v);
    };
    const fechar = (v) => finalizar(v);

    const partes = [
      h(
        'div',
        { class: 'modal__topo' },
        h('h2', { class: 'modal__titulo', id: idTitulo }, titulo),
        Botao({ icone: 'fechar', variante: 'fantasma', rotulo: t('modal.fechar'), aoClicar: () => fechar(null) })
      ),
      h('div', { class: 'modal__corpo' }, typeof conteudo === 'string' ? h('p', null, conteudo) : conteudo),
      acoes.length
        ? h(
            'div',
            { class: 'modal__acoes' },
            acoes.map((a) => Botao({ texto: a.texto, variante: a.variante, aoClicar: () => fechar(a.valor) }))
          )
        : null,
    ];
    dialogo.append(...partes.filter(Boolean)); // append nativo escreveria "null"

    // Toque no fundo escuro fecha.
    dialogo.addEventListener('click', (e) => {
      if (e.target === dialogo) fechar(null);
    });

    // Esc fecha sem escolha.
    dialogo.addEventListener('close', () => finalizar(null));

    document.body.append(dialogo);
    dialogo.showModal();
    // Foca a ação principal (a última), se houver.
    const principal = dialogo.querySelector('.modal__acoes .botao:last-child');
    if (principal) principal.focus();
  });
}
