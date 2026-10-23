// Compartilhar atividade por link ou QR: a atividade vai compactada no próprio link
// (sem servidor). CompressionStream existe no navegador e no Node (não é DOM nem rede).
import { abrir } from './activity.js';

const PREFIXO = 'v1.';

function paraBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(texto) {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((texto.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function passar(bytes, Fluxo) {
  const stream = new Blob([bytes]).stream().pipeThrough(new Fluxo('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Só o que importa para reconstruir a atividade (sem favorita, datas etc.).
function essencial(a) {
  const { schema, titulo, modalidade, disciplina, dificuldade, tags, nivelConfig, conteudo, regras, exibicao } = a;
  return { schema, titulo, modalidade, disciplina, dificuldade, tags, nivelConfig, conteudo, regras, exibicao };
}

export async function codificarAtividade(a) {
  const json = new TextEncoder().encode(JSON.stringify(essencial(a)));
  return PREFIXO + paraBase64Url(await passar(json, CompressionStream));
}

export async function decodificarAtividade(codigo) {
  const limpo = String(codigo ?? '').trim();
  if (!limpo.startsWith(PREFIXO)) throw new Error('link-invalido');
  let texto;
  try {
    texto = new TextDecoder().decode(await passar(deBase64Url(limpo.slice(PREFIXO.length)), DecompressionStream));
  } catch {
    throw new Error('link-invalido');
  }
  // abrir() migra e completa: link feito numa versão antiga continua funcionando.
  return abrir({ ...JSON.parse(texto), id: undefined });
}
