// Tempo monotônico. performance.now() tem a mesma base de event.timeStamp e do
// timestamp do requestAnimationFrame, então dá para comparar os três direto.
// (A sincronização entre aparelhos chega na Fase 5.)

export const agora = () => globalThis.performance.now();

// "183 ms", "1,24 s" — para mostrar tempos de reação.
export function formatarMs(ms, { sinal = false } = {}) {
  if (!Number.isFinite(ms)) return '—';
  const prefixo = sinal && ms > 0 ? '+' : '';
  if (Math.abs(ms) < 1000) return `${prefixo}${Math.round(ms)} ms`;
  return `${prefixo}${(ms / 1000).toFixed(2).replace('.', ',')} s`;
}
