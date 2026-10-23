// Modo 3 — Servidor local: o PC do professor roda `node server/valendo-server.js`,
// que serve o app e um WebSocket na rede local. Todos abrem http://IP-do-PC:8080.
import { criarEventos, apiHost, apiCliente } from './transport.js';
import { codificar } from './protocol.js';

const endereco = (codigo, papel) => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?sala=${encodeURIComponent(codigo)}&papel=${papel}`;

function abrirSocket(url) {
  return new Promise((resolver, rejeitar) => {
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (erro) {
      rejeitar(erro);
      return;
    }
    const timer = setTimeout(() => {
      ws.close();
      rejeitar(new Error('servidor-indisponivel'));
    }, 8000);
    ws.onopen = () => {
      clearTimeout(timer);
      resolver(ws);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      rejeitar(new Error('servidor-indisponivel'));
    };
  });
}

export async function abrirHost({ codigo }) {
  const ev = criarEventos();
  const ws = await abrirSocket(endereco(codigo, 'host'));
  ws.onmessage = (e) => {
    let pacote;
    try {
      pacote = JSON.parse(e.data);
    } catch {
      return;
    }
    if (pacote.evento === 'conectou') ev.emitir('conectar', pacote.conexao);
    else if (pacote.evento === 'desconectou') ev.emitir('desconectar', pacote.conexao);
    else if (pacote.de) ev.emitir('mensagem', pacote.de, pacote.msg);
  };
  ws.onclose = () => ev.emitir('erro', new Error('servidor-caiu'));
  const mandar = (para, msg) => ws.readyState === 1 && ws.send(JSON.stringify({ para, msg }));
  return apiHost(ev, {
    modo: 'local',
    codigo,
    enviar: (id, msg) => mandar(id, msg),
    transmitir: (msg) => mandar('*', msg),
    fechar: () => ws.close(),
  });
}

export async function conectar({ codigo }) {
  const ev = criarEventos();
  const ws = await abrirSocket(endereco(codigo, 'aluno'));
  ws.onmessage = (e) => ev.emitir('mensagem', e.data);
  ws.onclose = () => ev.emitir('fechar');
  return apiCliente(ev, {
    enviar: (msg) => ws.readyState === 1 && ws.send(codificar(msg)),
    fechar: () => ws.close(),
  });
}
