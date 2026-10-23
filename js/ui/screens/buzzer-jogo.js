// #/buzzer/jogar — a tela do buzzer (regra de ouro: funciona offline, num aparelho só).
// Precisão: usamos event.timeStamp dos toques e o timestamp do requestAnimationFrame
// em que o sinal aparece (mesma base do performance.now()).
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { criarBuzzer, ESTADOS } from '../../core/buzzer.js';
import { agora, formatarMs } from '../../core/clock.js';
import { lerAjustes, ajustesPadrao, normalizarAjustes, montarJogadores } from '../buzzer-ajustes.js';
import { sons, desbloquear, definirMudo } from '../../audio/sons.js';
import { abrirModal } from '../components/modal.js';
import { ativarAfundar } from '../components/botao.js';
import { icones } from '../components/icones.js';

export const titulo = () => t('buzzer.titulo');

const ANTECIPOU_MS = 100; // reação humana abaixo disso é chute

export function render(alvo, params) {
  const relampago = params.has('relampago');
  const ajustes = relampago ? normalizarAjustes(ajustesPadrao()) : lerAjustes();
  const jogadores = montarJogadores(ajustes);
  const porId = new Map(jogadores.map((j) => [j.id, j]));
  const buzzer = criarBuzzer(
    jogadores.map((j) => j.id),
    ajustes
  );
  const sinalVisual = ajustes.sinal !== 'som';
  const sinalSonoro = ajustes.sinal !== 'visual';
  definirMudo(!ajustes.som);

  const timers = new Set();
  const depois = (ms, fn) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const limparTimers = () => {
    timers.forEach(clearTimeout);
    timers.clear();
  };
  let vigia = null; // checa o prazo durante o VALENDO
  let contagemAtual = null;
  const flashes = new Map(); // id → 'queimou' por alguns instantes
  const timersFlash = new Set(); // separados: sobrevivem à troca de estado (ex.: rodada anulada)

  // ---------- DOM ----------
  const areas = jogadores.map((j) => {
    const nome = h('span', { class: 'area__nome' }, j.nome);
    const status = h('span', { class: 'area__status' });
    const detalhe = h('span', { class: 'area__detalhe' });
    const el = h(
      'div',
      { class: 'area', 'data-id': j.id, style: { '--cor': j.cor }, role: 'group', 'aria-label': t('buzzer.areaDe', { nome: j.nome }) },
      h('div', { class: 'area__conteudo' }, nome, status, detalhe)
    );
    return { j, el, status, detalhe };
  });

  const grade = h('div', { class: 'jogo__areas' }, areas.map((a) => a.el));
  const sinal = h('p', { class: 'jogo__sinal' });
  const principal = h('button', { type: 'button', class: 'botao botao--primario botao--grande jogo__principal' });
  const extra = h('button', { type: 'button', class: 'botao jogo__extra' });
  const juiz = h('button', { type: 'button', class: 'botao botao--icone jogo__juiz', 'aria-label': t('buzzer.juiz'), title: t('buzzer.juiz') }, svg(icones.juiz));
  const sair = h('a', { class: 'botao botao--icone', href: '#/buzzer', 'aria-label': t('buzzer.sair'), title: t('buzzer.sair') }, svg(icones.fechar));
  const telaCheia = document.fullscreenEnabled
    ? h('button', { type: 'button', class: 'botao botao--icone', 'aria-label': t('buzzer.telaCheia'), title: t('buzzer.telaCheia') }, svg(icones.telaCheia))
    : null;
  const aviso = h('p', { class: 'sr-only', 'aria-live': 'assertive' });
  [principal, extra, juiz, telaCheia].filter(Boolean).forEach(ativarAfundar);
  ativarAfundar(sair);

  const raiz = h(
    'div',
    { class: 'jogo', 'data-n': jogadores.length, 'data-mesa': ajustes.mesa ? 'sim' : 'nao', 'data-sinal-visual': sinalVisual ? 'sim' : 'nao' },
    h('h1', { class: 'sr-only', tabindex: '-1' }, t('buzzer.titulo')),
    grade,
    h('div', { class: 'jogo__centro' }, h('div', { class: 'jogo__ferramentas' }, sair, telaCheia, juiz), sinal, h('div', { class: 'jogo__acoes' }, principal, extra)),
    aviso
  );
  alvo.append(raiz);
  document.body.classList.add('modo-jogo');

  // ---------- Layout: grade e giro das áreas ----------
  const paisagem = window.matchMedia('(orientation: landscape)');
  function organizar() {
    const n = jogadores.length;
    const deitado = paisagem.matches;
    const [colunas, linhas] = deitado
      ? [[2, 1], [3, 1], [2, 2], [3, 2], [3, 2], [4, 2], [4, 2]][n - 2]
      : [[1, 2], [1, 3], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4]][n - 2];
    grade.style.setProperty('--colunas', colunas);
    grade.style.setProperty('--linhas', linhas);
    areas.forEach((a, i) => {
      let giro = '0';
      if (ajustes.mesa) {
        if (n === 2 && deitado) giro = i === 0 ? '90' : '-90';
        else if (linhas > 1 && Math.floor(i / colunas) < Math.floor(linhas / 2)) giro = '180';
      }
      a.el.dataset.giro = giro;
    });
  }
  organizar();
  paisagem.addEventListener('change', organizar);

  // ---------- Desenho do estado ----------
  function textoStatus(id, s) {
    const metodoA = ajustes.metodo === 'A';
    if (flashes.has(id)) return [flashes.get(id), 'queimou'];
    if (s.eliminados.includes(id)) return [t('buzzer.fora'), 'fora'];
    if (!s.participantes.includes(id) && s.estado !== ESTADOS.OCIOSO) return [t('buzzer.fora'), 'fora'];

    if (s.estado === ESTADOS.RESULTADO && s.resultado) {
      const r = s.resultado;
      if (r.tipo === 'queima') return r.jogador === id ? [t('buzzer.queimou'), 'queimou'] : [t('buzzer.aguarde'), 'espera'];
      const pos = r.ordem.findIndex((o) => o.jogador === id);
      if (r.vencedores.includes(id)) return [r.tipo === 'empate' ? t('buzzer.empatou') : t('buzzer.primeiro'), 'venceu'];
      if (pos >= 0) return [`${pos + 1}º`, 'perdeu'];
      return ['—', 'perdeu'];
    }
    if (s.acoes[id]) return [t('buzzer.registrado'), 'agiu'];
    if (s.estado === ESTADOS.VALENDO) {
      if (!sinalVisual) return [metodoA ? t('buzzer.segure') : t('buzzer.espere'), 'espera'];
      return [metodoA ? t('buzzer.solte') : t('buzzer.aperte'), 'valendo'];
    }
    if (metodoA && (s.estado === ESTADOS.PREPARANDO || s.estado === ESTADOS.ARMADO)) {
      return s.segurando.includes(id) ? [t('buzzer.segurando'), 'pronto'] : [t('buzzer.segureAqui'), 'espera'];
    }
    if (s.estado === ESTADOS.ARMADO) return [t('buzzer.espere'), 'espera'];
    return [metodoA ? t('buzzer.instrucaoA') : t('buzzer.instrucaoB'), 'ocioso'];
  }

  function detalhe(id, s) {
    const r = s.resultado;
    if (s.estado !== ESTADOS.RESULTADO || !r || r.tipo === 'queima') {
      if (s.penalizados.includes(id)) return t('buzzer.comPenalidade', { ms: ajustes.penalidadeMs });
      return '';
    }
    const item = r.ordem.find((o) => o.jogador === id);
    if (!item) return r.naoAgiram.includes(id) ? t('buzzer.naoAgiu') : '';
    return item.diferenca === 0 ? formatarMs(item.tempo) : `${formatarMs(item.tempo)} (${formatarMs(item.diferenca, { sinal: true })})`;
  }

  function nomes(ids) {
    return ids.map((id) => porId.get(id).nome).join(' e ');
  }

  function desenhar() {
    const s = buzzer.instantaneo();
    raiz.dataset.estado = s.estado;
    for (const a of areas) {
      const [texto, modo] = textoStatus(a.j.id, s);
      a.status.textContent = texto;
      a.detalhe.textContent = detalhe(a.j.id, s);
      a.el.dataset.modo = modo;
    }

    principal.hidden = false;
    extra.hidden = true;
    juiz.hidden = !(s.estado === ESTADOS.RESULTADO && s.resultado && s.resultado.tipo !== 'queima');
    switch (s.estado) {
      case ESTADOS.OCIOSO:
        sinal.textContent = t('buzzer.pronto');
        principal.textContent = t('buzzer.comecar');
        break;
      case ESTADOS.PREPARANDO:
        sinal.textContent = t('buzzer.todosSegurem');
        principal.hidden = true;
        break;
      case ESTADOS.ARMADO:
        if (ajustes.gatilho === 'manual') {
          sinal.textContent = t('buzzer.aguardandoProfessor');
          principal.textContent = t('buzzer.dispararAgora');
        } else {
          sinal.textContent = contagemAtual !== null ? String(contagemAtual) : t('buzzer.preparese');
          principal.hidden = true;
        }
        break;
      case ESTADOS.VALENDO:
        sinal.textContent = sinalVisual ? t('buzzer.valendo') : '…';
        principal.hidden = true;
        break;
      case ESTADOS.RESULTADO: {
        const r = s.resultado;
        if (r.tipo === 'queima') {
          sinal.textContent = t('buzzer.queimouDecida', { nome: nomes([r.jogador]) });
          principal.textContent = t('buzzer.repetir');
          extra.hidden = false;
          extra.textContent = t('buzzer.eliminarJogador', { nome: nomes([r.jogador]) });
        } else {
          if (r.tipo === 'vencedor') sinal.textContent = t('buzzer.venceu', { nome: nomes(r.vencedores) });
          else if (r.tipo === 'empate') sinal.textContent = t('buzzer.empate', { nomes: nomes(r.vencedores) });
          else sinal.textContent = t('buzzer.ninguem');
          principal.textContent = t('buzzer.deNovo');
          if (r.tipo === 'empate') {
            extra.hidden = false;
            extra.textContent = t('buzzer.desempatar');
          }
        }
        break;
      }
    }
  }

  // ---------- Largada ----------
  function dispararNoProximoFrame() {
    requestAnimationFrame((ts) => {
      if (buzzer.estado !== ESTADOS.ARMADO) return;
      contagemAtual = null;
      // Marca a largada no frame em que o sinal é desenhado; o som sai no mesmo instante.
      buzzer.disparar(ts);
      if (sinalSonoro) sons.valendo();
      desenhar();
      vigia = setInterval(() => processar(buzzer.verificarPrazo(agora())), 50);
    });
  }

  function aoArmar() {
    limparTimers();
    contagemAtual = null;
    const s = buzzer.instantaneo();
    if (ajustes.gatilho === 'manual') return;
    if (ajustes.gatilho === 'contagem') {
      const inicio = agora();
      const passos = ajustes.contagem;
      const tique = (k) => {
        contagemAtual = passos - k;
        if (sinalSonoro) sons.contagem();
        desenhar();
        const proximo = inicio + (k + 1) * 1000;
        depois(Math.max(0, proximo - agora()), () => (k + 1 < passos ? tique(k + 1) : dispararNoProximoFrame()));
      };
      tique(0);
      return;
    }
    depois(s.esperaMs, dispararNoProximoFrame);
  }

  // ---------- Eventos do núcleo ----------
  function processar(eventos) {
    let redesenhar = eventos.length > 0;
    for (const e of eventos) {
      if (e.tipo === 'estado') {
        if (e.anterior === ESTADOS.ARMADO || e.anterior === ESTADOS.VALENDO) {
          limparTimers();
          clearInterval(vigia);
          vigia = null;
        }
        if (e.estado === ESTADOS.ARMADO) aoArmar();
      } else if (e.tipo === 'queima') {
        sons.queima();
        const nome = porId.get(e.jogador).nome;
        const texto = e.regra === 'penalidade' ? t('buzzer.queimouPenalidade', { ms: ajustes.penalidadeMs }) : t('buzzer.queimou');
        flashes.set(e.jogador, texto);
        aviso.textContent = t('buzzer.queimouAviso', { nome });
        const idFlash = setTimeout(() => {
          timersFlash.delete(idFlash);
          flashes.delete(e.jogador);
          desenhar();
        }, 1200);
        timersFlash.add(idFlash);
      } else if (e.tipo === 'anulada') {
        aviso.textContent = t('buzzer.anulada');
      } else if (e.tipo === 'acao') {
        sons.registro();
      } else if (e.tipo === 'resultado') {
        const r = e.resultado;
        if (r.tipo === 'vencedor') sons.vitoria();
        else if (r.tipo === 'empate') sons.empate();
        else if (r.tipo === 'ninguem') sons.nada();
        aviso.textContent = sinal.textContent;
      }
    }
    if (redesenhar) desenhar();
    if (eventos.some((e) => e.tipo === 'resultado')) aviso.textContent = sinal.textContent;
  }

  function acaoPrincipal() {
    desbloquear();
    const s = buzzer.instantaneo();
    if (s.estado === ESTADOS.ARMADO && ajustes.gatilho === 'manual') return dispararNoProximoFrame();
    if (s.estado === ESTADOS.RESULTADO && s.resultado?.tipo === 'queima') return processar(buzzer.decidir('repetir'));
    if (s.estado === ESTADOS.OCIOSO || s.estado === ESTADOS.RESULTADO) processar(buzzer.iniciar());
  }

  principal.addEventListener('click', acaoPrincipal);
  extra.addEventListener('click', () => {
    const r = buzzer.instantaneo().resultado;
    if (r?.tipo === 'queima') processar(buzzer.decidir('eliminar'));
    else if (r?.tipo === 'empate') processar(buzzer.desempatar());
  });
  juiz.addEventListener('click', () => abrirJuiz(buzzer.instantaneo().resultado));
  telaCheia?.addEventListener('click', alternarTelaCheia);

  // ---------- Toques (multitoque por pointerId) ----------
  for (const a of areas) {
    const id = a.j.id;
    a.el.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      desbloquear();
      try {
        a.el.setPointerCapture(e.pointerId);
      } catch {
        /* alguns navegadores antigos */
      }
      processar(buzzer.pressionar(id, e.pointerId, e.timeStamp));
    });
    a.el.addEventListener('pointerup', (e) => processar(buzzer.soltar(id, e.pointerId, e.timeStamp)));
    a.el.addEventListener('pointercancel', (e) => processar(buzzer.soltar(id, e.pointerId, e.timeStamp, { cancelado: true })));
  }
  const semMenu = (e) => e.preventDefault();
  raiz.addEventListener('contextmenu', semMenu);

  // ---------- Teclado: Espaço = largada/recomeçar, F = tela cheia, Esc = sair ----------
  function teclado(e) {
    if (document.querySelector('dialog[open]')) return;
    const emControle = e.target.closest?.('button, a, input, select, textarea');
    if ((e.code === 'Space' || e.key === ' ') && !emControle) {
      e.preventDefault();
      if (!e.repeat) acaoPrincipal();
    } else if ((e.key === 'f' || e.key === 'F') && !emControle) {
      alternarTelaCheia();
    } else if (e.key === 'Escape' && !document.fullscreenElement) {
      location.hash = '#/buzzer';
    }
  }
  document.addEventListener('keydown', teclado);

  function alternarTelaCheia() {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  // ---------- Tela sempre acesa ----------
  let trava = null;
  async function manterAcesa() {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') trava = await navigator.wakeLock.request('screen');
    } catch {
      trava = null;
    }
  }
  const aoVoltar = () => {
    if (document.visibilityState === 'visible') manterAcesa();
  };
  manterAcesa();
  document.addEventListener('visibilitychange', aoVoltar);

  // ---------- Juiz de dúvida ----------
  function abrirJuiz(r) {
    if (!r) return;
    const linhas = r.ordem.map((o, i) => {
      const notas = [];
      if (o.penalizado) notas.push(t('buzzer.juizPenalidade', { ms: formatarMs(o.tempo - o.bruto) }));
      if (o.bruto < ANTECIPOU_MS) notas.push(t('buzzer.juizAntecipou'));
      if (r.vencedores.includes(o.jogador) && r.tipo === 'empate') notas.push(t('buzzer.juizEmpate'));
      return h(
        'tr',
        null,
        h('td', null, `${i + 1}º`),
        h(
          'th',
          { scope: 'row' },
          h('span', { class: 'juiz__cor', style: { background: porId.get(o.jogador).cor } }),
          porId.get(o.jogador).nome,
          notas.length ? h('span', { class: 'juiz__notas' }, notas.join(' · ')) : null
        ),
        h('td', { class: 'juiz__num' }, formatarMs(o.tempo)),
        h('td', { class: 'juiz__num' }, i === 0 ? '—' : formatarMs(o.diferenca, { sinal: true }))
      );
    });
    const semAcao = [...r.naoAgiram, ...r.eliminados].map((id) =>
      h('tr', null, h('td', null, '—'), h('th', { scope: 'row' }, porId.get(id).nome), h('td', { colspan: 2 }, r.eliminados.includes(id) ? t('buzzer.juizEliminado') : t('buzzer.naoAgiu')))
    );
    const conteudo = h(
      'div',
      { class: 'juiz' },
      h(
        'div',
        { class: 'juiz__tabela' },
        h(
          'table',
          null,
          h('caption', { class: 'sr-only' }, t('buzzer.juiz')),
          h('thead', null, h('tr', null, ...['#', t('buzzer.juizNome'), t('buzzer.juizTempo'), t('buzzer.juizDiferenca')].map((c) => h('th', { scope: 'col' }, c)))),
          h('tbody', null, linhas, semAcao)
        )
      ),
      r.queimas.length
        ? h('p', { class: 'juiz__queimas' }, t('buzzer.juizQueimas', { lista: r.queimas.map((q) => porId.get(q.jogador).nome).join(', ') }))
        : null,
      h('p', { class: 'texto-suave' }, t('buzzer.juizRodape', { margem: r.margemEmpateMs }))
    );
    abrirModal({ titulo: t('buzzer.juiz'), conteudo });
  }

  desenhar();

  // ---------- Limpeza ao sair da tela ----------
  return () => {
    limparTimers();
    timersFlash.forEach(clearTimeout);
    clearInterval(vigia);
    buzzer.parar();
    paisagem.removeEventListener('change', organizar);
    document.removeEventListener('keydown', teclado);
    document.removeEventListener('visibilitychange', aoVoltar);
    document.body.classList.remove('modo-jogo');
    trava?.release?.().catch?.(() => {});
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}
