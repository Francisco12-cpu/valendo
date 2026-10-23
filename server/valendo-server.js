#!/usr/bin/env node
// Servidor local opcional do Valendo! (modo 3 das salas). Um arquivo só, sem dependências.
//
//   node server/valendo-server.js            (porta 8080)
//   PORT=3000 node server/valendo-server.js
//
// Serve o app para a rede local e um WebSocket em /ws que só REPASSA mensagens:
// quem manda no jogo continua sendo o aparelho do professor (o host).
//   /ws?sala=ABC234&papel=host   → o professor
//   /ws?sala=ABC234&papel=aluno  → cada aluno
// Host → servidor: { para: conexaoId | '*', msg }     Servidor → host: { de, msg } / { evento, conexao }
// Aluno ↔ servidor: a própria mensagem do protocolo (texto JSON).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = Number(process.env.PORT) || 8080;
const LOG = process.env.VALENDO_LOG === '1';
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

// ---------- Arquivos ----------
const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let caminho = decodeURIComponent(url.pathname);
  if (caminho.endsWith('/')) caminho += 'index.html';
  const arquivo = path.resolve(RAIZ, `.${caminho}`);
  if (!arquivo.startsWith(RAIZ + path.sep) || arquivo.includes(`${path.sep}.git`) || arquivo.includes(`${path.sep}node_modules`)) {
    res.writeHead(403).end();
    return;
  }
  fs.stat(arquivo, (erro, info) => {
    if (erro || !info.isFile()) {
      fs.readFile(path.join(RAIZ, '404.html'), (e, html) => res.writeHead(404, { 'Content-Type': TIPOS['.html'] }).end(e ? 'Não encontrado' : html));
      return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(arquivo).pipe(res);
  });
});

// ---------- WebSocket mínimo (RFC 6455) ----------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function quadro(texto, opcode = 0x1) {
  const dados = Buffer.from(texto);
  const n = dados.length;
  const cabeca = n < 126 ? Buffer.from([0x80 | opcode, n]) : n < 65536 ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x80 | opcode, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
  return Buffer.concat([cabeca, dados]);
}

function criarSocket(socket, aoTexto, aoFechar) {
  let buffer = Buffer.alloc(0);
  let fragmentos = [];
  let aberto = true;
  const fechar = () => {
    if (!aberto) return;
    aberto = false;
    try {
      socket.end(quadro('', 0x8));
    } catch {}
    socket.destroy();
    aoFechar();
  };
  socket.on('data', (pedaco) => {
    buffer = Buffer.concat([buffer, pedaco]);
    while (buffer.length >= 2) {
      const fin = (buffer[0] & 0x80) !== 0;
      const opcode = buffer[0] & 0x0f;
      const mascarado = (buffer[1] & 0x80) !== 0;
      let tamanho = buffer[1] & 0x7f;
      let pos = 2;
      if (tamanho === 126) {
        if (buffer.length < 4) return;
        tamanho = buffer.readUInt16BE(2);
        pos = 4;
      } else if (tamanho === 127) {
        if (buffer.length < 10) return;
        tamanho = Number(buffer.readBigUInt64BE(2));
        pos = 10;
      }
      if (tamanho > 1024 * 1024) return fechar(); // 1 MB no máximo
      const mascara = mascarado ? buffer.subarray(pos, pos + 4) : null;
      if (mascarado) pos += 4;
      if (buffer.length < pos + tamanho) return;
      const dados = Buffer.from(buffer.subarray(pos, pos + tamanho));
      if (mascara) for (let i = 0; i < dados.length; i++) dados[i] ^= mascara[i % 4];
      buffer = buffer.subarray(pos + tamanho);
      if (opcode === 0x8) return fechar();
      if (opcode === 0x9) {
        socket.write(quadro(dados.toString(), 0xa));
        continue;
      }
      if (opcode === 0xa) continue;
      if (opcode === 0x1 || opcode === 0x0) {
        fragmentos.push(dados);
        if (fin) {
          aoTexto(Buffer.concat(fragmentos).toString('utf8'));
          fragmentos = [];
        }
      }
    }
  });
  socket.on('close', () => {
    if (aberto) {
      aberto = false;
      aoFechar();
    }
  });
  socket.on('error', () => socket.destroy());
  return {
    enviar: (texto) => aberto && socket.write(quadro(texto)),
    fechar,
  };
}

// ---------- Salas (só repasse) ----------
const salas = new Map(); // codigo → { host, alunos: Map(conexaoId → socket) }
let proximaConexao = 1;

function sala(codigo) {
  if (!salas.has(codigo)) salas.set(codigo, { host: null, alunos: new Map() });
  return salas.get(codigo);
}

servidor.on('upgrade', (req, socket) => {
  const url = new URL(req.url, 'http://x');
  const chave = req.headers['sec-websocket-key'];
  const codigo = String(url.searchParams.get('sala') ?? '').toUpperCase();
  const papel = url.searchParams.get('papel');
  if (url.pathname !== '/ws' || !chave || !/^[A-Z0-9]{6}$/.test(codigo) || !['host', 'aluno'].includes(papel)) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return;
  }
  const aceite = crypto.createHash('sha1').update(chave + GUID).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${aceite}\r\n\r\n`);
  socket.setNoDelay(true);
  const s = sala(codigo);

  if (papel === 'host') {
    if (s.host) s.host.fechar(); // o professor recarregou a página: assume o novo
    const ws = criarSocket(
      socket,
      (texto) => {
        let pacote;
        try {
          pacote = JSON.parse(texto);
        } catch {
          return;
        }
        if (LOG) console.log(`[${codigo}] host → ${pacote.para}: ${JSON.stringify(pacote.msg).slice(0, 300)}`);
        const msg = JSON.stringify(pacote.msg);
        if (pacote.para === '*') for (const a of s.alunos.values()) a.enviar(msg);
        else s.alunos.get(pacote.para)?.enviar(msg);
        if (pacote.desconectar) s.alunos.get(pacote.para)?.fechar();
      },
      () => {
        if (s.host === ws) s.host = null;
      }
    );
    s.host = ws;
    for (const id of s.alunos.keys()) ws.enviar(JSON.stringify({ evento: 'conectou', conexao: id }));
    return;
  }

  const id = `c${proximaConexao++}`;
  const ws = criarSocket(
    socket,
    (texto) => {
      if (LOG) console.log(`[${codigo}] ${id} → host: ${texto.slice(0, 300)}`);
      s.host?.enviar(JSON.stringify({ de: id, msg: texto }));
    },
    () => {
      s.alunos.delete(id);
      s.host?.enviar(JSON.stringify({ evento: 'desconectou', conexao: id }));
    }
  );
  s.alunos.set(id, ws);
  s.host?.enviar(JSON.stringify({ evento: 'conectou', conexao: id }));
});

function ipsDaRede() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

servidor.listen(PORTA, () => {
  console.log('\n  Valendo! — servidor local ligado.\n');
  console.log(`  Professor (neste computador): http://localhost:${PORTA}/#/sala?modo=local`);
  for (const ip of ipsDaRede()) console.log(`  Alunos (mesma rede Wi-Fi):    http://${ip}:${PORTA}/#/entrar?modo=local`);
  console.log('\n  Para desligar: Ctrl+C\n');
});
