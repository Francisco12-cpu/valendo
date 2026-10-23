// Mascote trocável. O personagem ainda está em definição (§5): este é um rascunho
// provisório de traço preto. Para trocar, chame registrarMascote(fn) com uma função
// que receba { humor } e devolva a marcação SVG — toda a interface passa a usá-la.
import { h, svg } from '../dom.js';

const BOCAS = {
  feliz: '<path d="M48 78q12 12 24 0"/>',
  triste: '<path d="M48 84q12 -10 24 0"/>',
  neutro: '<path d="M50 80h20"/>',
  surpreso: '<ellipse cx="60" cy="81" rx="5" ry="6"/>',
};

function rascunho({ humor = 'feliz' } = {}) {
  return `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <circle cx="22" cy="58" r="12" style="fill:var(--superficie)"/>
    <circle cx="98" cy="58" r="12" style="fill:var(--superficie)"/>
    <circle cx="60" cy="60" r="40" style="fill:var(--superficie)"/>
    <path d="M36 66c0-14 10-22 24-22s24 8 24 22-10 26-24 26-24-12-24-26z" style="fill:var(--amarelo)" stroke-width="3"/>
    <g style="stroke:var(--tinta-fixa)">
      <circle cx="48" cy="60" r="3.5" style="fill:var(--tinta-fixa)" stroke="none"/>
      <circle cx="72" cy="60" r="3.5" style="fill:var(--tinta-fixa)" stroke="none"/>
      <path d="M56 70h8"/>
      ${BOCAS[humor] || BOCAS.feliz}
    </g>
    <path d="M50 22q6-8 10 0q4-8 10 0"/>
  </svg>`;
}

let desenhar = rascunho;

export function registrarMascote(fn) {
  desenhar = fn;
}

export function Mascote({ humor = 'feliz', tamanho, rotulo } = {}) {
  const props = { class: 'mascote' };
  if (tamanho) props.style = { '--tamanho': tamanho };
  if (rotulo) {
    props.role = 'img';
    props['aria-label'] = rotulo;
  } else {
    props['aria-hidden'] = 'true';
  }
  return h('span', props, svg(desenhar({ humor })));
}
