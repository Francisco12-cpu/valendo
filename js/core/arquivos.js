// Entrada e saída de atividades: colar texto, CSV e .valendo.json. Lógica pura.
import { abrir, validar, SCHEMA_ATUAL } from './activity.js';
import { novaQuestao } from './questions/index.js';
import { lerNumero, normalizarTexto } from './questions/base.js';

// ---------- Colar texto e converter ----------
// 1) Enunciado          (ou "1." / "1 -")
// a) opção              (* antes ou depois marca a correta; "(x)" também)
// *b) opção correta
// Resposta: texto       → resposta curta (variações com "|")
// Resposta: 9,8 ±0,1 m/s² → numérica
// Resposta: V / F       → verdadeiro ou falso
// Explicação: ...
const RE_PERGUNTA = /^\s*(\d{1,3})\s*[).\-–]\s*(.+)$/;
const RE_OPCAO = /^\s*(\*)?\s*\(?([a-hA-H])\s*[).\-–]\s*(.+?)$/;
const RE_RESPOSTA = /^\s*(resposta|resp|r|gabarito)\s*[:=]\s*(.+)$/i;
const RE_EXPLICACAO = /^\s*(explica[cç][aã]o|coment[aá]rio)\s*[:=]\s*(.+)$/i;
const VERDADEIRO = ['v', 'verdadeiro', 'certo', 'c', 'true'];
const FALSO = ['f', 'falso', 'errado', 'e', 'false'];

function blocos(texto) {
  const linhas = String(texto ?? '').replace(/\r/g, '').split('\n');
  const numerado = linhas.some((l) => RE_PERGUNTA.test(l));
  const lista = [];
  let atual = null;
  for (const linha of linhas) {
    if (!linha.trim()) {
      if (!numerado && atual) {
        lista.push(atual);
        atual = null;
      }
      continue;
    }
    const inicio = numerado && linha.match(RE_PERGUNTA);
    if (inicio) {
      if (atual) lista.push(atual);
      atual = [inicio[2]];
    } else if (atual) atual.push(linha);
    else atual = [linha];
  }
  if (atual) lista.push(atual);
  return lista;
}

function lerOpcao(linha) {
  const m = linha.match(RE_OPCAO);
  if (!m) return null;
  let texto = m[3].trim();
  let correta = Boolean(m[1]);
  if (/\*\s*$/.test(texto) || /\((x|correta|certa)\)\s*$/i.test(texto)) {
    correta = true;
    texto = texto.replace(/\s*(\*|\((x|correta|certa)\))\s*$/i, '');
  }
  return { id: m[2].toLowerCase(), texto: texto.trim(), correta };
}

function lerResposta(valor) {
  const v = normalizarTexto(valor);
  if (VERDADEIRO.includes(v)) return { tipo: 'vf', correta: true };
  if (FALSO.includes(v)) return { tipo: 'vf', correta: false };
  const num = String(valor).match(/^\s*([-+]?[\d.,]+(?:e[-+]?\d+)?)\s*(?:(?:±|\+-|\+\/-)\s*([\d.,]+))?\s*(.*)$/i);
  if (num && Number.isFinite(lerNumero(num[1]))) {
    return { tipo: 'numerica', valor: lerNumero(num[1]), tolerancia: num[2] ? lerNumero(num[2]) || 0 : 0, unidade: num[3].trim() };
  }
  return { tipo: 'curta', aceitas: String(valor).split('|').map((s) => s.trim()).filter(Boolean) };
}

