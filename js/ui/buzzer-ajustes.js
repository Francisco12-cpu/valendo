// Ajustes do buzzer guardados como preferência no aparelho.
import { PADRAO, normalizarConfig, MIN_JOGADORES, MAX_JOGADORES } from '../core/buzzer.js';
import { lerPreferencia, salvarPreferencia } from '../storage/preferencias.js';
import { t } from '../i18n/i18n.js';

const CHAVE = 'buzzer';

// Cores das áreas (texto escuro em todas, contraste AA).
export const CORES_JOGADORES = ['#FFD23F', '#3FC1E0', '#FF5C8A', '#3DBE5A', '#B9A8FF', '#FF8A5B', '#B5E03F', '#9DB8FF'];

export const nomePadrao = (i) => t('buzzer.jogadorN', { n: i + 1 });

// Método D: uma tecla (ou botão de clicker) por jogador. Espaço, F e Esc são do professor.
export const TECLAS_PADRAO = ['KeyA', 'KeyL', 'KeyQ', 'KeyP', 'KeyZ', 'KeyM', 'KeyV', 'KeyN'];
export const TECLAS_RESERVADAS = ['Space', 'KeyF', 'Escape', 'Tab', 'Enter'];

const NOMES_TECLAS = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  PageUp: 'PgUp', PageDown: 'PgDn', Period: '.', Comma: ',', Minus: '-', Equal: '=',
  Semicolon: 'Ç', Slash: ';', Backquote: "'", BracketLeft: '´', BracketRight: '[', Backslash: ']',
  ShiftLeft: 'Shift esq.', ShiftRight: 'Shift dir.', ControlLeft: 'Ctrl esq.', ControlRight: 'Ctrl dir.',
  AltLeft: 'Alt', AltRight: 'AltGr', Backspace: '⌫', Home: 'Home', End: 'End', Insert: 'Ins', Delete: 'Del',
};

export function rotuloTecla(codigo) {
  if (!codigo) return '—';
  if (NOMES_TECLAS[codigo]) return NOMES_TECLAS[codigo];
  if (/^Key[A-Z]$/.test(codigo)) return codigo.slice(3);
  if (/^Digit\d$/.test(codigo)) return codigo.slice(5);
  if (/^Numpad/.test(codigo)) return `Num ${codigo.slice(6)}`;
  return codigo;
}

export function ajustesPadrao() {
  return {
    quantidade: 2,
    nomes: [],
    metodo: PADRAO.metodo,
    gatilho: PADRAO.gatilho,
    contagem: PADRAO.contagem,
    sinal: 'ambos', // 'ambos' | 'som' | 'visual'
    queima: PADRAO.queima,
    penalidadeMs: PADRAO.penalidadeMs,
    margemEmpateMs: PADRAO.margemEmpateMs,
    mesa: true, // áreas de frente uma para a outra (aparelho deitado na mesa)
    som: true,
    teclado: false, // método D
    teclas: [...TECLAS_PADRAO],
  };
}

export function normalizarAjustes(a = {}) {
  const base = { ...ajustesPadrao(), ...a };
  const core = normalizarConfig(base);
  const quantidade = Math.min(MAX_JOGADORES, Math.max(MIN_JOGADORES, Math.round(Number(base.quantidade)) || 2));
  return {
    ...base,
    ...core,
    quantidade,
    nomes: Array.isArray(base.nomes) ? base.nomes.slice(0, MAX_JOGADORES).map((n) => String(n ?? '').slice(0, 24)) : [],
    sinal: ['ambos', 'som', 'visual'].includes(base.sinal) ? base.sinal : 'ambos',
    mesa: base.mesa !== false,
    som: base.som !== false,
    teclado: base.teclado === true,
    teclas: TECLAS_PADRAO.map((padrao, i) => {
      const tecla = Array.isArray(base.teclas) ? base.teclas[i] : null;
      return typeof tecla === 'string' && tecla && !TECLAS_RESERVADAS.includes(tecla) ? tecla : padrao;
    }),
  };
}

export function lerAjustes() {
  return normalizarAjustes(lerPreferencia(CHAVE, {}));
}

export function salvarAjustes(ajustes) {
  salvarPreferencia(CHAVE, normalizarAjustes(ajustes));
}

export function montarJogadores(ajustes) {
  return Array.from({ length: ajustes.quantidade }, (_, i) => ({
    id: `j${i + 1}`,
    nome: (ajustes.nomes[i] || '').trim() || nomePadrao(i),
    cor: CORES_JOGADORES[i],
    tecla: ajustes.teclas[i],
  }));
}
