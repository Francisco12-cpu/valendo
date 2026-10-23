// #/relatorios — resultados das partidas salvas no aparelho, com gráficos, as questões
// mais erradas, "refazer as erradas" e exportar como imagem.
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { listar, ler, apagar } from '../../storage/db.js';
import { lerAtividade, salvarAtividade } from '../../storage/atividades.js';
import * as Rel from '../../core/relatorio.js';
import { GraficoBarras } from '../components/grafico.js';
import { Botao } from '../components/botao.js';
import { abrirModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { Mascote } from '../components/mascote.js';
import { icones } from '../components/icones.js';
import { baixarImagemResultado } from '../imagem-resultado.js';

export const titulo = () => t('relatorio.titulo');

const pct = (v) => (v === null ? '—' : `${Math.round(v * 100)}%`);

export function render(alvo, params) {
  const id = params.get('id');
  if (id) detalhe(alvo, id);
  else lista(alvo);
}

async function lista(alvo) {
  const todos = (await listar('resultados')).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const itens = todos.map((r) => {
    const n = Rel.normalizarResultado(r);
    const g = Rel.resumoGeral(n);
    return h(
      'li',
      null,
      h(
        'a',
        { class: 'cartao relatorio-cartao', href: `#/relatorios?id=${r.id}` },
        h('span', { class: 'etiqueta' }, t(`modalidadeAtv.${r.modalidade}`) === `modalidadeAtv.${r.modalidade}` ? r.modalidade : t(`modalidadeAtv.${r.modalidade}`)),
        h('span', { class: 'relatorio-cartao__titulo manuscrito' }, r.titulo),
        h('span', { class: 'texto-suave' }, [r.data ? new Date(r.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '', t('relatorio.participantes', { n: g.participantes }), g.taxa === null ? '' : t('relatorio.acertoGeral', { taxa: Math.round(g.taxa * 100) })].filter(Boolean).join(' · '))
      )
    );
  });
  alvo.append(
    h('div', { class: 'tela__topo' }, h('h1', { tabindex: '-1' }, t('relatorio.titulo')), h('p', { class: 'tela__subtitulo' }, t('relatorio.subtitulo'))),
    itens.length ? h('ul', { class: 'turmas-lista', role: 'list' }, itens) : h('div', { class: 'vazio cartao' }, Mascote({ humor: 'neutro', tamanho: '6rem' }), h('p', null, t('relatorio.vazio')))
  );
}

async function detalhe(alvo, id) {
  const r = await ler('resultados', id);
  if (!r) {
    location.hash = '#/relatorios';
    return;
  }
  const n = Rel.normalizarResultado(r);
  const g = Rel.resumoGeral(n);
  const porQuestao = Rel.acertosPorQuestao(n).filter((q) => q.taxa !== null);
  const pessoas = Rel.desempenho(n).filter((p) => p.taxa !== null);
  const erradas = Rel.maisErradas(n);
  const atividade = r.atividadeId ? await lerAtividade(r.atividadeId) : null;

  const refazer = Botao({
    texto: t('relatorio.refazer'),
    variante: 'primario',
    icone: 'desfazer',
    desativado: !atividade || atividade.erro || !erradas.length,
    aoClicar: async () => {
      const nova = Rel.refazerErradas(atividade, n);
      if (!nova.conteudo.perguntas.length) return toast(t('relatorio.nadaRefazer'), { tipo: 'aviso' });
      await salvarAtividade(nova);
      toast(t('relatorio.refazerCriada', { n: nova.conteudo.perguntas.length }), { tipo: 'sucesso' });
      location.hash = `#/jogar?id=${nova.id}`;
    },
  });
  const imagem = Botao({ texto: t('relatorio.imagem'), aoClicar: () => baixarImagemResultado(n) });
  const excluir = Botao({
    texto: t('relatorio.apagar'),
    variante: 'fantasma',
    aoClicar: async () => {
      const ok = await abrirModal({ titulo: t('relatorio.apagarTitulo'), conteudo: t('relatorio.apagarTexto'), acoes: [{ texto: t('vitrine.secundario'), valor: false }, { texto: t('relatorio.apagar'), variante: 'perigo', valor: true }] });
      if (!ok) return;
      await apagar('resultados', id);
      location.hash = '#/relatorios';
    },
  });

  const numero = (valor, rotulo) => h('div', { class: 'relatorio-numero' }, h('span', { class: 'relatorio-numero__valor' }, valor), h('span', { class: 'texto-suave' }, rotulo));

  // h() ignora vazios; o append nativo escreveria "null".
  alvo.append(h('div', { class: 'pilha relatorio' },
    h('p', null, h('a', { href: '#/relatorios', class: 'voltar' }, svg(icones.voltar), t('relatorio.todos'))),
    h('div', { class: 'tela__topo' }, h('h1', { tabindex: '-1' }, r.titulo), h('p', { class: 'tela__subtitulo' }, r.data ? new Date(r.data).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' }) : '')),
    h('div', { class: 'linha' }, refazer, imagem, excluir),
    !atividade ? h('p', { class: 'texto-suave dica' }, t('relatorio.semAtividade')) : null,
    h('div', { class: 'relatorio-numeros' }, numero(String(g.participantes), t('relatorio.participantesRotulo')), numero(String(g.perguntas), t('relatorio.perguntasRotulo')), numero(pct(g.taxa), t('relatorio.acertoRotulo'))),
    erradas.length
      ? h(
          'section',
          { class: 'cartao pilha secao', 'aria-labelledby': 'rel-erradas' },
          h('h2', { id: 'rel-erradas' }, t('relatorio.maisErradas')),
          h('ol', { class: 'relatorio-erradas' }, erradas.map((q) => h('li', null, h('span', null, q.enunciado), h('span', { class: 'etiqueta' }, t('relatorio.acertaram', { taxa: Math.round(q.taxa * 100), n: q.certas, total: q.total })))))
        )
      : null,
    porQuestao.length ? h('section', { class: 'cartao secao' }, GraficoBarras({ titulo: t('relatorio.porQuestao'), descricao: t('relatorio.porQuestaoDesc'), itens: porQuestao.map((q, i) => ({ rotulo: `${i + 1}. ${q.enunciado}`, valor: q.taxa, texto: `${pct(q.taxa)} (${q.certas}/${q.total})` })), colunaValor: t('relatorio.acerto') })) : null,
    pessoas.length ? h('section', { class: 'cartao secao' }, GraficoBarras({ titulo: t('relatorio.desempenho'), descricao: t('relatorio.desempenhoDesc'), itens: pessoas.map((p) => ({ rotulo: p.nome, valor: p.taxa, texto: `${pct(p.taxa)} (${p.certas}/${p.total})` })), colunaValor: t('relatorio.acerto') })) : null
  ));
}
