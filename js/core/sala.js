// Sala conectada (§7): o aparelho do professor é o HOST com autoridade. Aqui fica a lógica
// pura de quem está na sala, reconexão, trancar, remover, deduplicação e validação de tempo.
// Os transportes (online, QR, servidor local) só levam e trazem mensagens.
import { validarNome, nomeUnico } from './nomes.js';

// Código de 6 caracteres sem ambiguidade (sem 0/O nem 1/I).
export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MARGEM_EMPATE_REDE_MS = 30;

export function gerarCodigo(rng = Math.random) {
  return Array.from({ length: 6 }, () => ALFABETO_CODIGO[Math.floor(rng() * ALFABETO_CODIGO.length)]).join('');
}

export const codigoValido = (c) => typeof c === 'string' && c.length === 6 && [...c].every((ch) => ALFABETO_CODIGO.includes(ch));

// Aceita "abc 234", "ABC-234" → "ABC234".
export function normalizarCodigo(c) {
  return String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function criarSala({ codigo }) {
  return { codigo, trancada: false, clientes: {}, removidos: [], acoesVistas: [], log: [] };
}

const registrar = (sala, evento, t) => ({ ...sala, log: [...sala.log, { t, ...evento }].slice(-500) });

// Entrada ou reconexão (mesmo clientId = mesma pessoa, sem duplicar pontos).
export function entrar(sala, { clientId, nome }, t) {
  if (!clientId) return { sala, resultado: 'invalido' };
  if (sala.removidos.includes(clientId)) return { sala, resultado: 'removido' };
  const existente = sala.clientes[clientId];
  if (existente) {
    const s = { ...sala, clientes: { ...sala.clientes, [clientId]: { ...existente, conectado: true, ultimoContato: t } } };
    return { sala: registrar(s, { tipo: 'reconectou', clientId }, t), resultado: 'reconectou', cliente: s.clientes[clientId] };
  }
  if (sala.trancada) return { sala, resultado: 'trancada' };
  const v = validarNome(nome);
  if (!v.ok) return { sala, resultado: v.motivo === 'ofensivo' ? 'nome-ofensivo' : 'nome-invalido' };
  const final = nomeUnico(v.nome, Object.values(sala.clientes).map((c) => c.nome));
  const cliente = { clientId, nome: final, conectado: true, entrouEm: t, ultimoContato: t, rtt: null, offset: 0 };
  const s = { ...sala, clientes: { ...sala.clientes, [clientId]: cliente } };
  return { sala: registrar(s, { tipo: 'entrou', clientId, nome: final }, t), resultado: 'ok', cliente };
}

export function desconectar(sala, clientId, t) {
  const c = sala.clientes[clientId];
  if (!c || !c.conectado) return sala;
  return registrar({ ...sala, clientes: { ...sala.clientes, [clientId]: { ...c, conectado: false } } }, { tipo: 'saiu', clientId }, t);
}

export function remover(sala, clientId, t) {
  if (!sala.clientes[clientId]) return sala;
  const clientes = { ...sala.clientes };
  delete clientes[clientId];
  return registrar({ ...sala, clientes, removidos: [...sala.removidos, clientId] }, { tipo: 'removido', clientId }, t);
}

export function trancar(sala, trancada, t) {
  return registrar({ ...sala, trancada: Boolean(trancada) }, { tipo: trancada ? 'trancou' : 'destrancou' }, t);
}

export function atualizarSincronia(sala, clientId, { rtt, offset }, t) {
  const c = sala.clientes[clientId];
  if (!c) return sala;
  return { ...sala, clientes: { ...sala.clientes, [clientId]: { ...c, rtt, offset, ultimoContato: t, conectado: true } } };
}

export function contato(sala, clientId, t) {
  const c = sala.clientes[clientId];
  if (!c) return sala;
  return { ...sala, clientes: { ...sala.clientes, [clientId]: { ...c, ultimoContato: t } } };
}

// Sinal de conexão para o professor: verde, amarelo ou vermelho.
export function sinal(cliente, t) {
  if (!cliente.conectado) return 'vermelho';
  const silencio = t - cliente.ultimoContato;
  if (silencio > 10000) return 'vermelho';
  if (silencio > 5000 || cliente.rtt === null || cliente.rtt > 300) return 'amarelo';
  return 'verde';
}

export const conectados = (sala) => Object.values(sala.clientes).filter((c) => c.conectado);

// Ação de um aluno: precisa de cliente conhecido e id inédito (reenvio não conta duas vezes).
export function aceitarAcao(sala, clientId, acao, t) {
  if (!sala.clientes[clientId]) return { sala, ok: false, motivo: 'desconhecido' };
  if (!acao?.id) return { sala, ok: false, motivo: 'sem-id' };
  if (sala.acoesVistas.includes(acao.id)) return { sala, ok: false, motivo: 'duplicada' };
  const s = { ...sala, acoesVistas: [...sala.acoesVistas, acao.id].slice(-20000) };
  return { sala: registrar(s, { tipo: 'acao', clientId, acao: acao.tipo }, t), ok: true };
}

// tHost = tLocal + offset, mas nunca no futuro nem antes do possível (anti-trapaça):
// a ação não pode ter acontecido depois de chegar, nem muito antes de chegar.
export function tempoNoHost(cliente, tLocal, tChegada) {
  const estimado = Number.isFinite(tLocal) ? tLocal + (cliente.offset ?? 0) : tChegada;
  const folga = Math.max(500, (cliente.rtt ?? 500) * 2 + 250);
  return Math.min(tChegada, Math.max(tChegada - folga, estimado));
}
