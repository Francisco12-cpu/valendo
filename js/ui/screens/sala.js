// #/sala — o professor abre uma sala: os alunos entram pelo celular (código ou QR).
// O aparelho do professor é o HOST com autoridade sobre tempo, pontos e trapaças.
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { abrirHost } from '../../net/transport.js';
import { gerarCodigo, MARGEM_EMPATE_REDE_MS } from '../../core/sala.js';
import * as Q from '../../core/quiz.js';
import * as R from '../../core/ritmo.js';
import { criarBuzzer, ESTADOS } from '../../core/buzzer.js';
import { formatarMs } from '../../core/clock.js';
import { quizExemplo } from '../../core/exemplos.js';
import { listarAtividades, salvarAtividade } from '../../storage/atividades.js';
import { lerAjustes, CORES_JOGADORES } from '../buzzer-ajustes.js';
import { criarHostSala } from '../sala-host.js';
import { jogarQuiz } from './jogo-quiz.js';
import { configEspiral, jogarEspiral } from './espiral-host.js';
import { configProva, jogarProva } from './prova-host.js';
import { sons, desbloquear } from '../../audio/sons.js';
import { Escolha } from '../components/escolha.js';
import { Switch } from '../components/switch.js';
import { Botao } from '../components/botao.js';
import { abrirModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { QRCodigo, LeitorQR } from '../components/qr.js';
import { icones } from '../components/icones.js';

export const titulo = () => t('sala.titulo');
const agora = () => performance.now();

export function linkDeEntrada(codigo, modo) {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/entrar?sala=${codigo}${modo === 'online' ? '' : `&modo=${modo}`}`;
}

export function render(alvo, params) {
  let host = null;
  let limparJogo = () => {};
  let limparLobby = () => {};
  const JOGOS = ['quiz', 'ritmo', 'buzzer', 'espiral', 'prova'];
  const escolhas = { jogo: JOGOS.includes(params.get('jogo')) ? params.get('jogo') : 'quiz', modo: params.get('modo') ?? 'online', atividadeId: '' };
  let espiral = null;
  let prova = null;
  let todasAtividades = [];

  // ---------- 1) Preparar ----------
  async function preparar() {
    todasAtividades = (await listarAtividades()).filter((a) => !a.erro && a.conteudo.perguntas.length);
    const atividades = todasAtividades;
    espiral = configEspiral(todasAtividades);
    prova = configProva();
    const blocoEspiral = h('div', { class: 'pilha' }, espiral.el);
    const blocoProva = h('div', { class: 'pilha' }, prova.el);
    const seletor = h('select', { id: 'sala-atividade', class: 'campo' }, atividades.map((a) => h('option', { value: a.id }, a.titulo)));
    if (!atividades.length) seletor.append(h('option', { value: '__exemplo' }, t('sala.usarExemplo')));
    escolhas.atividadeId = seletor.value;
    seletor.addEventListener('change', () => (escolhas.atividadeId = seletor.value));
    const blocoAtividade = h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'sala-atividade', class: 'rotulo' }, t('sala.atividade')), seletor);
    const mostrar = () => {
      blocoAtividade.hidden = escolhas.jogo === 'buzzer' || escolhas.jogo === 'espiral';
      blocoEspiral.hidden = escolhas.jogo !== 'espiral';
      blocoProva.hidden = escolhas.jogo !== 'prova';
    };
    mostrar();

    alvo.append(
      h('div', { class: 'tela__topo' }, h('h1', { tabindex: '-1' }, t('sala.titulo')), h('p', { class: 'tela__subtitulo' }, t('sala.subtitulo'))),
      h(
        'div',
        { class: 'buzzer-ajustes' },
        h(
          'section',
          { class: 'cartao buzzer-bloco', 'aria-labelledby': 'sala-o-que' },
          h('h2', { id: 'sala-o-que' }, t('sala.oQue')),
          Escolha({
            rotulo: t('sala.tipo'),
            valor: escolhas.jogo,
            aoMudar: (v) => ((escolhas.jogo = v), mostrar()),
            opcoes: [
              { valor: 'quiz', texto: t('sala.quizAoVivo'), descricao: t('sala.quizAoVivoDesc') },
              { valor: 'ritmo', texto: t('sala.ritmo'), descricao: t('sala.ritmoDesc') },
              { valor: 'buzzer', texto: t('sala.buzzerC'), descricao: t('sala.buzzerCDesc') },
              { valor: 'espiral', texto: t('sala.espiral'), descricao: t('sala.espiralDesc') },
              { valor: 'prova', texto: t('sala.prova'), descricao: t('sala.provaDesc') },
            ],
          }),
          blocoAtividade,
          blocoEspiral,
          blocoProva
        ),
        h(
          'section',
          { class: 'cartao buzzer-bloco', 'aria-labelledby': 'sala-como' },
          h('h2', { id: 'sala-como' }, t('sala.como')),
          Escolha({
            rotulo: t('sala.modo'),
            valor: escolhas.modo,
            aoMudar: (v) => (escolhas.modo = v),
            opcoes: [
              { valor: 'online', texto: t('sala.modoOnline'), descricao: t('sala.modoOnlineDesc') },
              { valor: 'qr', texto: t('sala.modoQR'), descricao: t('sala.modoQRDesc') },
              { valor: 'local', texto: t('sala.modoLocal'), descricao: t('sala.modoLocalDesc') },
            ],
          }),
          h('details', { class: 'avisos-rede' }, h('summary', null, t('sala.limitacoes')), h('ul', null, ['sala.lim1', 'sala.lim2', 'sala.lim3'].map((k) => h('li', null, t(k)))))
        )
      ),
      h('div', { class: 'linha buzzer-rodape' }, Botao({ texto: t('sala.abrir'), variante: 'primario', tamanho: 'grande', icone: 'raio', aoClicar: abrirSala }))
    );
  }

  async function abrirSala() {
    const botao = alvo.querySelector('.buzzer-rodape .botao');
    if (escolhas.jogo === 'espiral' && !espiral.valores.provas.length) return toast(t('espiral.escolhaProvas'), { tipo: 'aviso' });
    botao.disabled = true;
    toast(t('sala.abrindo'));
    let transporte;
    for (let tentativa = 0; tentativa < 3 && !transporte; tentativa++) {
      try {
        transporte = await abrirHost(escolhas.modo, { codigo: gerarCodigo() });
      } catch (erro) {
        if (erro.message !== 'codigo-em-uso' || tentativa === 2) {
          botao.disabled = false;
          toast(t(`sala.erro.${erro.message}`) === `sala.erro.${erro.message}` ? t('sala.erro.generico') : t(`sala.erro.${erro.message}`), { tipo: 'erro', duracao: 7000 });
          return;
        }
      }
    }
    host = criarHostSala(transporte, { aoMudar: () => desenharLobby() });
    alvo.replaceChildren();
    lobby(transporte);
  }

  // ---------- 2) Lobby ----------
  let desenharLobby = () => {};
  function lobby(transporte) {
    const lista = h('ul', { class: 'sala-alunos', role: 'list' });
    const contagem = h('p', { class: 'etiqueta sala-contagem', 'aria-live': 'polite' });
    const trava = Switch({ rotulo: t('sala.trancar'), ligado: false, aoMudar: (v) => host.trancar(v) });
    const comecar = Botao({ texto: t('sala.comecar'), variante: 'primario', tamanho: 'grande', icone: 'raio', aoClicar: iniciarJogo });
    const link = linkDeEntrada(host.codigo, escolhas.modo);

    desenharLobby = () => {
      const alunos = Object.values(host.sala.clientes);
      const on = host.conectados().length;
      contagem.textContent = t('sala.naSala', { n: on });
      const minimo = escolhas.jogo === 'buzzer' ? 2 : escolhas.jogo === 'espiral' && espiral.valores.modo === 'estacao' ? espiral.valores.provas.length : 1;
      comecar.disabled = on < minimo;
      lista.replaceChildren(
        ...alunos.map((c) => {
          const sinal = host.sinal(c);
          return h(
            'li',
            { class: 'sala-aluno', 'data-sinal': sinal },
            h('span', { class: 'sala-aluno__sinal', title: t(`sala.sinal.${sinal}`), 'aria-label': t(`sala.sinal.${sinal}`) }),
            h('span', { class: 'sala-aluno__nome' }, c.nome),
            c.rtt !== null ? h('span', { class: 'texto-suave sala-aluno__rtt' }, formatarMs(c.rtt)) : null,
            Botao({ icone: 'fechar', variante: 'fantasma', rotulo: t('sala.remover', { nome: c.nome }), aoClicar: () => host.remover(c.clientId) })
          );
        })
      );
    };

    const entrada =
      escolhas.modo === 'qr'
        ? h('div', { class: 'pilha sala-entrada' }, h('p', null, t('sala.qrInstrucoes')), Botao({ texto: t('sala.adicionarAparelho'), variante: 'amarelo', icone: 'mais', aoClicar: () => adicionarPorQR(transporte) }))
        : h(
            'div',
            { class: 'sala-entrada' },
            h('div', { class: 'pilha' }, h('p', { class: 'texto-suave' }, t('sala.entreEm')), h('p', { class: 'sala-link' }, link.replace(/^https?:\/\//, '').replace(/\?sala=.*/, '')), h('p', { class: 'texto-suave' }, t('sala.codigo')), h('p', { class: 'sala-codigo', 'aria-label': [...host.codigo].join(' ') }, host.codigo)),
            QRCodigo(link, { rotulo: t('sala.qrEntrar'), tamanho: '14rem' })
          );

    alvo.append(
      h('div', { class: 'tela__topo buzzer-topo' }, h('div', null, h('h1', { tabindex: '-1' }, t('sala.lobby')), h('p', { class: 'tela__subtitulo' }, t(`sala.lobbyDica.${escolhas.jogo}`))), contagem),
      h('div', { class: 'sala-lobby' }, h('section', { class: 'cartao' }, entrada), h('section', { class: 'cartao pilha', 'aria-label': t('sala.alunos') }, h('div', { class: 'linha' }, trava), lista)),
      h('div', { class: 'linha buzzer-rodape' }, comecar, Botao({ texto: t('sala.fechar'), variante: 'fantasma', aoClicar: () => (location.hash = '#/') }))
    );
    desenharLobby();
    const relogioLobby = setInterval(() => desenharLobby(), 2000);
    limparLobby = () => clearInterval(relogioLobby);
  }

  async function adicionarPorQR(transporte) {
    const convite = await transporte.novoConvite();
    let leitor = null;
    const corpo = h('div', { class: 'pilha' }, h('p', null, t('sala.qrPasso1')), QRCodigo(convite.texto, { tamanho: '18rem' }), h('details', { class: 'leitor__colar' }, h('summary', null, t('qr.copiarCodigo')), h('textarea', { class: 'campo campo--area', rows: 3, readonly: true, 'aria-label': t('qr.copiarCodigo') }, convite.texto)));
    const passo2 = Botao({
      texto: t('sala.qrLerResposta'),
      variante: 'primario',
      aoClicar: () => {
        passo2.hidden = true;
        leitor = LeitorQR({
          dica: t('sala.qrAponteResposta'),
          aoLer: async (texto) => {
            try {
              await convite.aceitar(texto);
              toast(t('sala.qrConectando'), { tipo: 'sucesso' });
              corpo.closest('dialog')?.close();
            } catch {
              toast(t('qr.invalido'), { tipo: 'erro' });
            }
          },
        });
        corpo.append(leitor);
      },
    });
    corpo.append(passo2);
    await abrirModal({ titulo: t('sala.adicionarAparelho'), conteudo: corpo });
    leitor?.parar();
  }

  // ---------- 3) Jogo ----------
  async function iniciarJogo() {
    limparLobby();
    const conectados = host.conectados();
    const participantes = conectados.map((c, i) => ({ id: c.clientId, nome: c.nome, cor: CORES_JOGADORES[i % 8] }));
    let atividade = null;
    if (escolhas.jogo !== 'buzzer' && escolhas.jogo !== 'espiral') {
      if (escolhas.atividadeId === '__exemplo' || !escolhas.atividadeId) {
        atividade = quizExemplo();
        await salvarAtividade(atividade);
      } else atividade = (await listarAtividades()).find((a) => a.id === escolhas.atividadeId);
    }
    alvo.replaceChildren();
    const extraTopo = h('span', { class: 'etiqueta sala-topo' }, `${t('sala.codigoCurto')} ${host.codigo}`);
    if (escolhas.jogo === 'quiz') {
      limparJogo = jogarQuiz(alvo, atividade, participantes, {
        remoto: true,
        sairHref: '#/',
        extraTopo,
        aoMudar: () => host.transmitirEstados(),
        aoPronto: ({ executar, partida }) =>
          host.definirJogo({
            paraAluno: (id, tt) => (partida().pontos[id] === undefined ? { tipo: 'espera', motivo: 'comecou' } : Q.paraAluno(partida(), id, tt)),
            aoAcao: (id, acao, tHost) => acao.tipo === 'responder' && executar('responder', { pid: id, resposta: acao.resposta, t: tHost }),
          }),
      });
    } else if (escolhas.jogo === 'ritmo') limparJogo = jogarRitmo(atividade, participantes, extraTopo);
    else if (escolhas.jogo === 'espiral') limparJogo = jogarEspiral(alvo, host, espiral.valores, todasAtividades, participantes, extraTopo);
    else if (escolhas.jogo === 'prova') limparJogo = jogarProva(alvo, host, prova.valores, atividade, participantes, extraTopo);
    else limparJogo = jogarBuzzerC(participantes.slice(0, 8), extraTopo);
  }

  // Quiz no seu ritmo: o professor acompanha o progresso de cada um.
  function jogarRitmo(atividade, participantes, extraTopo) {
    let r = R.criarRitmo(atividade);
    for (const p of participantes) r = R.entrarNoRitmo(r, p.id, agora());
    const tabela = h('ol', { class: 'ritmo-lista', role: 'list' });
    const desenhar = () => {
      const nomes = Object.fromEntries(Object.values(host.sala.clientes).map((c) => [c.clientId, c.nome]));
      const prog = R.progresso(r).sort((a, b) => b.pontos - a.pontos);
      tabela.replaceChildren(
        ...prog.map((x) =>
          h(
            'li',
            { class: 'ritmo-item', 'data-terminou': String(x.terminou) },
            h('span', { class: 'ritmo-item__nome' }, nomes[x.pid] ?? '?'),
            h('span', { class: 'ritmo-item__barra', style: { '--valor': x.respondidas / x.total }, 'aria-hidden': 'true' }),
            h('span', { class: 'ritmo-item__num' }, t('sala.ritmoProgresso', { n: x.respondidas, total: x.total })),
            h('span', { class: 'ritmo-item__pts' }, String(x.pontos))
          )
        )
      );
    };
    host.definirJogo({
      paraAluno: (id) => R.paraAlunoRitmo(r, id),
      aoEntrar: (id) => {
        r = R.entrarNoRitmo(r, id, agora());
        desenhar();
      },
      aoAcao: (id, acao, tHost) => {
        if (acao.tipo !== 'ritmo') return;
        r = R.responderNoRitmo(r, id, acao.qid, acao.resposta, tHost);
        host.enviarEstado(id);
        desenhar();
      },
    });
    const encerrar = Botao({
      texto: t('sala.encerrar'),
      variante: 'perigo',
      aoClicar: () => {
        r = R.encerrarRitmo(r);
        host.transmitirEstados();
        desenhar();
        sons.vitoria();
        encerrar.disabled = true;
      },
    });
    alvo.append(
      h('div', { class: 'tela__topo buzzer-topo' }, h('div', null, h('h1', { tabindex: '-1' }, atividade.titulo), h('p', { class: 'tela__subtitulo' }, t('sala.ritmoDica'))), extraTopo),
      tabela,
      h('div', { class: 'linha buzzer-rodape' }, encerrar, h('a', { class: 'botao botao--fantasma', href: '#/' }, t('sala.fechar')))
    );
    desenhar();
    const timer = setInterval(desenhar, 2000);
    return () => clearInterval(timer);
  }

  // Buzzer método C: cada um no seu celular. A largada é marcada num horário do HOST e cada
  // celular converte para o seu relógio: todos veem o sinal juntos, mesmo com Wi-Fi diferente.
  function jogarBuzzerC(jogadores, extraTopo) {
    const ajustes = lerAjustes();
    const buzzer = criarBuzzer(
      jogadores.map((j) => j.id),
      { ...ajustes, metodo: 'B', margemEmpateMs: Math.max(ajustes.margemEmpateMs, MARGEM_EMPATE_REDE_MS) }
    );
    const porId = new Map(jogadores.map((j) => [j.id, j]));
    let largadaEm = null;
    let timer = null;
    const cartoes = new Map();
    const status = h('p', { class: 'jogo__sinal sala-buzzer__status', 'aria-live': 'assertive' });
    const principal = Botao({ texto: t('buzzer.comecar'), variante: 'primario', tamanho: 'grande', aoClicar: () => acaoPrincipal() });
    const juiz = h('ol', { class: 'sala-buzzer__juiz' });

    function estadoAluno(id) {
      const s = buzzer.instantaneo();
      const base = { tipo: 'buzzer', fase: s.estado, nome: porId.get(id)?.nome };
      if (!porId.has(id)) return { ...base, espectador: true };
      if (s.estado === ESTADOS.ARMADO) return { ...base, largadaEmHost: largadaEm, contagem: ajustes.gatilho === 'contagem' };
      if (s.estado === ESTADOS.VALENDO) return { ...base, largadaEmHost: largadaEm, agiu: Boolean(s.acoes[id]) };
      if (s.estado === ESTADOS.RESULTADO && s.resultado) {
        const r = s.resultado;
        const pos = r.ordem.findIndex((o) => o.jogador === id);
        return { ...base, resultado: { tipo: r.tipo, venceu: r.vencedores.includes(id), posicao: pos >= 0 ? pos + 1 : null, tempo: r.ordem[pos]?.tempo ?? null, queimou: r.queimas.some((q) => q.jogador === id), vencedores: r.vencedores.map((v) => porId.get(v)?.nome) } };
      }
      return { ...base, queimou: s.queimas.some((q) => q.jogador === id) };
    }

    function agendarLargada(espera) {
      largadaEm = agora() + espera;
      clearTimeout(timer);
      host.transmitirEstados();
      timer = setTimeout(function esperarLargada() {
        if (agora() < largadaEm) return (timer = setTimeout(esperarLargada, Math.max(1, largadaEm - agora())));
        processar(buzzer.disparar(largadaEm));
        sons.valendo();
        timer = setInterval(() => processar(buzzer.verificarPrazo(agora())), 50);
      }, Math.max(0, espera));
    }

    function processar(eventos) {
      for (const e of eventos) {
        if (e.tipo === 'estado' && e.estado === ESTADOS.ARMADO) {
          const s = buzzer.instantaneo();
          if (ajustes.gatilho !== 'manual') agendarLargada(Math.max(800, s.esperaMs ?? 2000));
          else largadaEm = null;
        }
        if (e.tipo === 'estado' && e.anterior === ESTADOS.VALENDO) clearInterval(timer);
        if (e.tipo === 'queima') sons.queima();
        if (e.tipo === 'resultado') {
          clearInterval(timer);
          if (e.resultado.tipo === 'vencedor') sons.vitoria();
        }
      }
      desenhar();
      host.transmitirEstados();
    }

    function acaoPrincipal() {
      desbloquear();
      const s = buzzer.instantaneo();
      if (s.estado === ESTADOS.ARMADO && ajustes.gatilho === 'manual') return agendarLargada(400);
      if (s.estado === ESTADOS.OCIOSO || s.estado === ESTADOS.RESULTADO) processar(buzzer.iniciar());
    }

    function desenhar() {
      const s = buzzer.instantaneo();
      for (const j of jogadores) {
        const c = cartoes.get(j.id);
        const r = s.resultado;
        let texto = t('sala.buzzerPronto');
        let modo = 'espera';
        if (s.queimas.some((q) => q.jogador === j.id)) [texto, modo] = [t('buzzer.queimou'), 'queimou'];
        if (s.acoes[j.id]) [texto, modo] = [t('buzzer.registrado'), 'agiu'];
        if (s.estado === ESTADOS.RESULTADO && r?.ordem) {
          const pos = r.ordem.findIndex((o) => o.jogador === j.id);
          if (r.vencedores.includes(j.id)) [texto, modo] = [r.tipo === 'empate' ? t('buzzer.empatou') : t('buzzer.primeiro'), 'venceu'];
          else if (pos >= 0) [texto, modo] = [`${pos + 1}º · ${formatarMs(r.ordem[pos].diferenca, { sinal: true })}`, 'perdeu'];
        }
        c.status.textContent = texto;
        c.el.dataset.modo = modo;
      }
      const textos = {
        [ESTADOS.OCIOSO]: t('buzzer.pronto'),
        [ESTADOS.ARMADO]: ajustes.gatilho === 'manual' && largadaEm === null ? t('buzzer.aguardandoProfessor') : t('buzzer.preparese'),
        [ESTADOS.VALENDO]: t('buzzer.valendo'),
      };
      if (s.estado === ESTADOS.RESULTADO) {
        const r = s.resultado;
        status.textContent = r.tipo === 'vencedor' ? t('buzzer.venceu', { nome: porId.get(r.vencedores[0]).nome }) : r.tipo === 'empate' ? t('buzzer.empate', { nomes: r.vencedores.map((v) => porId.get(v).nome).join(' e ') }) : r.tipo === 'queima' ? t('buzzer.queimouDecida', { nome: porId.get(r.jogador).nome }) : t('buzzer.ninguem');
        juiz.replaceChildren(...(r.ordem ?? []).map((o, i) => h('li', null, `${i + 1}º ${porId.get(o.jogador).nome} — ${formatarMs(o.tempo)}${i ? ` (${formatarMs(o.diferenca, { sinal: true })})` : ''}`)));
      } else {
        status.textContent = textos[s.estado] ?? '';
        juiz.replaceChildren();
      }
      principal.hidden = !(s.estado === ESTADOS.OCIOSO || s.estado === ESTADOS.RESULTADO || (s.estado === ESTADOS.ARMADO && ajustes.gatilho === 'manual' && largadaEm === null));
      principal.querySelector('span').textContent = s.estado === ESTADOS.ARMADO ? t('buzzer.dispararAgora') : s.estado === ESTADOS.RESULTADO ? t('buzzer.deNovo') : t('buzzer.comecar');
    }

    host.definirJogo({
      paraAluno: (id) => estadoAluno(id),
      aoAcao: (id, acao, tHost) => {
        if (acao.tipo !== 'buzzer' || !porId.has(id)) return;
        processar([...buzzer.pressionar(id, `rede-${acao.id}`, tHost), ...buzzer.soltar(id, `rede-${acao.id}`, tHost)]);
      },
    });

    const grade = h(
      'ul',
      { class: 'sala-buzzer', role: 'list' },
      jogadores.map((j) => {
        const statusJ = h('span', { class: 'sala-buzzer__estado' });
        const el = h('li', { class: 'sala-buzzer__jogador', style: { '--cor': j.cor } }, h('span', { class: 'sala-buzzer__nome manuscrito' }, j.nome), statusJ);
        cartoes.set(j.id, { el, status: statusJ });
        return el;
      })
    );
    function teclado(e) {
      if (e.code === 'Space' && !e.target.closest?.('button, a, input')) {
        e.preventDefault();
        if (!e.repeat) acaoPrincipal();
      }
    }
    document.addEventListener('keydown', teclado);
    alvo.append(
      h('div', { class: 'tela__topo buzzer-topo' }, h('div', null, h('h1', { tabindex: '-1' }, t('sala.buzzerC')), h('p', { class: 'tela__subtitulo' }, t('sala.buzzerCDica', { ms: Math.max(ajustes.margemEmpateMs, MARGEM_EMPATE_REDE_MS) }))), extraTopo),
      grade,
      h('div', { class: 'pilha sala-buzzer__centro' }, status, principal, juiz),
      h('div', { class: 'linha buzzer-rodape' }, h('a', { class: 'botao botao--fantasma', href: '#/' }, t('sala.fechar')))
    );
    desenhar();
    return () => {
      clearTimeout(timer);
      clearInterval(timer);
      document.removeEventListener('keydown', teclado);
    };
  }

  preparar();

  return () => {
    limparLobby();
    limparJogo?.();
    host?.fechar();
  };
}
