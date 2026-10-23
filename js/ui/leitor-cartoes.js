// Lê vários cartões de resposta num mesmo quadro da câmera. O jsQR acha UM código por
// imagem (com vários, ele mistura os cantos e não lê nenhum), então procuramos em janelas
// sobrepostas (o quadro inteiro, metades e terços); em cada janela, achou → apaga → procura
// de novo. A rotação de cada QR diz a letra que o aluno escolheu.
import { numeroDoCartao, letraPelaRotacao } from '../core/cartoes.js';

function lerJanela(ctx, x0, y0, w, h, jsQR, achados, maximo = 4) {
  for (let i = 0; i < maximo; i++) {
    const img = ctx.getImageData(x0, y0, w, h);
    const qr = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
    if (!qr) return;
    const numero = numeroDoCartao(qr.data);
    const l = qr.location;
    if (numero !== null && !achados.has(numero)) achados.set(numero, letraPelaRotacao(l));
    // Apaga o QR encontrado (com folga) para achar o próximo nesta janela.
    const cantos = [l.topLeftCorner, l.topRightCorner, l.bottomRightCorner, l.bottomLeftCorner];
    const cx = cantos.reduce((s, p) => s + p.x, 0) / 4;
    const cy = cantos.reduce((s, p) => s + p.y, 0) / 4;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    cantos.forEach((p, k) => {
      const x = x0 + cx + (p.x - cx) * 1.35;
      const y = y0 + cy + (p.y - cy) * 1.35;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }
}

// Posições de janelas de tamanho `lado` cobrindo [0, total], com metade de sobreposição
// (a última encosta na borda): um cartão na divisa cabe inteiro em alguma.
function posicoes(total, lado) {
  if (lado >= total) return [0];
  const lista = [];
  for (let p = 0; p + lado < total; p += Math.round(lado / 2)) lista.push(p);
  lista.push(total - lado);
  return lista;
}

export function lerCartoesDaImagem(ctx, largura, altura, jsQR, { tamanhos = [1, 0.66, 0.45] } = {}) {
  const achados = new Map();
  // Trabalha numa cópia (apagar os QRs não pode estragar a imagem original).
  const copia = document.createElement('canvas');
  copia.width = largura;
  copia.height = altura;
  const c = copia.getContext('2d', { willReadFrequently: true });
  c.drawImage(ctx.canvas, 0, 0);
  lerJanela(c, 0, 0, largura, altura, jsQR, achados); // quadro inteiro (um cartão só)
  // Janelas quadradas: do tamanho do lado menor do quadro e menores.
  const menor = Math.min(largura, altura);
  for (const f of tamanhos) {
    const lado = Math.round(menor * f);
    for (const y of posicoes(altura, lado)) for (const x of posicoes(largura, lado)) lerJanela(c, x, y, lado, lado, jsQR, achados);
  }
  return [...achados].map(([numero, letra]) => ({ numero, letra }));
}
