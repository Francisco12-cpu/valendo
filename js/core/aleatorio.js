// Gerador aleatório com semente (mesma semente → mesma sequência). Usado para embaralhar a
// prova de cada aluno de um jeito fixo: se ele cair e voltar, vê a mesma ordem.
export function hashTexto(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32
export function rngDeSemente(semente) {
  let a = typeof semente === 'number' ? semente >>> 0 : hashTexto(String(semente));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
