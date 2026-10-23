// Gráfico de barras horizontais de série única (magnitude): uma cor só (--grafico),
// barras finas com ponta arredondada ancorada na base, 2px de folga entre barras, grade
// discreta, rótulo de valor só no fim de cada barra, dica ao passar o mouse e tabela.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...filhos) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const f of filhos) if (f !== null && f !== undefined) el.append(f);
  return el;
};

let contador = 0;

// itens: [{ rotulo, valor, texto }]; valor no mesmo domínio de `maximo` (ex.: 0..1).
export function GraficoBarras({ titulo, descricao, itens, maximo = 1, formatar = (v) => `${Math.round(v * 100)}%`, colunaValor = t('grafico.valor') }) {
  const id = `grafico-${++contador}`;
  const altBarra = 14;
  const passo = 30;
  const larguraRotulo = 0; // rótulos ficam acima de cada barra (cabem em 360px)
  const largura = 600;
  const altura = itens.length * (passo + 16) + 24;
  const escala = (v) => (Math.max(0, Math.min(maximo, v)) / maximo) * (largura - 70 - larguraRotulo);

  const svg = s('svg', { viewBox: `0 0 ${largura} ${altura}`, class: 'grafico__svg', role: 'img', 'aria-labelledby': `${id}-t` });
  svg.append(s('title', { id: `${id}-t` }, titulo));
  // Grade recessiva: 0, 50% e 100%.
  for (const f of [0, 0.5, 1]) {
    const x = larguraRotulo + escala(maximo * f);
    svg.append(s('line', { x1: x, x2: x, y1: 4, y2: altura - 18, class: 'grafico__grade' }));
    svg.append(s('text', { x, y: altura - 4, class: 'grafico__eixo', 'text-anchor': f === 0 ? 'start' : f === 1 ? 'end' : 'middle' }, formatar(maximo * f)));
  }
  const dica = h('div', { class: 'grafico__dica', role: 'status', hidden: true });
  itens.forEach((it, i) => {
    const y = i * (passo + 16) + 18;
    const w = Math.max(it.valor > 0 ? 4 : 0, escala(it.valor));
    const r = Math.min(4, w / 2);
    // Ponta arredondada só no fim (a base fica reta, ancorada no zero).
    const caminho = w > 0 ? `M${larguraRotulo},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${altBarra - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - r)} z` : '';
    const g = s('g', { class: 'grafico__item', tabindex: 0, 'aria-label': `${it.rotulo}: ${it.texto ?? formatar(it.valor)}` });
    g.append(
      s('text', { x: larguraRotulo, y: y - 5, class: 'grafico__rotulo' }, it.rotulo.length > 70 ? `${it.rotulo.slice(0, 68)}…` : it.rotulo),
      s('rect', { x: 0, y: y - 16, width: largura, height: passo + 10, class: 'grafico__alvo' }),
      caminho ? s('path', { d: caminho, class: 'grafico__barra' }) : s('line', { x1: larguraRotulo, x2: larguraRotulo, y1: y, y2: y + altBarra, class: 'grafico__zero' }),
      s('text', { x: larguraRotulo + w + 6, y: y + altBarra - 2, class: 'grafico__valor' }, it.texto ?? formatar(it.valor))
    );
    const mostrar = (ev) => {
      dica.hidden = false;
      dica.textContent = `${it.rotulo} — ${it.texto ?? formatar(it.valor)}`;
      const caixa = svg.getBoundingClientRect();
      const px = ev?.clientX ? ev.clientX - caixa.left : (w / largura) * caixa.width;
      dica.style.left = `${Math.min(caixa.width - 180, Math.max(0, px + 12))}px`;
      dica.style.top = `${(y / altura) * caixa.height + 18}px`;
      g.classList.add('esta-ativo');
    };
    const esconder = () => {
      dica.hidden = true;
      g.classList.remove('esta-ativo');
    };
    g.addEventListener('pointermove', mostrar);
    g.addEventListener('pointerleave', esconder);
    g.addEventListener('focus', () => mostrar());
    g.addEventListener('blur', esconder);
    svg.append(g);
  });

  const tabela = h(
    'details',
    { class: 'grafico__tabela' },
    h('summary', null, t('grafico.verTabela')),
    h(
      'table',
      null,
      h('caption', { class: 'sr-only' }, titulo),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, t('grafico.item')), h('th', { scope: 'col' }, colunaValor))),
      h('tbody', null, itens.map((it) => h('tr', null, h('th', { scope: 'row' }, it.rotulo), h('td', null, it.texto ?? formatar(it.valor)))))
    )
  );
  return h('figure', { class: 'grafico' }, h('figcaption', { class: 'grafico__titulo' }, titulo, descricao ? h('span', { class: 'texto-suave grafico__desc' }, descricao) : null), h('div', { class: 'grafico__area' }, svg, dica), tabela);
}
