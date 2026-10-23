// Nomes no lobby: limpeza, filtro de palavrões e gerador de apelidos divertidos.
import { normalizarTexto } from './questions/base.js';

const BICHOS = ['Capivara', 'Tucano', 'Jabuti', 'Arara', 'Mico', 'Tatu', 'Onça', 'Boto', 'Sagui', 'Quati', 'Lontra', 'Pinguim', 'Coruja', 'Panda', 'Polvo', 'Lhama', 'Coala', 'Raposa', 'Golfinho', 'Pavão'];
const JEITOS = ['Veloz', 'Sabido', 'Curioso', 'Esperto', 'Valente', 'Atento', 'Brilhante', 'Ligeiro', 'Genial', 'Animado', 'Sereno', 'Focado', 'Criativo', 'Radiante', 'Astuto'];

export function gerarApelido(rng = Math.random) {
  const bicho = BICHOS[Math.floor(rng() * BICHOS.length)];
  const jeito = JEITOS[Math.floor(rng() * JEITOS.length)];
  return `${bicho} ${jeito}`;
}

// Termos ofensivos comuns, comparados sem acento, em minúsculas e com troca de números
// por letras ("p0rr4" → "porra"). Os curtos ou que aparecem dentro de nomes reais
// ("Nazira", "Carola", "Deputado") só contam como palavra inteira.
const EM_QUALQUER_LUGAR = [
  'porra', 'caralho', 'buceta', 'cacete', 'filhodaputa', 'merda', 'bosta', 'cuzao', 'arrombado', 'boiola', 'piranha', 'vagabunda',
  'vadia', 'otario', 'babaca', 'idiota', 'imbecil', 'retardado', 'xoxota', 'xereca', 'punheta', 'siririca', 'porno', 'hitler', 'piroca',
  'tesao', 'putaria', 'viadinho',
];
const SO_PALAVRA_INTEIRA = ['cu', 'pau', 'rola', 'pica', 'fdp', 'bicha', 'veado', 'viado', 'macaco', 'transa', 'sexo', 'puta', 'puto', 'nazi', 'corno', 'mongol'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };

function desofuscar(texto) {
  return normalizarTexto(texto)
    .split('')
    .map((c) => LEET[c] ?? c)
    .join('')
    .replace(/(.)\1{2,}/g, '$1$1'); // "porrrrra" → "porra"
}

export function nomeOfensivo(nome) {
  const palavras = desofuscar(nome).split(/[^a-z]+/).filter(Boolean);
  const junto = palavras.join('');
  return SO_PALAVRA_INTEIRA.some((p) => palavras.includes(p)) || EM_QUALQUER_LUGAR.some((p) => junto.includes(p));
}

// Limpa espaços, corta o tamanho e recusa vazio/ofensivo. Devolve { ok, nome, motivo }.
export function validarNome(nome, { maximo = 20 } = {}) {
  const limpo = String(nome ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maximo);
  if (limpo.length < 2) return { ok: false, nome: limpo, motivo: 'curto' };
  if (nomeOfensivo(limpo)) return { ok: false, nome: limpo, motivo: 'ofensivo' };
  return { ok: true, nome: limpo };
}

// "Ana" já existe → "Ana 2".
export function nomeUnico(nome, existentes) {
  const usados = new Set(existentes.map((n) => normalizarTexto(n)));
  if (!usados.has(normalizarTexto(nome))) return nome;
  for (let i = 2; ; i++) if (!usados.has(normalizarTexto(`${nome} ${i}`))) return `${nome} ${i}`;
}