export function converterTexto(texto) {
  const perguntas = [];
  const avisos = [];
  blocos(texto).forEach((linhas, i) => {
    const enunciado = [];
    const opcoes = [];
    let resposta = null;
    let respostaBruta = '';
    let explicacao = '';
    for (const linha of linhas) {
      const exp = linha.match(RE_EXPLICACAO);
      const resp = linha.match(RE_RESPOSTA);
      const opcao = !resp && !exp ? lerOpcao(linha) : null;
      if (exp) explicacao = exp[2].trim();
      else if (resp) {
        respostaBruta = resp[2].trim();
        resposta = lerResposta(respostaBruta);
      }
      else if (opcao && (opcoes.length || enunciado.length)) opcoes.push(opcao);
      else if (opcoes.length) opcoes[opcoes.length - 1].texto += ` ${linha.trim()}`;
      else enunciado.push(linha.trim());
    }
    const id = `q${i + 1}`;
    const base = { enunciado: enunciado.join(' ').trim(), explicacao };
    let q;
    const textos = opcoes.map((o) => normalizarTexto(o.texto));
    const ehVF = opcoes.length === 2 && VERDADEIRO.includes(textos[0]) && FALSO.includes(textos[1]);
    if (ehVF) q = { ...novaQuestao('vf', id), ...base, correta: opcoes[0].correta || !opcoes[1].correta };
    else if (opcoes.length >= 2) {
      // Letras na ordem em que vieram (a, b, c...), mesmo se o texto pulou alguma.
      q = { ...novaQuestao('multipla', id), ...base, opcoes: opcoes.map((o, j) => ({ id: String.fromCharCode(97 + j), texto: o.texto, correta: o.correta })) };
      // "Resposta: c" (ou "a, c") marca as alternativas pela letra.
      const letras = respostaBruta.toLowerCase().replace(/\s+e\s+/g, ',').split(/[\s,;]+/).filter(Boolean);
      if (letras.length && letras.every((l) => /^[a-h]$/.test(l))) {
        q.opcoes.forEach((o) => (o.correta = letras.includes(o.id)));
      }
      if (!q.opcoes.some((o) => o.correta)) avisos.push({ pergunta: i + 1, aviso: 'sem alternativa correta marcada' });
    } else if (resposta) q = { ...novaQuestao(resposta.tipo, id), ...base, ...resposta, tipo: resposta.tipo };
    else {
      q = { ...novaQuestao('slide', id), ...base };
      avisos.push({ pergunta: i + 1, aviso: 'sem alternativas nem resposta: virou slide' });
    }
    if (!q.enunciado) avisos.push({ pergunta: i + 1, aviso: 'enunciado vazio' });
    perguntas.push(q);
  });
  return { perguntas, avisos };
}

// ---------- CSV ----------
export const COLUNAS_CSV = ['tipo', 'enunciado', 'a', 'b', 'c', 'd', 'e', 'f', 'resposta', 'pontos', 'tempo', 'explicacao', 'tags'];

