// Sons gerados na hora com WebAudio (sem arquivos pesados).
// Todo som tem um equivalente visual na tela; o som é só reforço.

let ctx = null;
let mudo = false;

// Navegadores só liberam áudio depois de um toque: chame no primeiro pointerdown/clique.
export function desbloquear() {
  try {
    if (!ctx) {
      const Contexto = window.AudioContext || window.webkitAudioContext;
      if (!Contexto) return;
      ctx = new Contexto({ latencyHint: 'interactive' });
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

export function definirMudo(valor) {
  mudo = Boolean(valor);
}

function tom(freq, duracao, { tipo = 'square', volume = 0.18, atraso = 0, ate = null } = {}) {
  if (mudo || !ctx) return;
  try {
    const inicio = ctx.currentTime + atraso;
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, inicio);
    if (ate) osc.frequency.exponentialRampToValueAtTime(ate, inicio + duracao);
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(volume, inicio + 0.008);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(inicio);
    osc.stop(inicio + duracao + 0.02);
  } catch {
    /* som é opcional */
  }
}

export const sons = {
  contagem: () => tom(523, 0.12),
  // Largada: toca no mesmo frame em que o sinal visual aparece.
  valendo: () => {
    tom(988, 0.35, { volume: 0.22 });
    tom(1319, 0.35, { volume: 0.12, tipo: 'triangle' });
  },
  queima: () => tom(180, 0.45, { tipo: 'sawtooth', volume: 0.2, ate: 90 }),
  registro: () => tom(1500, 0.04, { tipo: 'sine', volume: 0.12 }),
  vitoria: () => [523, 659, 784, 1047].forEach((f, i) => tom(f, 0.18, { atraso: i * 0.09, tipo: 'triangle', volume: 0.2 })),
  empate: () => [660, 660].forEach((f, i) => tom(f, 0.15, { atraso: i * 0.2, tipo: 'triangle', volume: 0.2 })),
  nada: () => tom(330, 0.3, { tipo: 'sine', volume: 0.15, ate: 220 }),
};
