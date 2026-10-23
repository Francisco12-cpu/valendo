// Cronômetro regressivo ou progressivo. Puro: o tempo atual (performance.now) vem de fora.

export function criarCronometro({ modo = 'regressivo', duracaoMs = 60000 } = {}) {
  return { modo, duracaoMs: Math.max(0, duracaoMs), inicio: null, acumulado: 0, rodando: false };
}

export const decorrido = (c, t) => c.acumulado + (c.rodando ? t - c.inicio : 0);
export const restante = (c, t) => Math.max(0, c.duracaoMs - decorrido(c, t));
export const terminou = (c, t) => c.modo === 'regressivo' && decorrido(c, t) >= c.duracaoMs;

// O que mostrar: regressivo mostra o que falta; progressivo, o que passou.
export const mostrador = (c, t) => (c.modo === 'regressivo' ? restante(c, t) : decorrido(c, t));

export function iniciar(c, t) {
  if (c.rodando || terminou(c, t)) return c;
  return { ...c, rodando: true, inicio: t };
}

export function pausar(c, t) {
  if (!c.rodando) return c;
  const acumulado = c.modo === 'regressivo' ? Math.min(c.duracaoMs, decorrido(c, t)) : decorrido(c, t);
  return { ...c, rodando: false, inicio: null, acumulado };
}

export const alternar = (c, t) => (c.rodando ? pausar(c, t) : iniciar(c, t));

export function zerar(c) {
  return { ...c, rodando: false, inicio: null, acumulado: 0 };
}

// "+30 s" no regressivo estende a duração (mesmo depois de terminar).
export function adicionar(c, ms, t) {
  if (c.modo !== 'regressivo') return c;
  const base = terminou(c, t) ? { ...pausar(c, t), acumulado: c.duracaoMs } : c;
  return { ...base, duracaoMs: Math.max(0, base.duracaoMs + ms) };
}

export function definirDuracao(c, ms) {
  return { ...zerar(c), duracaoMs: Math.max(0, ms) };
}

// 65_000 → "01:05"; 3_725_000 → "1:02:05". Regressivo arredonda para cima (mostra 00:01 até zerar).
export function formatarRelogio(ms, { paraCima = false } = {}) {
  const total = Math.max(0, paraCima ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dois = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}
