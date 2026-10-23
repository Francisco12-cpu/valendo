// Nuvem de palavras: junta as palavras da turma (sem acento/maiúscula importar), tira
// palavras vazias e ofensivas e calcula o peso de cada uma. Lógica pura.
import { normalizarTexto } from './questions/base.js';
import { nomeOfensivo } from './nomes.js';

const VAZIAS = new Set(['a', 'o', 'as', 'os', 'e', 'de', 'da', 'do', 'das', 'dos', 'um', 'uma', 'que', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'se', 'é', 'eu', 'ele', 'ela']);

// "  Fotossíntese!! " → { chave: 'fotossintese', texto: 'Fotossíntese' }
export function limparPalavra(texto) {
  const t = String(texto ?? '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 30);
  if (!t) return null;
  const chave = normalizarTexto(t);
  if (VAZIAS.has(chave) || chave.length < 2 || nomeOfensivo(t)) return null;
  return { chave, texto: t };
}

// entradas: [{ pid, palavras: ['a', 'b'] }] → [{ chave, texto, quantos, peso (0..1) }]
export function contarPalavras(entradas, { maximo = 60 } = {}) {
  const mapa = new Map();
  for (const e of entradas) {
    const vistas = new Set(); // a mesma pessoa não conta duas vezes a mesma palavra
    for (const p of e.palavras ?? []) {
      const l = limparPalavra(p);
      if (!l || vistas.has(l.chave)) continue;
      vistas.add(l.chave);
      const atual = mapa.get(l.chave) ?? { chave: l.chave, texto: l.texto, quantos: 0, formas: new Map() };
      atual.quantos += 1;
      atual.formas.set(l.texto, (atual.formas.get(l.texto) ?? 0) + 1);
      mapa.set(l.chave, atual);
    }
  }
  const lista = [...mapa.values()]
    .map((x) => ({ chave: x.chave, texto: [...x.formas.entries()].sort((a, b) => b[1] - a[1])[0][0], quantos: x.quantos }))
    .sort((a, b) => b.quantos - a.quantos || a.chave.localeCompare(b.chave))
    .slice(0, maximo);
  const max = lista[0]?.quantos ?? 1;
  const min = lista.at(-1)?.quantos ?? 1;
  return lista.map((x) => ({ ...x, peso: max === min ? 1 : (x.quantos - min) / (max - min) }));
}
