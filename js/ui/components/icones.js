// Ícones SVG de traço preto simples (desenhados à mão, sem dependências).
// Todos usam currentColor, então herdam a cor do texto.

const base = (conteudo, viewBox = '0 0 48 48') =>
  `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${conteudo}</svg>`;

export const icones = {
  buzzer: base('<path d="M10 32a14 14 0 0 1 28 0z"/><rect x="6" y="32" width="36" height="8" rx="3"/><path d="M24 5v6M12 9l3 4M36 9l-3 4"/>'),
  placar: base('<rect x="5" y="10" width="38" height="28" rx="4"/><path d="M24 10v28M12 19h6v5h-6v5h6M32 18l3-2v13"/>'),
  sorteio: base('<rect x="8" y="8" width="32" height="32" rx="6"/><circle cx="17" cy="17" r="2.5" fill="currentColor"/><circle cx="24" cy="24" r="2.5" fill="currentColor"/><circle cx="31" cy="31" r="2.5" fill="currentColor"/>'),
  quiz: base('<path d="M8 9h32a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H22l-9 7v-7H8a3 3 0 0 1-3-3V12a3 3 0 0 1 3-3z"/><path d="M20 17a4 4 0 1 1 6 3.5c-1.5.8-2 1.6-2 3"/><circle cx="24" cy="28" r="1.2" fill="currentColor"/>'),
  passa: base('<path d="M8 16h30l-7-7M40 32H10l7 7"/>'),
  espiral: base('<path d="M24 24a2 2 0 0 1 4 0a6 6 0 0 1-12 0a10 10 0 0 1 20 0a14 14 0 0 1-28 0a18 18 0 0 1 36 0"/>'),
  provas: base('<path d="M12 6h18l8 8v28H12z"/><path d="M30 6v8h8M18 28l5 5 9-11"/>'),
  ferramentas: base('<circle cx="24" cy="27" r="14"/><path d="M24 27l6-6M19 6h10M24 6v7M37 13l3-3"/>'),

  fechar: base('<path d="M14 14l20 20M34 14L14 34"/>'),
  mais: base('<path d="M24 12v24M12 24h24"/>'),
  info: base('<circle cx="24" cy="24" r="18"/><path d="M24 22v11"/><circle cx="24" cy="15.5" r="1.2" fill="currentColor"/>'),
  sucesso: base('<circle cx="24" cy="24" r="18"/><path d="M16 24l6 6 11-12"/>'),
  aviso: base('<path d="M24 6l20 35H4z"/><path d="M24 19v10"/><circle cx="24" cy="35" r="1.2" fill="currentColor"/>'),
  erro: base('<circle cx="24" cy="24" r="18"/><path d="M17 17l14 14M31 17L17 31"/>'),
  tema: base('<circle cx="24" cy="24" r="16"/><path d="M24 8a16 16 0 0 1 0 32z" fill="currentColor"/>'),
  juiz: base('<circle cx="20" cy="20" r="12"/><path d="M29 29l12 12M15 20h10M20 15v10"/>'),
  telaCheia: base('<path d="M8 18V8h10M30 8h10v10M40 30v10H30M18 40H8V30"/>'),
  desfazer: base('<path d="M18 12L8 22l10 10"/><path d="M8 22h20a12 12 0 0 1 0 24h-6"/>'),
  refazer: base('<path d="M30 12l10 10-10 10"/><path d="M40 22H20a12 12 0 0 0 0 24h6"/>'),
  voltar: base('<path d="M28 10L14 24l14 14"/>'),
  projetor: base('<rect x="5" y="8" width="38" height="24" rx="3"/><path d="M24 32v8M15 42h18"/>'),
  equipes: base('<circle cx="16" cy="16" r="6"/><circle cx="33" cy="16" r="6"/><path d="M5 38c0-7 5-12 11-12s11 5 11 12M22 38c0-7 5-12 11-12s10 5 10 12"/>'),
  turmas: base('<rect x="8" y="5" width="30" height="38" rx="3"/><path d="M8 5v38M15 14h16M15 21h16M15 28h10"/>'),
  raio: base('<path d="M27 4L10 27h12l-3 17 19-25H26z" fill="currentColor"/>'),
  seta: base('<path d="M4 8c20-2 42 6 52 30"/><path d="M43 34l13 5 4-13"/>', '0 0 64 48'),
};
