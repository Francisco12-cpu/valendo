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

// ---------- Sincronização entre aparelhos (Fase 5) ----------
// Cada amostra de ping: t0 = cliente enviou, t1 = host recebeu, t2 = host respondeu,
// t3 = cliente recebeu (t0/t3 no relógio do cliente; t1/t2 no do host).
// offset = quanto somar ao relógio do cliente para ter o do host.
export function amostraSincronia({ t0, t1, t2, t3 }) {
  return { offset: (t1 - t0 + (t2 - t3)) / 2, rtt: t3 - t0 - (t2 - t1) };
}

const mediana = (valores) => {
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
};

// Mediana das amostras com menor RTT (as menos distorcidas, como no NTP): resiste a um
// ping atrasado por Wi-Fi ruim ou a um aparelho que engasgou no meio da sincronia.
export function sincronizar(amostras) {
  const validas = amostras.map(amostraSincronia).filter((a) => Number.isFinite(a.offset) && a.rtt >= 0);
  if (!validas.length) return null;
  const melhores = [...validas].sort((a, b) => a.rtt - b.rtt).slice(0, Math.ceil(validas.length / 2));
  return { offset: mediana(melhores.map((a) => a.offset)), rtt: mediana(validas.map((a) => a.rtt)), amostras: validas.length };
}
