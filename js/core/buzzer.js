// Máquina de estados do buzzer (§6). Lógica pura: não toca no DOM, na rede nem em timers.
// A interface informa os toques com o event.timeStamp e chama disparar() no frame da largada.
//
//   OCIOSO → PREPARANDO → ARMADO (espera) → VALENDO → RESULTADO
//
// Métodos de resposta:
//   A — segurar e soltar primeiro: todos seguram; vence quem SOLTA primeiro depois do sinal.
//   B — apertar primeiro: vence quem APERTA primeiro depois do sinal.
// Multitoque: cada jogador pode ter vários dedos (pointerId). No método A, só conta
// quando o último dedo sai; no B, só o primeiro dedo que encosta.

export const ESTADOS = Object.freeze({
  OCIOSO: 'ocioso',
  PREPARANDO: 'preparando',
  ARMADO: 'armado',
  VALENDO: 'valendo',
  RESULTADO: 'resultado',
});

export const METODOS = ['A', 'B'];
export const GATILHOS = ['contagem', 'aleatorio', 'manual'];
export const REGRAS_QUEIMA = ['aviso', 'anular', 'penalidade', 'eliminar', 'professor'];
export const MIN_JOGADORES = 2;
export const MAX_JOGADORES = 8;

export const PADRAO = Object.freeze({
  metodo: 'B',
  gatilho: 'aleatorio',
  contagem: 3, // segundos (gatilho "contagem")
  esperaMin: 1500, // ms (gatilho "aleatorio")
  esperaMax: 4000,
  queima: 'aviso',
  penalidadeMs: 500,
  margemEmpateMs: 10,
  janelaMs: 1500, // depois do 1º, espera os outros por até isso (para o Juiz de dúvida)
  tempoMaximoMs: 15000, // ninguém agiu: encerra a rodada
});

const limitar = (v, min, max, padrao) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao);

export function normalizarConfig(config = {}) {
  const c = { ...PADRAO, ...config };
  return {
    metodo: METODOS.includes(c.metodo) ? c.metodo : PADRAO.metodo,
    gatilho: GATILHOS.includes(c.gatilho) ? c.gatilho : PADRAO.gatilho,
    contagem: limitar(c.contagem, 1, 10, PADRAO.contagem),
    esperaMin: limitar(c.esperaMin, 0, 30000, PADRAO.esperaMin),
    esperaMax: Math.max(limitar(c.esperaMin, 0, 30000, PADRAO.esperaMin), limitar(c.esperaMax, 0, 30000, PADRAO.esperaMax)),
    queima: REGRAS_QUEIMA.includes(c.queima) ? c.queima : PADRAO.queima,
    penalidadeMs: limitar(c.penalidadeMs, 0, 10000, PADRAO.penalidadeMs),
    margemEmpateMs: limitar(c.margemEmpateMs, 0, 1000, PADRAO.margemEmpateMs),
    janelaMs: limitar(c.janelaMs, 0, 10000, PADRAO.janelaMs),
    tempoMaximoMs: limitar(c.tempoMaximoMs, 1000, 600000, PADRAO.tempoMaximoMs),
  };
}

