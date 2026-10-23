// #/cronometro — cronômetro grande para o projetor (regressivo ou progressivo).
// Usa Date.now() como base para continuar certo mesmo depois de recarregar a página.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import * as crono from '../../core/timer.js';
import { ler, salvar } from '../../storage/db.js';
import { sons, desbloquear } from '../../audio/sons.js';
import { Botao } from '../components/botao.js';
import { Stepper } from '../components/stepper.js';
import { Escolha } from '../components/escolha.js';
import { ModoProjetor } from '../components/projetor.js';

export const titulo = () => t('cronometro.titulo');
const SESSAO = 'cronometro';
const PRESETS = [30, 60, 120, 300, 600, 900];
const AVISO_MS = 10000;
const agora = () => Date.now();

export function render(alvo) {
  let c = crono.criarCronometro({ duracaoMs: 60000 });
  let quadro = null;
  let tocouFim = false;
  let ultimoSegundo = null;
  const projetor = ModoProjetor();

  const guardar = () => salvar('sessoes', { id: SESSAO, cronometro: c });

  const visor = h('div', { class: 'crono__visor', role: 'timer', 'aria-live': 'off' });
  const estadoTexto = h('p', { class: 'crono__estado', 'aria-live': 'polite' });
  const barra = h('div', { class: 'crono__barra', 'aria-hidden': 'true' }, h('span'));
  const btnIniciar = Botao({ texto: t('cronometro.iniciar'), variante: 'primario', tamanho: 'grande', aoClicar: () => alternar() });
  const btnZerar = Botao({ texto: t('cronometro.zerar'), aoClicar: () => mudar(crono.zerar(c)) });
  const btnMais = Botao({ texto: '+30 s', aoClicar: () => mudar(crono.adicionar(c, 30000, agora())) });
  const btnMaisMin = Botao({ texto: '+1 min', aoClicar: () => mudar(crono.adicionar(c, 60000, agora())) });

  let minutos = 1;
  let segundos = 0;
  const stMin = Stepper({ rotulo: t('cronometro.minutos'), valor: minutos, min: 0, max: 180, aoMudar: (v) => ((minutos = v), aplicarDuracao()) });
  const stSeg = Stepper({ rotulo: t('cronometro.segundos'), valor: segundos, min: 0, max: 55, passo: 5, aoMudar: (v) => ((segundos = v), aplicarDuracao()) });
  const aplicarDuracao = () => mudar(crono.definirDuracao(c, (minutos * 60 + segundos) * 1000));

  const presets = h(
    'div',
    { class: 'linha' },
    PRESETS.map((s) =>
      Botao({
        texto: s < 60 ? `${s} s` : `${s / 60} min`,
        aoClicar: () => {
          minutos = Math.floor(s / 60);
          segundos = s % 60;
          stMin.definir(minutos, false);
          stSeg.definir(segundos, false);
          aplicarDuracao();
        },
      })
    )
  );

  let modoEscolha = null;

  function mudar(novo) {
    c = novo;
    if (!crono.terminou(c, agora())) tocouFim = false;
    guardar();
    desenhar();
    if (c.rodando) animar();
  }

  function alternar() {
    desbloquear();
    if (crono.terminou(c, agora())) return mudar(crono.iniciar(crono.zerar(c), agora()));
    mudar(crono.alternar(c, agora()));
  }

  function desenhar() {
    const t0 = agora();
    const regressivo = c.modo === 'regressivo';
    const ms = crono.mostrador(c, t0);
    visor.textContent = crono.formatarRelogio(ms, { paraCima: regressivo });
    const fim = crono.terminou(c, t0);
    const aviso = regressivo && !fim && c.duracaoMs > AVISO_MS && crono.restante(c, t0) <= AVISO_MS;
    raiz.dataset.estado = fim ? 'fim' : aviso ? 'aviso' : c.rodando ? 'rodando' : 'parado';
    btnIniciar.querySelector('span').textContent = fim ? t('cronometro.denovo') : c.rodando ? t('cronometro.pausar') : crono.decorrido(c, t0) > 0 ? t('cronometro.continuar') : t('cronometro.iniciar');
    btnMais.hidden = btnMaisMin.hidden = !regressivo;
    barra.hidden = !regressivo;
    barra.firstChild.style.transform = `scaleX(${regressivo && c.duracaoMs ? crono.restante(c, t0) / c.duracaoMs : 0})`;
    estadoTexto.textContent = fim ? t('cronometro.tempo') : aviso ? t('cronometro.acabando') : '';

    // Bipe a cada segundo nos últimos 5 s; alarme no fim (com equivalente visual).
    const seg = Math.ceil(crono.restante(c, t0) / 1000);
    if (regressivo && c.rodando && seg <= 5 && seg > 0 && seg !== ultimoSegundo) sons.contagem();
    ultimoSegundo = seg;
    if (fim && !tocouFim) {
      tocouFim = true;
      sons.queima();
      setTimeout(() => sons.queima(), 600);
    }
  }

  function animar() {
    cancelAnimationFrame(quadro);
    const passo = () => {
      desenhar();
      if (c.rodando && !crono.terminou(c, agora())) quadro = requestAnimationFrame(passo);
      else if (c.rodando) mudar(crono.pausar(c, agora()));
    };
    quadro = requestAnimationFrame(passo);
  }

  function teclado(e) {
    if (document.querySelector('dialog[open]') || e.target.closest?.('input, textarea, select, button, a')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) alternar();
    } else if (e.key === 'r' || e.key === 'R') mudar(crono.zerar(c));
    else if (e.key === 'f' || e.key === 'F') projetor.alternar();
  }
  document.addEventListener('keydown', teclado);

  const raiz = h('div', { class: 'crono' });

  ler('sessoes', SESSAO).then((sessao) => {
    if (sessao?.cronometro) {
      c = sessao.cronometro;
      tocouFim = crono.terminou(c, agora());
      minutos = Math.floor(c.duracaoMs / 60000);
      segundos = Math.floor((c.duracaoMs % 60000) / 1000);
      stMin.definir(minutos, false);
      stSeg.definir(segundos, false);
    }
    modoEscolha = Escolha({
      rotulo: t('cronometro.modo'),
      valor: c.modo,
      compacta: true,
      aoMudar: (modo) => mudar({ ...crono.zerar(c), modo }),
      opcoes: [
        { valor: 'regressivo', texto: t('cronometro.regressivo') },
        { valor: 'progressivo', texto: t('cronometro.progressivo') },
      ],
    });
    raiz.append(
      h('section', { class: 'crono__palco cartao', 'aria-label': t('cronometro.titulo') }, barra, visor, estadoTexto, h('div', { class: 'linha crono__acoes' }, btnIniciar, btnZerar, btnMais, btnMaisMin)),
      h('section', { class: 'cartao pilha crono__ajustes', 'aria-labelledby': 'crono-ajustes' }, h('h2', { id: 'crono-ajustes' }, t('cronometro.ajustes')), modoEscolha, h('p', { class: 'texto-suave' }, t('cronometro.prontos')), presets, h('div', { class: 'linha' }, stMin, stSeg))
    );
    desenhar();
    if (c.rodando) animar();
  });

  alvo.append(
    h('div', { class: 'tela__topo buzzer-topo' }, h('div', null, h('h1', { tabindex: '-1' }, t('cronometro.titulo')), h('p', { class: 'tela__subtitulo texto-suave' }, t('cronometro.dica'))), projetor.botao),
    raiz
  );

  return () => {
    cancelAnimationFrame(quadro);
    document.removeEventListener('keydown', teclado);
    projetor.sair();
  };
}
