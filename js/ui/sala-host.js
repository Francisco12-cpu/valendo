// Controlador do HOST (aparelho do professor). Liga transporte ↔ regras da sala ↔ jogo.
// O host valida tudo: cliente conhecido, ação inédita, tempo plausível; e cada aluno só
// recebe o que pode ver (o gabarito nunca sai antes da revelação).
import * as S from '../core/sala.js';
import { criarEmissor, decodificar, criarDeduplicador } from '../net/protocol.js';

const agora = () => performance.now();
const INTERVALO_PING = 2000;

// jogo: { paraAluno(clientId, t) → estado, aoAcao(clientId, acao, tHost), aoEntrar?(clientId) }
export function criarHostSala(transporte, { aoMudar = () => {} } = {}) {
  let sala = S.criarSala({ codigo: transporte.codigo });
  let jogo = null;
  const emitir = criarEmissor('h');
  const dedup = criarDeduplicador();
  const clientePorConexao = new Map();
  const conexaoPorCliente = new Map();

  const enviar = (clientId, tipo, dados) => {
    const cx = conexaoPorCliente.get(clientId);
    if (cx) transporte.enviar(cx, emitir(tipo, dados));
  };

  function estadoDe(clientId) {
    const c = sala.clientes[clientId];
    if (!c) return null;
    if (jogo) return jogo.paraAluno(clientId, agora());
    return { tipo: 'lobby', nome: c.nome, codigo: sala.codigo, participantes: S.conectados(sala).length };
  }

  function enviarEstado(clientId) {
    const estado = estadoDe(clientId);
    if (estado) enviar(clientId, 'estado', { estado });
  }

  function transmitirEstados() {
    for (const c of S.conectados(sala)) enviarEstado(c.clientId);
  }

  transporte.aoMensagem((cx, bruto) => {
    const { ok, msg } = decodificar(bruto);
    if (!ok || dedup.jaVisto(msg.id)) return;
    const t = agora();
    const clientId = clientePorConexao.get(cx);

    if (msg.tipo === 'entrar') {
      const r = S.entrar(sala, { clientId: msg.clientId, nome: msg.nome }, t);
      if (r.resultado !== 'ok' && r.resultado !== 'reconectou') {
        transporte.enviar(cx, emitir('recusado', { motivo: r.resultado }));
        return;
      }
      sala = r.sala;
      // Mesma pessoa numa conexão nova (reconectou): esquece a conexão antiga.
      const antiga = conexaoPorCliente.get(msg.clientId);
      if (antiga && antiga !== cx) clientePorConexao.delete(antiga);
      clientePorConexao.set(cx, msg.clientId);
      conexaoPorCliente.set(msg.clientId, cx);
      transporte.enviar(cx, emitir('bemvindo', { clientId: msg.clientId, nome: r.cliente.nome, codigo: sala.codigo, reconectou: r.resultado === 'reconectou' }));
      jogo?.aoEntrar?.(msg.clientId);
      enviarEstado(msg.clientId); // estado completo para quem entra ou volta
      if (!jogo) transmitirEstados(); // atualiza o "N na sala" de todos
      aoMudar();
      return;
    }
    if (!clientId) return; // sem "entrar" antes, nada vale

    if (msg.tipo === 'ping') {
      transporte.enviar(cx, emitir('pong', { t0: msg.t0, t1: t, t2: agora() }));
      sala = S.contato(sala, clientId, t);
    } else if (msg.tipo === 'pong' && msg.eco) {
      const c = sala.clientes[clientId];
      sala = S.atualizarSincronia(sala, clientId, { rtt: t - msg.t0, offset: c?.offset ?? 0 }, t);
      aoMudar();
    } else if (msg.tipo === 'acao' && msg.acao) {
      if (msg.acao.tipo === 'sincronia') {
        const c = sala.clientes[clientId];
        sala = S.atualizarSincronia(sala, clientId, { rtt: c?.rtt ?? msg.acao.rtt ?? null, offset: Number(msg.acao.offset) || 0 }, t);
        return;
      }
      const r = S.aceitarAcao(sala, clientId, msg.acao, t);
      sala = r.sala;
      transporte.enviar(cx, emitir('ack', { acaoId: msg.acao.id, ok: r.ok || r.motivo === 'duplicada', motivo: r.motivo }));
      if (r.ok && jogo) {
        const tHost = S.tempoNoHost(sala.clientes[clientId], msg.acao.tLocal, t);
        jogo.aoAcao(clientId, msg.acao, tHost);
      }
      aoMudar();
    } else if (msg.tipo === 'sair') {
      sala = S.desconectar(sala, clientId, t);
      aoMudar();
    }
  });

  transporte.aoDesconectar((cx) => {
    const clientId = clientePorConexao.get(cx);
    clientePorConexao.delete(cx);
    if (clientId && conexaoPorCliente.get(clientId) === cx) {
      conexaoPorCliente.delete(clientId);
      sala = S.desconectar(sala, clientId, agora());
      if (!jogo) transmitirEstados();
      aoMudar();
    }
  });

  // O host mede o RTT de cada um (não dá para o aluno mentir sobre isso para ganhar tempo).
  const pinger = setInterval(() => {
    for (const c of S.conectados(sala)) enviar(c.clientId, 'ping', { t0: agora() });
    aoMudar();
  }, INTERVALO_PING);

  return {
    get sala() {
      return sala;
    },
    get codigo() {
      return sala.codigo;
    },
    conectados: () => S.conectados(sala),
    sinal: (c) => S.sinal(c, agora()),
    trancar(valor) {
      sala = S.trancar(sala, valor, agora());
      aoMudar();
    },
    remover(clientId) {
      enviar(clientId, 'removido', {});
      const cx = conexaoPorCliente.get(clientId);
      sala = S.remover(sala, clientId, agora());
      conexaoPorCliente.delete(clientId);
      if (cx) clientePorConexao.delete(cx);
      transmitirEstados();
      aoMudar();
    },
    definirJogo(novo) {
      jogo = novo;
      transmitirEstados();
    },
    enviarEstado,
    transmitirEstados,
    fechar() {
      clearInterval(pinger);
      transporte.transmitir(emitir('erro', { motivo: 'sala-fechada' }));
      transporte.fechar();
    },
  };
}
