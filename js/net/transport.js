// Interface comum dos transportes (§7). Três implementações intercambiáveis:
//   'online' → PeerJS (sinalização pela internet; jogo P2P pela rede local quando dá)
//   'qr'     → WebRTC com sinalização manual por QR (sem internet)
//   'local'  → servidor local opcional (node server/valendo-server.js)
//
// Host:    { codigo, aoConectar(fn(conexao)), aoMensagem(fn(conexao, msg)), aoDesconectar(fn(conexao)),
//            enviar(conexao, msg), transmitir(msg), fechar() }
// Cliente: { enviar(msg), aoMensagem(fn(msg)), aoFechar(fn()), fechar() }
// As mensagens são objetos do protocolo (net/protocol.js); cada transporte serializa como quiser.

export const MODOS = ['online', 'qr', 'local'];

export function criarEventos() {
  const ouvintes = new Map();
  return {
    em(nome, fn) {
      if (!ouvintes.has(nome)) ouvintes.set(nome, new Set());
      ouvintes.get(nome).add(fn);
      return () => ouvintes.get(nome).delete(fn);
    },
    emitir(nome, ...args) {
      for (const fn of ouvintes.get(nome) ?? []) {
        try {
          fn(...args);
        } catch (erro) {
          console.error(erro);
        }
      }
    },
  };
}

// Monta a API pública do host a partir dos eventos internos.
export function apiHost(ev, extra) {
  return {
    aoConectar: (fn) => ev.em('conectar', fn),
    aoMensagem: (fn) => ev.em('mensagem', fn),
    aoDesconectar: (fn) => ev.em('desconectar', fn),
    aoErro: (fn) => ev.em('erro', fn),
    ...extra,
  };
}

export function apiCliente(ev, extra) {
  return {
    aoMensagem: (fn) => ev.em('mensagem', fn),
    aoFechar: (fn) => ev.em('fechar', fn),
    ...extra,
  };
}

export async function abrirHost(modo, opcoes) {
  if (modo === 'online') return (await import('./peer-online.js')).abrirHost(opcoes);
  if (modo === 'qr') return (await import('./peer-qr.js')).abrirHost(opcoes);
  if (modo === 'local') return (await import('./local-server.js')).abrirHost(opcoes);
  throw new Error(`Modo de sala desconhecido: ${modo}`);
}

export async function conectar(modo, opcoes) {
  if (modo === 'online') return (await import('./peer-online.js')).conectar(opcoes);
  if (modo === 'qr') return (await import('./peer-qr.js')).conectar(opcoes);
  if (modo === 'local') return (await import('./local-server.js')).conectar(opcoes);
  throw new Error(`Modo de sala desconhecido: ${modo}`);
}
