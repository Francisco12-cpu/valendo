// Controlador do ALUNO: conecta, sincroniza o relógio (8 pings, mediana), envia ações com
// id único e reenvia as pendentes depois de reconectar (o host descarta repetidas).
// O clientId fica no sessionStorage: recarregar ou cair e voltar = mesma pessoa.
import { conectar } from '../net/transport.js';
import { criarEmissor, decodificar } from '../net/protocol.js';
import { sincronizar } from '../core/clock.js';
import { novoId } from '../core/ids.js';

const agora = () => performance.now();
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export function clientIdDaAba() {
  try {
    let id = sessionStorage.getItem('valendo.clientId');
    if (!id) {
      id = novoId('cli');
      sessionStorage.setItem('valendo.clientId', id);
    }
    return id;
  } catch {
    return novoId('cli');
  }
}

// opcoes: { modo, codigo, convite?, aoResposta?, nome, aoEstado(estado), aoStatus(status, detalhe) }
export function criarClienteSala(opcoes) {
  const { modo, codigo, nome, aoEstado, aoStatus } = opcoes;
  const clientId = clientIdDaAba();
  const emitir = criarEmissor('a');
  const pendentes = new Map(); // acaoId → acao (até o ack chegar)
  let transporte = null;
  let offset = 0;
  let encerrado = false;
  let tentativas = 0;
  const amostras = [];
  const pingsAbertos = new Map();

  const mandar = (tipo, dados) => transporte?.enviar(emitir(tipo, dados));

  let ressincronia = null;
  async function sincronizarRelogio(quantos = 8) {
    amostras.length = 0;
    for (let i = 0; i < quantos && !encerrado; i++) {
      const t0 = agora();
      pingsAbertos.set(t0, true);
      mandar('ping', { t0 });
      await esperar(120);
    }
    await esperar(400);
    const s = sincronizar(amostras);
    if (s) {
      offset = s.offset;
      mandar('acao', { acao: { id: novoId('sync'), tipo: 'sincronia', offset: s.offset, rtt: s.rtt } });
    }
  }

  function aoMensagem(bruto) {
    const { ok, msg } = decodificar(bruto);
    if (!ok) return;
    if (msg.tipo === 'bemvindo') {
      tentativas = 0;
      aoStatus('conectado', { nome: msg.nome, reconectou: msg.reconectou });
      for (const acao of pendentes.values()) mandar('acao', { acao }); // reenvia o que não teve ack
      sincronizarRelogio();
      // Relógios andam diferente: ressincroniza de tempos em tempos.
      clearInterval(ressincronia);
      ressincronia = setInterval(() => !encerrado && sincronizarRelogio(6), 20000);
    } else if (msg.tipo === 'estado') aoEstado(msg.estado);
    else if (msg.tipo === 'pong' && pingsAbertos.has(msg.t0)) {
      pingsAbertos.delete(msg.t0);
      amostras.push({ t0: msg.t0, t1: msg.t1, t2: msg.t2, t3: agora() });
    } else if (msg.tipo === 'ping') mandar('pong', { t0: msg.t0, eco: true });
    else if (msg.tipo === 'ack') pendentes.delete(msg.acaoId);
    else if (msg.tipo === 'recusado') {
      encerrado = true;
      aoStatus('recusado', { motivo: msg.motivo });
      transporte?.fechar();
    } else if (msg.tipo === 'removido') {
      encerrado = true;
      aoStatus('removido');
      transporte?.fechar();
    } else if (msg.tipo === 'erro' && msg.motivo === 'sala-fechada') {
      encerrado = true;
      aoStatus('fechada');
    }
  }

  async function abrir() {
    aoStatus(tentativas ? 'reconectando' : 'conectando');
    try {
      transporte = await conectar(modo, { codigo, convite: opcoes.convite, aoResposta: opcoes.aoResposta });
    } catch (erro) {
      return falhou(erro);
    }
    transporte.aoMensagem(aoMensagem);
    transporte.aoFechar(() => !encerrado && falhou(new Error('caiu')));
    mandar('entrar', { clientId, nome });
  }

  async function falhou(erro) {
    if (encerrado) return;
    // No modo QR não dá para reconectar sozinho (precisa de um QR novo).
    if (modo === 'qr' && tentativas === 0 && transporte) {
      aoStatus('caiu-qr');
      return;
    }
    tentativas += 1;
    if (tentativas > 30) {
      aoStatus('erro', { motivo: erro.message });
      return;
    }
    aoStatus('reconectando', { motivo: erro.message, tentativas });
    await esperar(Math.min(10000, 1000 * 2 ** Math.min(tentativas - 1, 3)));
    if (!encerrado) abrir();
  }

  abrir();

  return {
    clientId,
    // Ação do aluno: tLocal = event.timeStamp (ou agora); o host converte com o offset.
    agir(tipo, dados = {}, tLocal = agora()) {
      const acao = { id: novoId('acao'), tipo, ...dados, tLocal };
      pendentes.set(acao.id, acao);
      mandar('acao', { acao });
      return acao.id;
    },
    relogioHost: () => agora() + offset,
    get offset() {
      return offset;
    },
    sair() {
      encerrado = true;
      clearInterval(ressincronia);
      mandar('sair', {});
      transporte?.fechar();
    },
  };
}
