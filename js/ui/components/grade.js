// Grade final (grupo × prova ou aluno × prova): correção automática, correção manual por
// questão, comentários e exportação em CSV (abre no Excel/Planilhas).
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { Botao } from './botao.js';
import { abrirModal } from './modal.js';
import { baixar, nomeDeArquivo } from '../arquivo.js';

function textoResposta(r) {
  if (r === null || r === undefined || r === '') return '—';
  if (Array.isArray(r)) return r.join(', ').toUpperCase();
  if (r === true) return t('questao.verdadeiro');
  if (r === false) return t('questao.falso');
  return String(r);
}

const celulaCSV = (v) => {
  const s = String(v ?? '');
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// linhas: [{ id, nome, celulas: [{ coluna, visitou?, acertos, total, emBranco, pontos, comentario, questoes }] }]
// colunas: [{ id, titulo }]
export function Grade({ titulo, linhas, colunas, rotuloLinha, aoCorrigir, aoComentar }) {
  const tabela = h('div', { class: 'grade__rolagem' });

  function desenhar(novas = linhas) {
    linhas = novas;
    const totais = linhas.map((l) => ({ acertos: l.celulas.reduce((s, c) => s + c.acertos, 0), total: l.celulas.reduce((s, c) => s + c.total, 0) }));
    tabela.replaceChildren(
      h(
        'table',
        { class: 'grade' },
        h('caption', { class: 'sr-only' }, titulo),
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, rotuloLinha), colunas.map((c) => h('th', { scope: 'col' }, c.titulo)), h('th', { scope: 'col' }, t('grade.total')))),
        h(
          'tbody',
          null,
          linhas.map((l, i) =>
            h(
              'tr',
              null,
              h('th', { scope: 'row' }, l.nome),
              l.celulas.map((c, j) => {
                const taxa = c.total ? c.acertos / c.total : 0;
                const b = h(
                  'button',
                  { type: 'button', class: 'grade__celula', 'data-nivel': c.visitou === false ? 'vazia' : taxa >= 0.7 ? 'alta' : taxa >= 0.4 ? 'media' : 'baixa', 'aria-label': t('grade.celula', { nome: l.nome, coluna: colunas[j].titulo, n: c.acertos, total: c.total }) },
                  h('span', { class: 'grade__nota' }, `${c.acertos}/${c.total}`),
                  c.emBranco ? h('span', { class: 'grade__branco' }, t('grade.emBranco', { n: c.emBranco })) : null,
                  c.comentario ? h('span', { class: 'grade__coment', 'aria-hidden': 'true' }, '✎') : null
                );
                b.addEventListener('click', () => abrirCelula(l, colunas[j], c));
                return h('td', null, b);
              }),
              h('td', { class: 'grade__total' }, `${totais[i].acertos}/${totais[i].total}`)
            )
          )
        )
      )
    );
  }

  async function abrirCelula(linha, coluna, c) {
    const comentario = h('textarea', { class: 'campo campo--area', rows: 3, maxlength: 1000, 'aria-label': t('grade.comentario') });
    comentario.value = c.comentario ?? '';
    const lista = h(
      'ol',
      { class: 'grade__questoes' },
      c.questoes.map((q) => {
        const estado = h('span', { class: 'grade__estado', 'data-certo': String(q.correta) }, q.emBranco ? t('grade.branco') : q.correta ? '✓' : '✕');
        const escolhas = ['auto', 'certo', 'errado'].map((v) => {
          const atual = q.manual === null ? 'auto' : q.manual ? 'certo' : 'errado';
          const b = Botao({
            texto: t(`grade.${v}`),
            aoClicar: () => {
              const valor = v === 'auto' ? null : v === 'certo';
              aoCorrigir?.(linha.id, coluna.id, q.qid, valor);
              q.manual = valor;
              q.correta = valor ?? q.auto;
              estado.textContent = q.correta ? '✓' : q.emBranco ? t('grade.branco') : '✕';
              estado.dataset.certo = String(q.correta);
              escolhas.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            },
          });
          b.setAttribute('aria-pressed', String(v === atual));
          return b;
        });
        return h('li', { class: 'grade__questao' }, h('p', null, h('strong', null, q.enunciado)), h('p', { class: 'texto-suave' }, t('grade.respondeu'), ' ', textoResposta(q.resposta), ' ', estado), h('div', { class: 'linha' }, h('span', { class: 'texto-suave dica' }, t('grade.correcao')), escolhas));
      })
    );
    const ok = await abrirModal({
      titulo: `${linha.nome} · ${coluna.titulo}`,
      conteudo: h('div', { class: 'pilha' }, lista, h('label', { class: 'rotulo' }, t('grade.comentario'), comentario)),
      acoes: [{ texto: t('grade.salvar'), variante: 'primario', valor: true }],
    });
    if (ok || comentario.value !== (c.comentario ?? '')) aoComentar?.(linha.id, coluna.id, comentario.value);
  }

  function exportar() {
    const cab = [rotuloLinha, ...colunas.flatMap((c) => [`${c.titulo} (acertos)`, `${c.titulo} (em branco)`, `${c.titulo} (comentário)`]), t('grade.total')];
    const linhasCSV = linhas.map((l) => [
      l.nome,
      ...l.celulas.flatMap((c) => [`${c.acertos}/${c.total}`, c.emBranco, c.comentario ?? '']),
      `${l.celulas.reduce((s, c) => s + c.acertos, 0)}/${l.celulas.reduce((s, c) => s + c.total, 0)}`,
    ]);
    const csv = [cab, ...linhasCSV].map((r) => r.map(celulaCSV).join(';')).join('\r\n');
    baixar(`${nomeDeArquivo(titulo)}-grade.csv`, `﻿${csv}\r\n`, 'text/csv');
  }

  desenhar();
  const el = h(
    'section',
    { class: 'pilha grade__secao', 'aria-label': titulo },
    h('div', { class: 'linha' }, h('h2', { class: 'secao__titulo' }, t('grade.titulo')), Botao({ texto: t('grade.exportar'), aoClicar: exportar })),
    h('p', { class: 'texto-suave dica' }, t('grade.dica')),
    tabela
  );
  el.atualizar = desenhar;
  return el;
}
