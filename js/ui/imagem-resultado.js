// Exporta o resultado de uma partida como imagem PNG (para mandar no grupo da turma).
// Desenha num <canvas>: título, taxa geral, top 5 e acertos por questão, no estilo caderno.
import { t } from '../i18n/i18n.js';
import { acertosPorQuestao, desempenho, resumoGeral } from '../core/relatorio.js';
import { baixar, nomeDeArquivo } from './arquivo.js';

const W = 1200;
const H = 675;
const TINTA = '#141414';
const PAPEL = '#FFFDF7';
const BARRA = '#2A78D6';
const LINHA = '#DCE6F5';
const LARANJA = '#B0401A';

function caixa(ctx, x, y, w, h, cor = '#FFFFFF') {
  ctx.fillStyle = TINTA;
  ctx.fillRect(x + 6, y + 6, w, h);
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = TINTA;
  ctx.strokeRect(x, y, w, h);
}

function cortar(ctx, texto, largura) {
  if (ctx.measureText(texto).width <= largura) return texto;
  let s = texto;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > largura) s = s.slice(0, -1);
  return `${s}…`;
}

export async function gerarImagemResultado(n) {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  // Papel pautado.
  ctx.fillStyle = PAPEL;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = LINHA;
  ctx.lineWidth = 1;
  for (let y = 40; y < H; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.fillStyle = TINTA;
  ctx.font = '700 64px Caveat, cursive';
  ctx.fillText(cortar(ctx, n.titulo ?? 'Valendo!', W - 120), 60, 92);
  const geral = resumoGeral(n);
  ctx.font = '500 26px "Space Grotesk", system-ui, sans-serif';
  ctx.fillText(`${t('relatorio.participantes', { n: geral.participantes })} · ${t('relatorio.perguntas', { n: geral.perguntas })}${geral.taxa === null ? '' : ` · ${t('relatorio.acertoGeral', { taxa: Math.round(geral.taxa * 100) })}`}`, 60, 136);

  // Top 5.
  caixa(ctx, 60, 170, 460, 420);
  ctx.fillStyle = TINTA;
  ctx.font = '700 40px Caveat, cursive';
  ctx.fillText(t('relatorio.top'), 84, 220);
  const melhores = [...n.participantes].sort((a, b) => b.pontos - a.pontos).slice(0, 5);
  const usarPontos = melhores.some((p) => p.pontos);
  const lista = usarPontos ? melhores : desempenho(n).slice(0, 5);
  lista.forEach((p, i) => {
    const y = 280 + i * 62;
    ctx.fillStyle = ['#FFD23F', '#3FC1E0', '#FF5C8A', '#3DBE5A', '#B9A8FF'][i];
    ctx.beginPath();
    ctx.arc(104, y - 10, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = TINTA;
    ctx.stroke();
    ctx.fillStyle = TINTA;
    ctx.font = '700 24px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 104, y - 2);
    ctx.textAlign = 'left';
    ctx.font = '700 26px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(cortar(ctx, p.nome, 250), 140, y);
    ctx.textAlign = 'right';
    ctx.fillText(usarPontos ? String(p.pontos) : `${p.certas}/${p.total}`, 492, y);
    ctx.textAlign = 'left';
  });

  // Acertos por questão.
  caixa(ctx, 560, 170, 580, 420);
  ctx.fillStyle = TINTA;
  ctx.font = '700 40px Caveat, cursive';
  ctx.fillText(t('relatorio.porQuestao'), 584, 220);
  const qs = acertosPorQuestao(n).filter((q) => q.taxa !== null).slice(0, 10);
  const altura = Math.min(30, 320 / Math.max(1, qs.length));
  qs.forEach((q, i) => {
    const y = 250 + i * altura;
    const w = 380 * q.taxa;
    ctx.fillStyle = TINTA;
    ctx.font = '600 18px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(`${i + 1}`, 590, y + altura * 0.6);
    ctx.fillStyle = LINHA;
    ctx.fillRect(624, y + 4, 380, altura - 10);
    ctx.fillStyle = BARRA;
    ctx.fillRect(624, y + 4, Math.max(2, w), altura - 10);
    ctx.fillStyle = TINTA;
    ctx.fillText(`${Math.round(q.taxa * 100)}%`, 1016, y + altura * 0.6);
  });

  ctx.fillStyle = LARANJA;
  ctx.font = '700 30px Caveat, cursive';
  ctx.fillText('Valendo!', 60, H - 34);
  ctx.fillStyle = '#4A4743';
  ctx.font = '500 20px "Space Grotesk", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${n.data ? new Date(n.data).toLocaleDateString('pt-BR') : ''} · Feito por Francisco Audir · @filho.af`, W - 60, H - 36);
  return canvas;
}

export async function baixarImagemResultado(n) {
  const canvas = await gerarImagemResultado(n);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  baixar(`${nomeDeArquivo(n.titulo)}-resultado.png`, blob);
}