export function criarBuzzer(jogadores, configuracao = {}, { rng = Math.random } = {}) {
  if (!Array.isArray(jogadores) || jogadores.length < MIN_JOGADORES || jogadores.length > MAX_JOGADORES) {
    throw new RangeError(`O buzzer precisa de ${MIN_JOGADORES} a ${MAX_JOGADORES} jogadores.`);
  }
  if (new Set(jogadores).size !== jogadores.length) throw new Error('Jogadores com id repetido.');

  const config = normalizarConfig(configuracao);
  const ouvintes = new Set();
  const dedos = new Map(jogadores.map((id) => [id, new Set()]));

  let estado = ESTADOS.OCIOSO;
  let rodada = 0;
  let participantes = new Set(jogadores); // quem joga esta rodada (desempate usa só os empatados)
  let ativos = new Set(); // participantes ainda não eliminados
  let eliminados = new Set();
  let penalizados = new Set();
  let queimas = [];
  let acoes = new Map(); // id → { bruto, tempo, penalizado }
  let t0 = null;
  let primeiraAcao = null;
  let esperaMs = null;
  let resultado = null;
  let eventos = [];

  // ---------- eventos ----------
  function emitir(evento) {
    eventos.push(evento);
    for (const fn of ouvintes) fn(evento);
  }

  function mudar(novo) {
    const anterior = estado;
    estado = novo;
    emitir({ tipo: 'estado', estado: novo, anterior });
  }

  function lote(fn) {
    eventos = [];
    fn();
    return eventos;
  }

  const segurando = (id) => dedos.get(id).size > 0;

  // ---------- rodada ----------
  function comecarRodada(somente) {
    rodada += 1;
    participantes = new Set(somente ?? jogadores);
    ativos = new Set(participantes);
    eliminados = new Set();
    penalizados = new Set();
    queimas = [];
    acoes = new Map();
    t0 = null;
    primeiraAcao = null;
    esperaMs = null;
    resultado = null;
    mudar(ESTADOS.PREPARANDO);
    if (config.metodo === 'B') armar();
    else verificarProntos();
  }

  function verificarProntos() {
    if (estado !== ESTADOS.PREPARANDO) return;
    if (ativos.size > 0 && [...ativos].every(segurando)) armar();
  }

  function armar() {
    if (config.gatilho === 'aleatorio') esperaMs = config.esperaMin + rng() * (config.esperaMax - config.esperaMin);
    else if (config.gatilho === 'contagem') esperaMs = config.contagem * 1000;
    else esperaMs = null; // manual: o professor dispara
    mudar(ESTADOS.ARMADO);
  }

  function eliminar(id) {
    ativos.delete(id);
    eliminados.add(id);
    emitir({ tipo: 'eliminado', jogador: id });
    if (ativos.size === 0) return finalizar();
    if (estado === ESTADOS.PREPARANDO) verificarProntos();
    if (estado === ESTADOS.VALENDO) verificarFim();
  }

  function queimar(id, t) {
    const regra = config.queima;
    queimas.push({ jogador: id, t, regra });
    emitir({ tipo: 'queima', jogador: id, regra });

    if (regra === 'penalidade') penalizados.add(id);
    else if (regra === 'eliminar') eliminar(id);
    else if (regra === 'anular') {
      emitir({ tipo: 'anulada', jogador: id });
      comecarRodada(participantes);
    } else if (regra === 'professor') {
      resultado = montarResultado({ tipo: 'queima', jogador: id });
      mudar(ESTADOS.RESULTADO);
      emitir({ tipo: 'resultado', resultado });
    }
  }

  function registrarAcao(id, t) {
    const bruto = t - t0;
    const penalizado = penalizados.has(id);
    const tempo = bruto + (penalizado ? config.penalidadeMs : 0);
    acoes.set(id, { bruto, tempo, penalizado });
    if (primeiraAcao === null) primeiraAcao = t;
    emitir({ tipo: 'acao', jogador: id, tempo, bruto, penalizado });
    verificarFim();
  }

  function verificarFim() {
    if (estado !== ESTADOS.VALENDO) return;
    if ([...ativos].every((id) => acoes.has(id))) finalizar();
  }

  function montarResultado(extra) {
    const ordem = [...acoes.entries()]
      .map(([jogador, a]) => ({ jogador, ...a }))
      .sort((x, y) => x.tempo - y.tempo || x.bruto - y.bruto);
    const melhor = ordem[0]?.tempo;
    for (const item of ordem) item.diferenca = item.tempo - melhor;
    return {
      rodada,
      ordem,
      vencedores: [],
      queimas: [...queimas],
      eliminados: [...eliminados],
      naoAgiram: [...ativos].filter((id) => !acoes.has(id)),
      participantes: [...participantes],
      margemEmpateMs: config.margemEmpateMs,
      ...extra,
    };
  }

  function finalizar() {
    if (estado === ESTADOS.RESULTADO || estado === ESTADOS.OCIOSO) return;
    const r = montarResultado({});
    if (r.ordem.length === 0) r.tipo = 'ninguem';
    else {
      // Empate técnico: diferença menor que a margem em relação ao primeiro.
      r.vencedores = r.ordem.filter((o) => o.diferenca === 0 || o.diferenca < config.margemEmpateMs).map((o) => o.jogador);
      r.tipo = r.vencedores.length > 1 ? 'empate' : 'vencedor';
    }
    resultado = r;
    mudar(ESTADOS.RESULTADO);
    emitir({ tipo: 'resultado', resultado });
  }

  // ---------- API pública ----------
  return {
    config,
    jogadores: [...jogadores],

    aoEvento(fn) {
      ouvintes.add(fn);
      return () => ouvintes.delete(fn);
    },

    get estado() {
      return estado;
    },

    instantaneo() {
      return {
        estado,
        rodada,
        participantes: [...participantes],
        ativos: [...ativos],
        eliminados: [...eliminados],
        prontos: [...ativos].filter(segurando),
        segurando: jogadores.filter(segurando),
        penalizados: [...penalizados],
        queimas: [...queimas],
        acoes: Object.fromEntries(acoes),
        esperaMs,
        t0,
        resultado,
      };
    },

    // Começa uma rodada com todos (reinício rápido também usa isto).
    iniciar() {
      return lote(() => comecarRodada());
    },

    // Largada: chamar no frame em que o sinal aparece, com o timestamp do requestAnimationFrame.
    disparar(t) {
      return lote(() => {
        if (estado !== ESTADOS.ARMADO) return;
        t0 = t;
        mudar(ESTADOS.VALENDO);
      });
    },

    pressionar(id, pointerId, t) {
      return lote(() => {
        const lista = dedos.get(id);
        if (!lista || lista.has(pointerId)) return;
        const primeiroDedo = lista.size === 0;
        lista.add(pointerId);
        if (!ativos.has(id) || !primeiroDedo) return;

        if (config.metodo === 'A') {
          if (estado === ESTADOS.PREPARANDO || estado === ESTADOS.ARMADO) emitir({ tipo: 'pronto', jogador: id, pronto: true });
          verificarProntos();
          return;
        }
        // Método B
        if (estado === ESTADOS.ARMADO) queimar(id, t);
        else if (estado === ESTADOS.VALENDO && !acoes.has(id)) {
          if (t < t0) queimar(id, t); // o toque aconteceu antes do sinal aparecer
          else registrarAcao(id, t);
        }
      });
    },

    // cancelado = pointercancel (o sistema tirou o dedo): não conta como ação nem como queima.
    soltar(id, pointerId, t, { cancelado = false } = {}) {
      return lote(() => {
        const lista = dedos.get(id);
        if (!lista || !lista.delete(pointerId)) return;
        if (lista.size > 0 || !ativos.has(id) || config.metodo !== 'A') return;

        if (estado === ESTADOS.PREPARANDO) emitir({ tipo: 'pronto', jogador: id, pronto: false });
        else if (estado === ESTADOS.ARMADO) {
          emitir({ tipo: 'pronto', jogador: id, pronto: false });
          if (!cancelado) queimar(id, t);
        } else if (estado === ESTADOS.VALENDO && !cancelado && !acoes.has(id)) {
          if (t < t0) queimar(id, t);
          else registrarAcao(id, t);
        }
      });
    },

    // A interface chama de tempos em tempos durante o VALENDO.
    prazo() {
      if (estado !== ESTADOS.VALENDO) return null;
      return primeiraAcao !== null ? primeiraAcao + config.janelaMs : t0 + config.tempoMaximoMs;
    },

    verificarPrazo(t) {
      return lote(() => {
        const limite = this.prazo();
        if (limite !== null && t >= limite) finalizar();
      });
    },

    finalizar() {
      return lote(finalizar);
    },

    // Depois de uma queima com regra "professor": 'repetir' ou 'eliminar' quem queimou.
    decidir(acao) {
      return lote(() => {
        if (estado !== ESTADOS.RESULTADO || resultado?.tipo !== 'queima') return;
        const todos = [...participantes];
        if (acao === 'eliminar') {
          const restantes = todos.filter((id) => id !== resultado.jogador);
          comecarRodada(restantes.length ? restantes : todos);
        } else comecarRodada(todos);
      });
    },

    // Nova rodada só com os empatados.
    desempatar() {
      return lote(() => {
        if (estado !== ESTADOS.RESULTADO || resultado?.tipo !== 'empate') return;
        comecarRodada(resultado.vencedores);
      });
    },

    parar() {
      return lote(() => {
        if (estado !== ESTADOS.OCIOSO) mudar(ESTADOS.OCIOSO);
      });
    },
  };
}
