// #/roleta — roleta de temas (ou nomes): gira e para no sorteado, com opção sem repetir.
// O sorteio é o mesmo do Sorteio (core/sorteador); a roleta só anima até a fatia certa.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { criarSorteio, sortear, disponiveis, reiniciar, historico } from '../../core/sorteador.js';
import { ler, salvar } from '../../storage/db.js';
import { sons, desbloquear } from '../../audio/sons.js';
import { MARCAS } from '../questoes.js';
import { Botao } from '../components/botao.js';
import { Switch } from '../components/switch.js';
import { ModoProjetor } from '../components/projetor.js';

export const titulo = () => t('roleta.titulo');
const SESSAO = 'roleta';
const PADRAO = 'Células\nPlanetas\nFrações\nVerbos\nBrasil Colônia\nEcossistemas';
const reduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const escaparSvg = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function render(alvo) {
  let texto = PADRAO;
  let semRepetir = true;
  let sorteio = criarSorteio([]);
  let giro = 0; // graus acumulados
  let girando = false;
  const projetor = ModoProjetor();

  const guardar = () => salvar('sessoes', { id: SESSAO, texto, semRepetir, sorteio });
  const itens = () => texto.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 24);

  const roda = h('div', { class: 'roleta__roda', 'aria-hidden': 'true' });
  const resultado = h('p', { class: 'roleta__resultado manuscrito', 'aria-live': 'polite' });
  const historicoEl = h('ol', { class: 'sorteio__historico' });
  const area = h('textarea', { id: 'roleta-itens', class: 'campo campo--area', rows: 8 });
  const btnGirar = Botao({ texto: t('roleta.girar'), variante: 'primario', tamanho: 'grande', icone: 'sorteio', aoClicar: () => girar() });
  const btnReiniciar = Botao({ texto: t('sorteio.reiniciar'), aoClicar: () => ((sorteio = reiniciar(sorteio)), guardar(), desenhar()) });

  function sincronizarItens() {
    const lista = itens();
    if (sorteio.itens.map((i) => i.nome).join('\n') !== lista.join('\n')) sorteio = criarSorteio(lista);
  }

  function desenhar() {
    const lista = sorteio.itens;
    const n = Math.max(lista.length, 1);
    const fatia = 360 / n;
    const fatias = lista.map((it, i) => {
      const a0 = ((i * fatia - 90) * Math.PI) / 180;
      const a1 = (((i + 1) * fatia - 90) * Math.PI) / 180;
      const grande = fatia > 180 ? 1 : 0;
      const x0 = 100 + 96 * Math.cos(a0);
      const y0 = 100 + 96 * Math.sin(a0);
      const x1 = 100 + 96 * Math.cos(a1);
      const y1 = 100 + 96 * Math.sin(a1);
      const meio = (((i + 0.5) * fatia - 90) * Math.PI) / 180;
      const usado = sorteio.sorteados.includes(it.id);
      const rot = (i + 0.5) * fatia - 90;
      return `<path d="M100,100 L${x0.toFixed(2)},${y0.toFixed(2)} A96,96 0 ${grande} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" fill="${usado && semRepetir ? '#E4E2DC' : MARCAS[i % 8].cor}" stroke="#141414" stroke-width="2"/>
        <text x="${(100 + 58 * Math.cos(meio)).toFixed(2)}" y="${(100 + 58 * Math.sin(meio)).toFixed(2)}" transform="rotate(${rot.toFixed(1)} ${(100 + 58 * Math.cos(meio)).toFixed(2)} ${(100 + 58 * Math.sin(meio)).toFixed(2)})" text-anchor="middle" dominant-baseline="middle" font-size="${Math.max(6, Math.min(11, 90 / n + 4))}" font-weight="700" fill="#141414"${usado && semRepetir ? ' text-decoration="line-through"' : ''}>${escaparSvg(it.nome.length > 14 ? `${it.nome.slice(0, 13)}…` : it.nome)}</text>`;
    });
    roda.innerHTML = `<svg viewBox="0 0 200 200">${fatias.join('')}<circle cx="100" cy="100" r="10" fill="#FFFDF7" stroke="#141414" stroke-width="3"/></svg>`;
    roda.firstChild.style.transform = `rotate(${giro}deg)`;
    const livres = disponiveis(sorteio).length;
    btnGirar.disabled = girando || !lista.length || (semRepetir && !livres);
    btnReiniciar.disabled = girando || !sorteio.sorteados.length;
    historicoEl.replaceChildren(...historico(sorteio).map((it) => h('li', null, it.nome)));
  }

  function girar() {
    if (girando) return;
    desbloquear();
    sincronizarItens();
    let base = sorteio;
    if (!semRepetir) base = reiniciar(base);
    const { sorteio: novo, item } = sortear(base);
    if (!item) return;
    const n = sorteio.itens.length;
    const i = sorteio.itens.findIndex((x) => x.id === item.id);
    const fatia = 360 / n;
    // A seta fica no topo: a fatia i precisa terminar centrada em 0°.
    const alvoAngulo = 360 - (i + 0.5) * fatia + (Math.random() - 0.5) * fatia * 0.6;
    const voltas = reduzido() ? 0 : 5;
    giro = giro - (giro % 360) + voltas * 360 + alvoAngulo;
    girando = true;
    resultado.textContent = '';
    const svgEl = roda.firstChild;
    svgEl.style.transition = reduzido() ? 'none' : 'transform 4.2s cubic-bezier(0.12, 0.7, 0.15, 1)';
    svgEl.style.transform = `rotate(${giro}deg)`;
    btnGirar.disabled = true;
    const terminar = () => {
      girando = false;
      sorteio = semRepetir ? novo : { ...sorteio, sorteados: [...sorteio.sorteados, item.id].slice(-50) };
      resultado.textContent = item.nome;
      sons.vitoria();
      guardar();
      desenhar();
    };
    if (reduzido()) terminar();
    else setTimeout(terminar, 4300);
  }

  area.addEventListener('input', () => {
    texto = area.value;
    sincronizarItens();
    guardar();
    desenhar();
  });

  function teclado(e) {
    if (e.target.closest?.('input, textarea, select, button, a')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) girar();
    } else if (e.key === 'f' || e.key === 'F') projetor.alternar();
  }
  document.addEventListener('keydown', teclado);

  ler('sessoes', SESSAO).then((s) => {
    if (s) {
      texto = s.texto ?? texto;
      semRepetir = s.semRepetir ?? true;
      sorteio = s.sorteio ?? sorteio;
    }
    area.value = texto;
    sincronizarItens();
    alvo.append(
      h('div', { class: 'tela__topo buzzer-topo' }, h('div', null, h('h1', { tabindex: '-1' }, t('roleta.titulo')), h('p', { class: 'tela__subtitulo' }, t('roleta.subtitulo'))), projetor.botao),
      h(
        'div',
        { class: 'sorteio' },
        h('section', { class: 'cartao roleta', 'aria-label': t('roleta.titulo') }, h('div', { class: 'roleta__seta', 'aria-hidden': 'true' }), roda, resultado, h('div', { class: 'linha sorteio__acoes' }, btnGirar, btnReiniciar), h('p', { class: 'texto-suave sorteio__dica' }, t('sorteio.dica'))),
        h(
          'div',
          { class: 'sorteio__lado' },
          h('section', { class: 'cartao pilha' }, h('label', { for: 'roleta-itens', class: 'rotulo' }, t('roleta.itens')), area, Switch({ rotulo: t('roleta.semRepetir'), ligado: semRepetir, aoMudar: (v) => ((semRepetir = v), guardar(), desenhar()) })),
          h('section', { class: 'cartao pilha' }, h('h2', null, t('sorteio.historico')), historicoEl)
        )
      )
    );
    desenhar();
  });

  return () => {
    document.removeEventListener('keydown', teclado);
    projetor.sair();
  };
}
