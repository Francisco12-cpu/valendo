// Protocolo das salas (§7): mensagens JSON com v (versão), id único, seq e tipo.
// Lógica pura (sem rede): montar, validar e deduplicar mensagens.
import { novoId } from '../core/ids.js';

export const VERSAO_PROTOCOLO = 1;
export const TIPOS = ['entrar', 'bemvindo', 'recusado', 'estado', 'acao', 'ack', 'ping', 'pong', 'sair', 'removido', 'erro'];
const TAMANHO_MAXIMO = 64 * 1024;

export function criarEmissor(prefixo = 'm') {
  let seq = 0;
  return (tipo, dados = {}) => ({ v: VERSAO_PROTOCOLO, id: novoId(prefixo), seq: ++seq, tipo, ...dados });
}

export function codificar(msg) {
  return JSON.stringify(msg);
}

// Aceita texto ou objeto; devolve { ok, msg } ou { ok: false, erro }.
export function decodificar(bruto) {
  let msg = bruto;
  if (typeof bruto === 'string') {
    if (bruto.length > TAMANHO_MAXIMO) return { ok: false, erro: 'mensagem grande demais' };
    try {
      msg = JSON.parse(bruto);
    } catch {
      return { ok: false, erro: 'JSON inválido' };
    }
  }
  if (!msg || typeof msg !== 'object') return { ok: false, erro: 'mensagem vazia' };
  if (msg.v !== VERSAO_PROTOCOLO) return { ok: false, erro: `versão ${msg.v} não suportada` };
  if (typeof msg.id !== 'string' || !msg.id) return { ok: false, erro: 'sem id' };
  if (!Number.isInteger(msg.seq) || msg.seq < 1) return { ok: false, erro: 'seq inválida' };
  if (!TIPOS.includes(msg.tipo)) return { ok: false, erro: `tipo desconhecido: ${msg.tipo}` };
  return { ok: true, msg };
}

// Lembra os últimos ids vistos para descartar repetidos (reenvio após reconexão).
export function criarDeduplicador(limite = 5000) {
  const vistos = new Set();
  const fila = [];
  return {
    jaVisto(id) {
      if (vistos.has(id)) return true;
      vistos.add(id);
      fila.push(id);
      if (fila.length > limite) vistos.delete(fila.shift());
      return false;
    },
    get tamanho() {
      return vistos.size;
    },
  };
}
