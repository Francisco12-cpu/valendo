// Modo 2 — Sem internet (QR): WebRTC com sinalização manual.
// 1) O professor mostra o QR de convite.  2) O aluno lê e mostra o QR de resposta.
// 3) O professor lê a resposta: pronto, conectados (mesmo Wi-Fi ou roteador do celular).
// Sem servidor STUN: só candidatos da rede local (é offline de verdade).
import { criarEventos, apiHost, apiCliente } from './transport.js';
import { codificar } from './protocol.js';

const PREFIXO = 'VLD1';
const LINHAS = /^(v=|o=|s=|t=|a=group:|a=msid-semantic|m=|c=|a=ice-ufrag:|a=ice-pwd:|a=ice-options:|a=fingerprint:|a=setup:|a=mid:|a=sctp-port:|a=max-message-size:|a=candidate:)/;

// Tira do SDP o que não é necessário, para caber num QR.
export function compactar(sdp, tipo) {
  const linhas = sdp
    .split(/\r?\n/)
    .filter((l) => LINHAS.test(l))
    .filter((l) => !l.startsWith('a=candidate:') || (/ udp /i.test(l) && / typ (host|srflx)/.test(l)));
  return `${PREFIXO}:${tipo === 'offer' ? 'o' : 'a'}:${linhas.join('\n')}`;
}

export function expandir(texto) {
  const m = String(texto ?? '').trim().match(/^VLD1:([oa]):([\s\S]+)$/);
  if (!m) throw new Error('codigo-qr-invalido');
  return { type: m[1] === 'o' ? 'offer' : 'answer', sdp: `${m[2].split('\n').join('\r\n')}\r\n` };
}

function esperarCandidatos(pc, limite = 2500) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolver) => {
    const timer = setTimeout(resolver, limite);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        resolver();
      }
    });
  });
}

const novaConexao = () => new RTCPeerConnection({ iceServers: [] });

export async function abrirHost({ codigo }) {
  const ev = criarEventos();
  const canais = new Map();
  let proximo = 1;

  // Cada aparelho precisa de um convite próprio.
  async function novoConvite() {
    const pc = novaConexao();
    const canal = pc.createDataChannel('valendo', { ordered: true });
    const id = `qr${proximo++}`;
    canal.onopen = () => {
      canais.set(id, canal);
      ev.emitir('conectar', id);
    };
    canal.onmessage = (e) => ev.emitir('mensagem', id, e.data);
    canal.onclose = () => {
      if (canais.delete(id)) ev.emitir('desconectar', id);
      pc.close();
    };
    await pc.setLocalDescription(await pc.createOffer());
    await esperarCandidatos(pc);
    return {
      id,
      texto: compactar(pc.localDescription.sdp, 'offer'),
      aceitar: async (resposta) => {
        const desc = expandir(resposta);
        if (desc.type !== 'answer') throw new Error('codigo-qr-invalido');
        await pc.setRemoteDescription(desc);
      },
      cancelar: () => pc.close(),
    };
  }

  return apiHost(ev, {
    modo: 'qr',
    codigo,
    novoConvite,
    enviar: (id, msg) => canais.get(id)?.readyState === 'open' && canais.get(id).send(codificar(msg)),
    transmitir: (msg) => {
      const texto = codificar(msg);
      for (const c of canais.values()) if (c.readyState === 'open') c.send(texto);
    },
    fechar: () => canais.forEach((c) => c.close()),
  });
}

// O aluno lê o convite; aoResposta(texto) mostra o QR de resposta. Resolve quando conecta.
export async function conectar({ convite, aoResposta }) {
  const ev = criarEventos();
  const desc = expandir(convite);
  if (desc.type !== 'offer') throw new Error('codigo-qr-invalido');
  const pc = novaConexao();
  const aberto = new Promise((resolver, rejeitar) => {
    const timer = setTimeout(() => rejeitar(new Error('qr-tempo-esgotado')), 5 * 60 * 1000);
    pc.ondatachannel = (e) => {
      const canal = e.channel;
      canal.onopen = () => {
        clearTimeout(timer);
        resolver(canal);
      };
    };
  });
  await pc.setRemoteDescription(desc);
  await pc.setLocalDescription(await pc.createAnswer());
  await esperarCandidatos(pc);
  aoResposta?.(compactar(pc.localDescription.sdp, 'answer'));
  const canal = await aberto;
  canal.onmessage = (e) => ev.emitir('mensagem', e.data);
  let fechado = false;
  const fim = () => {
    if (fechado) return;
    fechado = true;
    ev.emitir('fechar');
    pc.close();
  };
  canal.onclose = fim;
  pc.addEventListener('connectionstatechange', () => ['failed', 'closed'].includes(pc.connectionState) && fim());
  return apiCliente(ev, {
    enviar: (msg) => canal.readyState === 'open' && canal.send(codificar(msg)),
    fechar: fim,
  });
}