export function lerCSV(texto) {
  const s = String(texto ?? '').replace(/^﻿/, '');
  const primeira = s.split('\n')[0] ?? '';
  const sep = ['\t', ';', ','].map((c) => [c, primeira.split(c).length]).sort((x, y) => y[1] - x[1])[0][0];
  const linhas = [];
  let linha = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (aspas) {
      if (c === '"' && s[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      linha.push(campo);
      if (linha.some((x) => x.trim())) linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim())) linhas.push(linha);
  return linhas;
}

const celula = (v) => {
  const s = String(v ?? '');
  return /[;"\n\r,\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function respostaCSV(q) {
  if (q.tipo === 'multipla') return q.opcoes.filter((o) => o.correta).map((o) => o.id).join(',');
  if (q.tipo === 'vf') return q.correta ? 'V' : 'F';
  if (q.tipo === 'curta') return q.aceitas.join('|');
  if (q.tipo === 'numerica') return `${q.valor}${q.tolerancia ? ` ±${q.tolerancia}` : ''}${q.unidade ? ` ${q.unidade}` : ''}`;
  if (q.tipo === 'slide') return q.texto ?? '';
  return '';
}

export function exportarCSV(atividade) {
  const linhas = [COLUNAS_CSV.join(';')];
  for (const q of atividade.conteudo.perguntas) {
    const opcoes = 'abcdef'.split('').map((l) => q.opcoes?.find((o) => o.id === l)?.texto ?? '');
    linhas.push([q.tipo, q.enunciado, ...opcoes, respostaCSV(q), q.pontos, q.tempo, q.explicacao, q.tags.join('|')].map(celula).join(';'));
  }
  return `﻿${linhas.join('\r\n')}\r\n`;
}

export function importarCSV(texto) {
  const linhas = lerCSV(texto);
  if (!linhas.length) return { perguntas: [], avisos: [{ pergunta: 0, aviso: 'arquivo vazio' }] };
  const cabecalho = linhas[0].map((c) => normalizarTexto(c));
  const temCabecalho = cabecalho.includes('enunciado');
  const indice = (nome) => (temCabecalho ? cabecalho.indexOf(nome) : COLUNAS_CSV.indexOf(nome));
  const pegar = (linha, nome) => (indice(nome) >= 0 ? (linha[indice(nome)] ?? '').trim() : '');
  const perguntas = [];
  const avisos = [];
  (temCabecalho ? linhas.slice(1) : linhas).forEach((linha, i) => {
    const id = `q${i + 1}`;
    const opcoes = 'abcdef'.split('').map((l) => ({ id: l, texto: pegar(linha, l) })).filter((o) => o.texto);
    const resposta = pegar(linha, 'resposta');
    let tipo = normalizarTexto(pegar(linha, 'tipo')) || (opcoes.length ? 'multipla' : 'curta');
    if (!['multipla', 'vf', 'curta', 'numerica', 'enquete', 'slide'].includes(tipo)) {
      avisos.push({ pergunta: i + 1, aviso: `tipo "${tipo}" desconhecido: virou múltipla escolha` });
      tipo = 'multipla';
    }
    let q = { ...novaQuestao(tipo, id), enunciado: pegar(linha, 'enunciado'), explicacao: pegar(linha, 'explicacao') };
    const pontos = lerNumero(pegar(linha, 'pontos'));
    const tempo = lerNumero(pegar(linha, 'tempo'));
    if (Number.isFinite(pontos)) q.pontos = pontos;
    if (Number.isFinite(tempo)) q.tempo = tempo;
    const tags = pegar(linha, 'tags');
    if (tags) q.tags = tags.split('|').map((t) => t.trim()).filter(Boolean);

    if (tipo === 'multipla') {
      const certas = resposta.toLowerCase().split(/[,\s|]+/).filter(Boolean);
      q.opcoes = opcoes.map((o) => ({ ...o, correta: certas.includes(o.id) }));
    } else if (tipo === 'enquete') q.opcoes = opcoes.map(({ id: oid, texto: t }) => ({ id: oid, texto: t }));
    else if (tipo === 'slide') q.texto = resposta;
    else if (resposta) {
      const r = lerResposta(resposta);
      if (tipo === 'vf') q.correta = r.tipo === 'vf' ? r.correta : true;
      else if (tipo === 'numerica' && r.tipo === 'numerica') q = { ...q, valor: r.valor, tolerancia: r.tolerancia, unidade: r.unidade };
      else if (tipo === 'curta') q.aceitas = resposta.split('|').map((s) => s.trim()).filter(Boolean);
    }
    perguntas.push(q);
  });
  return { perguntas, avisos };
}

// ---------- .valendo.json ----------
export function exportarJSON(atividades, { agora = new Date().toISOString() } = {}) {
  return JSON.stringify({ formato: 'valendo', versao: SCHEMA_ATUAL, exportadoEm: agora, atividades }, null, 2);
}

export function importarJSON(texto) {
  let dados;
  try {
    dados = JSON.parse(String(texto).replace(/^﻿/, ''));
  } catch {
    return { atividades: [], problemas: [{ titulo: '', erro: 'o arquivo não é um JSON válido' }] };
  }
  const lista = Array.isArray(dados) ? dados : Array.isArray(dados?.atividades) ? dados.atividades : [dados];
  const atividades = [];
  const problemas = [];
  for (const item of lista) {
    try {
      const a = abrir(item);
      const { erros } = validar(a);
      atividades.push(a);
      if (erros.length) problemas.push({ titulo: a.titulo, erro: `importada com pendências: ${erros.slice(0, 3).join('; ')}` });
    } catch (erro) {
      problemas.push({ titulo: item?.titulo ?? item?.nome ?? '', erro: erro.message });
    }
  }
  return { atividades, problemas };
}
