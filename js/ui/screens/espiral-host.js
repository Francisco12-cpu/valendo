// Prova em Espiral — lado do professor (host): configuração e tela de controle no projetor.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import * as R from '../../core/rotation.js';
import { formatarRelogio } from '../../core/timer.js';
import { salvar } from '../../storage/db.js';
import { novoId } from '../../core/ids.js';
import { sons, desbloquear } from '../../audio/sons.js';
import { Escolha } from '../components/escolha.js';
import { Stepper } from '../components/stepper.js';
import { Switch } from '../components/switch.js';
import { Botao } from '../components/botao.js';
import { abrirModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { Grade } from '../components/grade.js';

const agora = () => performance.now();
const MIN = 60000;

export function configEspiral(atividades) {
  const valores = { provas: [], modo: 'grupo', minutos: 5, porProva: false, sentido: 1, avisoS: 30, autoAvancar: false, grupos: 4 };
  const lista = h(
    'ul',
    { class: 'escolha-provas', role: 'list' },
    atividades.map((a) => {
      const caixa = h('input', { type: 'checkbox', id: `esp-${a.id}`, class: 'escolha-provas__caixa' });
      caixa.addEventListener('change', () => {
        valores.provas = caixa.checked ? [...valores.provas, a.id] : valores.provas.filter((x) => x !== a.id);
        ordem();
      });
      return h('li', null, h('label', { for: `esp-${a.id}`, class: 'escolha-provas__item' }, caixa, h('span', { class: 'escolha-provas__marca', 'aria-hidden': 'true' }), h('span', null, a.titulo, h('span', { class: 'texto-suave' }, ` · ${t('atividades.nPerguntas', { n: a.conteudo.perguntas.length })}`))));
    })
  );
  const resumo = h('p', { class: 'texto-suave', 'aria-live': 'polite' });
  const ordem = () => (resumo.textContent = valores.provas.length ? t('espiral.provasEscolhidas', { n: valores.provas.length }) : t('espiral.escolhaProvas'));
  ordem();
  const stGrupos = Stepper({ rotulo: t('espiral.quantosGrupos'), valor: valores.grupos, min: 2, max: 12, aoMudar: (v) => (valores.grupos = v) });
  stGrupos.hidden = true;
  const el = h(
    'div',
    { class: 'pilha' },
    h('p', { class: 'rotulo' }, t('espiral.provas')),
    lista,
    resumo,
    Escolha({
      rotulo: t('espiral.modo'),
      valor: valores.modo,
      aoMudar: (v) => {
        valores.modo = v;
        stGrupos.hidden = v !== 'estacao';
      },
      opcoes: [
        { valor: 'grupo', texto: t('espiral.modoGrupo'), descricao: t('espiral.modoGrupoDesc') },
        { valor: 'estacao', texto: t('espiral.modoEstacao'), descricao: t('espiral.modoEstacaoDesc') },
      ],
    }),
    stGrupos,
    h('div', { class: 'linha' }, Stepper({ rotulo: t('espiral.minutos'), valor: valores.minutos, min: 1, max: 60, aoMudar: (v) => (valores.minutos = v) }), Stepper({ rotulo: t('espiral.aviso'), valor: valores.avisoS, min: 0, max: 120, passo: 10, aoMudar: (v) => (valores.avisoS = v) })),
    Switch({ rotulo: t('espiral.porProva'), ligado: false, aoMudar: (v) => (valores.porProva = v) }),
    Escolha({
      rotulo: t('espiral.sentido'),
      valor: '1',
      compacta: true,
      aoMudar: (v) => (valores.sentido = Number(v)),
      opcoes: [
        { valor: '1', texto: t('espiral.horario') },
        { valor: '-1', texto: t('espiral.antiHorario') },
      ],
    }),
    Switch({ rotulo: t('espiral.autoAvancar'), ligado: false, aoMudar: (v) => (valores.autoAvancar = v) })
  );
  return { el, valores };
}

export function jogarEspiral(alvo, host, config, atividades, participantes, extraTopo) {
  const escolhidas = config.provas.map((id) => atividades.find((a) => a.id === id)).filter(Boolean);
  const provas = escolhidas.map((a) => ({ id: a.id, titulo: a.titulo, perguntas: a.conteudo.perguntas, tempoMs: a.regras?.tempo?.total ? a.regras.tempo.total * MIN : null }));
  const estacao = config.modo === 'estacao';
  // "Prova anda": cada aparelho é um grupo. "Grupo anda": cada aparelho é uma estação.
  const grupos = estacao ? Array.from({ length: config.grupos }, (_, i) => ({ id: `g${i + 1}`, nome: t('espiral.grupoN', { n: i + 1 }) })) : participantes.map((p) => ({ id: p.id, nome: p.nome }));
  const provaDoAparelho = estacao ? Object.fromEntries(participantes.slice(0, provas.length).map((p, i) => [p.id, provas[i].id])) : {};
  let r = R.criarRotacao({ grupos, provas, tempoRodadaMs: config.minutos * MIN, tempoPorProva: config.porProva, sentido: config.sentido, avisoMs: config.avisoS * 1000 });
  let estavaEmAviso = false;
  let trocaEm = null;
  let gradeEl = null;
  const nomeProva = (id) => provas.find((p) => p.id === id)?.titulo ?? '—';

  const relogio = h('p', { class: 'espiral__relogio', role: 'timer' });
  const status = h('p', { class: 'espiral__status etiqueta', 'aria-live': 'polite' });
  const tabela = h('div', { class: 'espiral__tabela' });
  const proxima = h('p', { class: 'texto-suave' });
  const controles = h('div', { class: 'linha espiral__controles' });
  const corpo = h('div', { class: 'pilha' });

  function mudar(novo, { transmitir = true } = {}) {
    if (novo === r) return;
    const antes = r;
    r = novo;
    if (antes.status !== r.status) {
      if (r.status === R.STATUS.TROCA || r.status === R.STATUS.FIM) sons.vitoria();
      if (r.status === R.STATUS.RODANDO && antes.status !== R.STATUS.PAUSADO) sons.valendo();
      trocaEm = r.status === R.STATUS.TROCA ? agora() : null;
    }
    if (transmitir) host.transmitirEstados();
    desenhar();
  }

  host.definirJogo({
    paraAluno: (id, tt) => (estacao ? (provaDoAparelho[id] ? R.paraEstacao(r, provaDoAparelho[id], tt) : { tipo: 'espiral', espectador: true }) : R.paraGrupo(r, id, tt)),
    aoAcao: (id, acao, tHost) => {
      if (acao.tipo !== 'espiral') return;
      const grupo = estacao ? R.grupoNaProva(r, provaDoAparelho[id]) : id;
      if (!grupo) return;
      const res = R.responder(r, grupo, acao.prova, acao.qid, acao.resposta, tHost);
      if (res.ok) {
        r = res.r;
        host.enviarEstado(id);
        desenharTabela();
      }
    },
  });

  function progressoDe(g, p) {
    const prova = provas.find((x) => x.id === p);
    const resp = r.respostas[g]?.[p] ?? {};
    return { feitas: Object.values(resp).filter((x) => !x.emBranco).length, total: prova.perguntas.filter((q) => q.tipo !== 'slide' && q.tipo !== 'enquete').length };
  }

  function desenharTabela() {
    const atrib = R.atribuicao(r);
    tabela.replaceChildren(
      h(
        'table',
        { class: 'espiral__grupos' },
        h('thead', null, h('tr', null, [t('espiral.grupo'), t('espiral.prova'), t('espiral.progresso'), t('espiral.situacao')].map((c) => h('th', { scope: 'col' }, c)))),
        h(
          'tbody',
          null,
          r.grupos.map((g) => {
            const p = atrib[g.id];
            const prog = p ? progressoDe(g.id, p) : null;
            const travado = p && r.travados[`${g.id}|${p}`];
            return h(
              'tr',
              { 'data-pausa': String(!p) },
              h('th', { scope: 'row' }, g.nome),
              h('td', null, p ? nomeProva(p) : t('espiral.descansa')),
              h('td', null, prog ? h('span', { class: 'espiral__barra', style: { '--valor': prog.total ? prog.feitas / prog.total : 0 } }, `${prog.feitas}/${prog.total}`) : '—'),
              h('td', null, !p ? '—' : travado ? t('espiral.travado') : r.status === R.STATUS.RODANDO ? t('espiral.fazendo') : '…')
            );
          })
        )
      )
    );
    const prox = r.rodada + 1 < R.totalRodadas(r) ? R.atribuicao(r, r.rodada + 1) : null;
    proxima.textContent = prox ? t('espiral.proximaRodada', { lista: r.grupos.map((g) => `${g.nome} → ${prox[g.id] ? nomeProva(prox[g.id]) : t('espiral.descansa')}`).join(' · ') }) : '';
  }

  function desenharControles() {
    const b = [];
    if (r.status === R.STATUS.PREPARANDO) b.push(Botao({ texto: t('espiral.iniciar'), variante: 'primario', tamanho: 'grande', aoClicar: () => (desbloquear(), mudar(R.iniciar(r, agora()))) }));
    if (r.status === R.STATUS.RODANDO) b.push(Botao({ texto: t('espiral.pausar'), variante: 'amarelo', aoClicar: () => mudar(R.pausar(r, agora())) }));
    if (r.status === R.STATUS.PAUSADO) b.push(Botao({ texto: t('espiral.retomar'), variante: 'primario', aoClicar: () => mudar(R.retomar(r, agora())) }));
    if (r.status === R.STATUS.RODANDO || r.status === R.STATUS.PAUSADO) b.push(Botao({ texto: t('espiral.prorrogar'), aoClicar: () => (mudar(R.prorrogar(r, MIN, agora())), toast(t('espiral.prorrogado'))) }));
    if (r.status === R.STATUS.TROCA) b.push(Botao({ texto: r.rodada + 1 >= R.totalRodadas(r) ? t('espiral.verGrade') : t('espiral.proxima'), variante: 'primario', tamanho: 'grande', aoClicar: () => mudar(R.avancar(r, agora())) }));
    if (r.status === R.STATUS.RODANDO || r.status === R.STATUS.PAUSADO) {
      b.push(
        Botao({
          texto: t('espiral.avancar'),
          variante: 'fantasma',
          aoClicar: async () => {
            const ok = await abrirModal({ titulo: t('espiral.avancarTitulo'), conteudo: t('espiral.avancarTexto'), acoes: [{ texto: t('vitrine.secundario'), valor: false }, { texto: t('espiral.avancar'), variante: 'primario', valor: true }] });
            if (ok) mudar(R.avancar(r, agora()));
          },
        })
      );
    }
    controles.replaceChildren(...b);
  }

  function desenhar() {
    if (r.status === R.STATUS.FIM) return mostrarGrade();
    status.textContent = t(`espiral.status.${r.status}`);
    status.dataset.status = r.status;
    desenharTabela();
    desenharControles();
    tique();
  }

  function tique() {
    const t0 = agora();
    if (r.status === R.STATUS.RODANDO) {
      const novo = R.verificarPrazos(r, t0);
      if (novo !== r) return mudar(novo);
    }
    const resta = R.restanteRodada(r, t0);
    relogio.textContent = resta === null ? formatarRelogio(config.minutos * MIN) : formatarRelogio(resta, { paraCima: true });
    const aviso = R.emAviso(r, t0);
    corpo.dataset.aviso = String(aviso);
    if (aviso && !estavaEmAviso) {
      sons.contagem();
      host.transmitirEstados();
    }
    estavaEmAviso = aviso;
    if (r.status === R.STATUS.TROCA && config.autoAvancar && trocaEm !== null && t0 - trocaEm > 8000) mudar(R.avancar(r, t0));
  }

  function mostrarGrade() {
    if (gradeEl) return;
    const linhas = () => R.grade(r).map((l) => ({ id: l.grupo, nome: l.nome, celulas: l.celulas.map((c) => ({ ...c, coluna: c.prova })) }));
    gradeEl = Grade({
      titulo: t('espiral.titulo'),
      rotuloLinha: t('espiral.grupo'),
      colunas: provas.map((p) => ({ id: p.id, titulo: p.titulo })),
      linhas: linhas(),
      aoCorrigir: (g, p, qid, valor) => {
        r = R.corrigirManual(r, g, p, qid, valor);
        gradeEl.atualizar(linhas());
        guardar();
      },
      aoComentar: (g, p, texto) => {
        r = R.comentar(r, g, p, texto);
        gradeEl.atualizar(linhas());
        guardar();
      },
    });
    corpo.replaceChildren(h('p', { class: 'manuscrito espiral__fim' }, t('espiral.fim')), gradeEl);
    host.transmitirEstados();
    guardar();
  }

  const idResultado = novoId('res');
  const guardar = () =>
    salvar('resultados', { id: idResultado, titulo: t('espiral.titulo'), modalidade: 'espiral', data: new Date().toISOString(), provas: provas.map((p) => ({ id: p.id, titulo: p.titulo })), grade: R.grade(r), log: r.log });

  function teclado(e) {
    if (e.code === 'Space' && !e.target.closest?.('button, a, input, textarea')) {
      e.preventDefault();
      if (r.status === R.STATUS.RODANDO) mudar(R.pausar(r, agora()));
      else if (r.status === R.STATUS.PAUSADO) mudar(R.retomar(r, agora()));
    }
  }
  document.addEventListener('keydown', teclado);

  corpo.append(h('div', { class: 'espiral__painel' }, h('div', { class: 'pilha' }, status, relogio), h('div', { class: 'pilha' }, tabela, proxima)), controles);
  alvo.append(
    h(
      'div',
      { class: 'tela__topo buzzer-topo' },
      h('div', null, h('h1', { tabindex: '-1' }, t('espiral.titulo')), h('p', { class: 'tela__subtitulo' }, estacao ? t('espiral.dicaEstacao') : t('espiral.dicaGrupo'))),
      extraTopo,
      h('span', { class: 'etiqueta espiral__rodada', 'aria-live': 'polite' })
    ),
    corpo
  );
  const rodadaEl = alvo.querySelector('.espiral__rodada');
  const intervalo = setInterval(() => {
    tique();
    rodadaEl.textContent = t('espiral.rodada', { n: Math.min(r.rodada + 1, R.totalRodadas(r)), total: R.totalRodadas(r) });
  }, 250);
  const reenvio = setInterval(() => host.transmitirEstados(), 5000); // re-sincroniza o tempo dos aparelhos
  desenhar();
  return () => {
    clearInterval(intervalo);
    clearInterval(reenvio);
    document.removeEventListener('keydown', teclado);
  };
}
