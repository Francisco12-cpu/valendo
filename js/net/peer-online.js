// Modo 1 — Online (padrão): PeerJS. A internet só é usada para os aparelhos se acharem
// (sinalização); depois o tráfego do jogo vai direto entre eles (P2P) quando a rede deixa.
import { carregarScript } from './carregar.js';
import { criarEventos, apiHost, apiCliente } from './transport.js';
import { codificar } from './protocol.js';

const idDoHost = (codigo) => `valendo-sala-${codigo.toLowerCase()}`;
const TEMPO_LIMITE = 15000;

async function novoPeer(id) {
  const Peer = await carregarScript('vendor/peerjs.min.js', 'Peer');
  return new Promise((resolver, rejeitar) => {
    const peer = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
    const timer = setTimeout(() => rejeitar(new Error('sem-internet')), TEMPO_LIMITE);
    peer.on('open', () => {
      clearTimeout(timer);
      resolver(peer);
    });
    peer.on('error', (erro) => {
      clearTimeout(timer);
      rejeitar(new Error(erro.type === 'unavailable-id' ? 'codigo-em-uso' : erro.type === 'network' || erro.type === 'server-error' ? 'sem-internet' : erro.type || 'erro'));
    });
  });
}

export async function abrirHost({ codigo }) {
  const ev = criarEventos();
  const peer = await novoPeer(idDoHost(codigo));
  const conexoes = new Map();
  peer.on('connection', (conn) => {
    const id = conn.connectionId;
    conn.on('open', () => {
      conexoes.set(id, conn);
      ev.emitir('conectar', id);
    });
    conn.on('data', (dados) => ev.emitir('mensagem', id, typeof dados === 'string' ? dados : codificar(dados)));
    const fim = () => {
      if (conexoes.delete(id)) ev.emitir('desconectar', id);
    };
    conn.on('close', fim);
    conn.on('error', fim);
  });
  // Perdeu só a sinalização (internet caiu): as conexões já abertas continuam.
  peer.on('disconnected', () => setTimeout(() => !peer.destroyed && peer.reconnect(), 2000));
  peer.on('error', (e) => ev.emitir('erro', e));
  return apiHost(ev, {
    modo: 'online',
    codigo,
    enviar: (id, msg) => conexoes.get(id)?.open && conexoes.get(id).send(codificar(msg)),
    transmitir: (msg) => {
      const texto = codificar(msg);
      for (const c of conexoes.values()) if (c.open) c.send(texto);
    },
    fechar: () => peer.destroy(),
  });
}

export async function conectar({ codigo }) {
  const ev = criarEventos();
  const peer = await novoPeer(null);
  const conn = await new Promise((resolver, rejeitar) => {
    const c = peer.connect(idDoHost(codigo), { reliable: true, serialization: 'raw' });
    const timer = setTimeout(() => rejeitar(new Error('sala-nao-encontrada')), TEMPO_LIMITE);
    c.on('open', () => {
      clearTimeout(timer);
      resolver(c);
    });
    peer.on('error', (e) => {
      clearTimeout(timer);
      rejeitar(new Error(e.type === 'peer-unavailable' ? 'sala-nao-encontrada' : e.type || 'erro'));
    });
  });
  conn.on('data', (dados) => ev.emitir('mensagem', typeof dados === 'string' ? dados : codificar(dados)));
  let fechado = false;
  const fim = () => {
    if (fechado) return;
    fechado = true;
    ev.emitir('fechar');
    peer.destroy();
  };
  conn.on('close', fim);
  conn.on('error', fim);
  return apiCliente(ev, {
    enviar: (msg) => conn.open && conn.send(codificar(msg)),
    fechar: fim,
  });
}
