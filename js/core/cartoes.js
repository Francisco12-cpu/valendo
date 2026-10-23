// Cartões de resposta impressos (estilo Plickers): cada aluno tem um cartão com um QR no
// meio e as letras A, B, C e D nas bordas. Ele segura com a letra escolhida para CIMA:
// a rotação do QR na câmera diz a letra. Lógica pura (a leitura usa vendor/jsQR na UI).

export const PREFIXO_CARTAO = 'VC1:';
export const LETRAS = ['A', 'B', 'C', 'D'];

export const conteudoCartao = (numero) => `${PREFIXO_CARTAO}${numero}`;

export function numeroDoCartao(texto) {
  const m = String(texto ?? '').match(/^VC1:(\d{1,3})$/);
  return m ? Number(m[1]) : null;
}

// Impresso: A em cima, B à direita, C embaixo, D à esquerda (sentido horário).
// cantos = { topLeftCorner, topRightCorner } do jsQR (coordenadas da imagem, y para baixo).
// Cartão de pé (A em cima): borda de cima do QR aponta para a direita (ângulo 0).
// B em cima = girado 90° anti-horário → a borda de cima aponta para cima (ângulo −90°).
export function letraPelaRotacao(cantos) {
  const dx = cantos.topRightCorner.x - cantos.topLeftCorner.x;
  const dy = cantos.topRightCorner.y - cantos.topLeftCorner.y;
  const graus = (Math.atan2(dy, dx) * 180) / Math.PI;
  const quadrante = ((Math.round(graus / 90) % 4) + 4) % 4; // 0 = 0°, 1 = 90°, 2 = 180°, 3 = −90°
  return { 0: 'A', 3: 'B', 2: 'C', 1: 'D' }[quadrante];
}

// Letra → id da opção (A = 1ª opção, B = 2ª...). V/F: A = verdadeiro, B = falso.
export function respostaDaLetra(q, letra) {
  const i = LETRAS.indexOf(letra);
  if (i < 0) return null;
  if (q.tipo === 'vf') return i === 0 ? true : i === 1 ? false : null;
  if (Array.isArray(q.opcoes)) return q.opcoes[i] ? (q.tipo === 'multipla' ? [q.opcoes[i].id] : q.opcoes[i].id) : null;
  return null;
}
