// #/atividades/editar?id=... — editor de atividade. Salva sozinho a cada mudança.
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { validar, duplicar, MODALIDADES, DIFICULDADES, NIVEIS_CONFIG, RANKINGS, regrasPadrao } from '../../core/activity.js';
import { LISTA_TIPOS, novaQuestao, validarQuestao } from '../../core/questions/index.js';
import { idCurto } from '../../core/ids.js';
import { converterTexto, importarCSV, exportarJSON, exportarCSV } from '../../core/arquivos.js';
import { lerAtividade, salvarAtividade } from '../../storage/atividades.js';
import { EditorQuestao, NOMES_TIPOS } from '../questoes.js';
import { baixar, escolherArquivos, nomeDeArquivo } from '../arquivo.js';
import { Botao } from '../components/botao.js';
import { Escolha } from '../components/escolha.js';
import { Stepper } from '../components/stepper.js';
import { Switch } from '../components/switch.js';
import { abrirModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { icones } from '../components/icones.js';
import { nomeModalidade } from './atividades.js';

export const titulo = () => t('editor.titulo');

// Quais ajustes aparecem em cada modalidade e nível (o resto fica escondido).
const AJUSTES = {
  quiz: { basica: ['tempoPergunta', 'porAcerto'], avancada: ['velocidade', 'embaralharPerguntas', 'embaralharOpcoes', 'ranking', 'mostrarExplicacao'], personalizada: ['sequencia', 'erroTira'] },
  'passa-repassa': { basica: ['tempoPergunta', 'paAcerto', 'paRepassa'], avancada: ['paErroRepassa', 'torta', 'embaralharPerguntas'], personalizada: ['mostrarExplicacao'] },
  buzzer: { basica: ['porAcerto'], avancada: ['erroTira', 'embaralharPerguntas'], personalizada: ['mostrarExplicacao'] },
  prova: { basica: ['tempoTotal', 'embaralharPerguntas'], avancada: ['embaralharOpcoes', 'mostrarExplicacao'], personalizada: ['porAcerto'] },
  espiral: { basica: ['tempoTotal'], avancada: ['embaralharPerguntas', 'embaralharOpcoes'], personalizada: ['porAcerto', 'mostrarExplicacao'] },
  personalizada: {
    basica: ['tempoPergunta', 'porAcerto'],
    avancada: ['velocidade', 'embaralharPerguntas', 'embaralharOpcoes', 'ranking', 'mostrarExplicacao', 'tempoTotal'],
    personalizada: ['sequencia', 'erroTira', 'paAcerto', 'paRepassa', 'paErroRepassa', 'torta'],
  },
};

function ajustesVisiveis(modalidade, nivel) {
  const mapa = AJUSTES[modalidade] ?? AJUSTES.personalizada;
  const ate = NIVEIS_CONFIG.indexOf(nivel);
  return NIVEIS_CONFIG.slice(0, ate + 1).flatMap((n) => mapa[n]);
}

export function render(alvo, params) {
  const id = params.get('id');
  let a = null;
  let guardar = null;
  const status = h('span', { class: 'etiqueta editor__status', 'aria-live': 'polite' });

  const salvarAgora = async () => {
    guardar = null;
    a.atualizadoEm = new Date().toISOString();
    await salvarAtividade(a);
    status.textContent = t('editor.salvo');
  };
  const mudou = () => {
    status.textContent = t('editor.salvando');
    clearTimeout(guardar);
    guardar = setTimeout(salvarAgora, 400);
    atualizarValidacao();
  };

  const perguntas = h('ol', { class: 'perguntas', role: 'list' });
  const ajustes = h('div', { class: 'pilha' });
  const resumo = h('p', { class: 'editor__resumo', 'aria-live': 'polite' });
  const errosPorQuestao = new Map();

  function atualizarValidacao() {
    const { erros } = validar(a);
    const n = a.conteudo.perguntas.length;
    resumo.textContent = !n ? t('editor.semPerguntas') : erros.length ? t('editor.pendencias', { n: erros.length }) : t('editor.tudoCerto', { n });
    resumo.dataset.ok = String(n > 0 && !erros.length);
    a.conteudo.perguntas.forEach((q) => {
      const alvoErro = errosPorQuestao.get(q.id);
      if (alvoErro) alvoErro.textContent = validarQuestao(q).join(' · ');
    });
  }

  // ---------- Perguntas ----------
  function desenharPerguntas(focar) {
    errosPorQuestao.clear();
    const nomes = NOMES_TIPOS();
    perguntas.replaceChildren(
      ...a.conteudo.perguntas.map((q, i) => {
        const erro = h('p', { class: 'erro-texto', role: 'status' });
        errosPorQuestao.set(q.id, erro);
        const mover = (d) => {
          const lista = a.conteudo.perguntas;
          const j = i + d;
          if (j < 0 || j >= lista.length) return;
          [lista[i], lista[j]] = [lista[j], lista[i]];
          mudou();
          desenharPerguntas(lista[j].id);
        };
        const acoes = h(
          'div',
          { class: 'pergunta__acoes' },
          Botao({ icone: 'cima', variante: 'fantasma', rotulo: t('editor.subir', { n: i + 1 }), desativado: i === 0, aoClicar: () => mover(-1) }),
          Botao({ icone: 'baixo', variante: 'fantasma', rotulo: t('editor.descer', { n: i + 1 }), desativado: i === a.conteudo.perguntas.length - 1, aoClicar: () => mover(1) }),
          Botao({
            icone: 'copiar',
            variante: 'fantasma',
            rotulo: t('editor.duplicarPergunta', { n: i + 1 }),
            aoClicar: () => {
              const copia = { ...structuredClone(q), id: idCurto(a.conteudo.perguntas.map((x) => x.id), 'q') };
              a.conteudo.perguntas.splice(i + 1, 0, copia);
              mudou();
              desenharPerguntas(copia.id);
            },
          }),
          Botao({
            icone: 'lixo',
            variante: 'fantasma',
            rotulo: t('editor.apagarPergunta', { n: i + 1 }),
            aoClicar: async () => {
              const vazia = !q.enunciado.trim();
              if (!vazia) {
                const ok = await abrirModal({
                  titulo: t('editor.apagarPerguntaTitulo', { n: i + 1 }),
                  conteudo: q.enunciado,
                  acoes: [
                    { texto: t('vitrine.secundario'), valor: false },
                    { texto: t('editor.apagar'), variante: 'perigo', valor: true },
                  ],
                });
                if (!ok) return;
              }
              a.conteudo.perguntas.splice(i, 1);
              mudou();
              desenharPerguntas();
            },
          })
        );
        return h(
          'li',
          { class: 'cartao pergunta', 'data-id': q.id, 'aria-label': t('editor.perguntaN', { n: i + 1 }) },
          h('div', { class: 'pergunta__topo' }, h('span', { class: 'pergunta__numero manuscrito' }, `${i + 1}`), h('span', { class: 'etiqueta' }, nomes[q.tipo]), acoes),
          EditorQuestao(q, { mudar: mudou, nivel: a.nivelConfig, comMultiplicador: ['quiz', 'buzzer', 'personalizada'].includes(a.modalidade) }),
          erro
        );
      })
    );
    atualizarValidacao();
    if (focar) perguntas.querySelector(`[data-id="${focar}"] textarea`)?.focus();
  }

  function adicionar(tipo) {
    const q = novaQuestao(tipo, idCurto(a.conteudo.perguntas.map((x) => x.id), 'q'));
    if (a.regras.tempo.porPergunta) q.tempo = a.regras.tempo.porPergunta;
    if (q.pontos) q.pontos = a.regras.pontuacao.porAcerto;
    a.conteudo.perguntas.push(q);
    mudou();
    desenharPerguntas(q.id);
  }

  function anexar(novas) {
    const ids = a.conteudo.perguntas.map((x) => x.id);
    for (const q of novas) {
      q.id = idCurto(ids, 'q');
      ids.push(q.id);
      a.conteudo.perguntas.push(q);
    }
    mudou();
    desenharPerguntas();
  }

  async function colar() {
    const area = h('textarea', { class: 'campo campo--area', rows: 12, spellcheck: 'false', placeholder: t('editor.colarExemplo'), 'aria-label': t('editor.colarTexto') });
    const previa = h('p', { class: 'texto-suave', 'aria-live': 'polite' });
    area.addEventListener('input', () => {
      const { perguntas: qs, avisos } = converterTexto(area.value);
      previa.textContent = qs.length ? t('editor.colarPrevia', { n: qs.length, avisos: avisos.length }) : '';
    });
    const ok = await abrirModal({
      titulo: t('editor.colarTexto'),
      conteudo: h('div', { class: 'pilha' }, h('p', { class: 'texto-suave' }, t('editor.colarDica')), h('pre', { class: 'exemplo' }, t('editor.colarExemplo')), area, previa),
      acoes: [
        { texto: t('vitrine.secundario'), valor: false },
        { texto: t('editor.converter'), variante: 'primario', valor: true },
      ],
    });
    if (!ok) return;
    const { perguntas: qs, avisos } = converterTexto(area.value);
    if (!qs.length) return toast(t('editor.nadaConvertido'), { tipo: 'aviso' });
    anexar(qs);
    toast(t('editor.convertidas', { n: qs.length }), { tipo: 'sucesso' });
    if (avisos.length) abrirModal({ titulo: t('editor.avisosConversao'), conteudo: h('ul', { class: 'lista-avisos' }, avisos.map((av) => h('li', null, `${t('atividades.perguntaN', { n: av.pergunta })}: ${av.aviso}`))) });
  }

  async function csv() {
    const [arq] = await escolherArquivos({ aceitar: '.csv,text/csv' });
    if (!arq) return;
    const { perguntas: qs, avisos } = importarCSV(arq.texto);
    anexar(qs);
    toast(t('editor.convertidas', { n: qs.length }), { tipo: 'sucesso' });
    if (avisos.length) abrirModal({ titulo: t('editor.avisosConversao'), conteudo: h('ul', { class: 'lista-avisos' }, avisos.map((av) => h('li', null, `${t('atividades.perguntaN', { n: av.pergunta })}: ${av.aviso}`))) });
  }

  // ---------- Ajustes (3 níveis) ----------
  function desenharAjustes() {
    const r = a.regras;
    const p = r.pontuacao;
    const visiveis = new Set(ajustesVisiveis(a.modalidade, a.nivelConfig));
    const campos = {
      tempoPergunta: () => Stepper({ rotulo: t('ajuste.tempoPergunta'), valor: r.tempo.porPergunta, min: 0, max: 300, passo: 5, aoMudar: (v) => ((r.tempo.porPergunta = v), mudou()) }),
      tempoTotal: () => Stepper({ rotulo: t('ajuste.tempoTotal'), valor: r.tempo.total, min: 0, max: 300, passo: 5, aoMudar: (v) => ((r.tempo.total = v), mudou()) }),
      porAcerto: () => Stepper({ rotulo: t('ajuste.porAcerto'), valor: p.porAcerto, min: 0, max: 10000, passo: 100, aoMudar: (v) => ((p.porAcerto = v), mudou()) }),
      erroTira: () => Stepper({ rotulo: t('ajuste.erroTira'), valor: p.erroTira, min: 0, max: 10000, passo: 50, aoMudar: (v) => ((p.erroTira = v), mudou()) }),
      velocidade: () => Switch({ rotulo: t('ajuste.velocidade'), ligado: p.velocidade, aoMudar: (v) => ((p.velocidade = v), mudou()) }),
      sequencia: () => Switch({ rotulo: t('ajuste.sequencia'), ligado: p.sequencia, aoMudar: (v) => ((p.sequencia = v), mudou()) }),
      embaralharPerguntas: () => Switch({ rotulo: t('ajuste.embaralharPerguntas'), ligado: r.embaralharPerguntas, aoMudar: (v) => ((r.embaralharPerguntas = v), mudou()) }),
      embaralharOpcoes: () => Switch({ rotulo: t('ajuste.embaralharOpcoes'), ligado: r.embaralharOpcoes, aoMudar: (v) => ((r.embaralharOpcoes = v), mudou()) }),
      mostrarExplicacao: () => Switch({ rotulo: t('ajuste.mostrarExplicacao'), ligado: r.mostrarExplicacao, aoMudar: (v) => ((r.mostrarExplicacao = v), mudou()) }),
      ranking: () =>
        Escolha({
          rotulo: t('ajuste.ranking'),
          valor: a.exibicao.ranking,
          compacta: true,
          aoMudar: (v) => ((a.exibicao.ranking = v), mudou()),
          opcoes: RANKINGS.map((x) => ({ valor: x, texto: t(`ranking.${x}`) })),
        }),
      paAcerto: () => Stepper({ rotulo: t('ajuste.paAcerto'), valor: p.passaRepassa.acerto, min: 0, max: 100, aoMudar: (v) => ((p.passaRepassa.acerto = v), mudou()) }),
      paRepassa: () => Stepper({ rotulo: t('ajuste.paRepassa'), valor: p.passaRepassa.repassa, min: 0, max: 100, aoMudar: (v) => ((p.passaRepassa.repassa = v), mudou()) }),
      paErroRepassa: () => Stepper({ rotulo: t('ajuste.paErroRepassa'), valor: p.passaRepassa.erroRepassa, min: -100, max: 0, aoMudar: (v) => ((p.passaRepassa.erroRepassa = v), mudou()) }),
      torta: () => Switch({ rotulo: t('ajuste.torta'), ligado: p.passaRepassa.torta, aoMudar: (v) => ((p.passaRepassa.torta = v), mudou()) }),
    };
    const ordem = Object.keys(campos).filter((c) => visiveis.has(c));
    ajustes.replaceChildren(
      Escolha({
        rotulo: t('ajuste.nivel'),
        valor: a.nivelConfig,
        compacta: true,
        aoMudar: (v) => {
          a.nivelConfig = v;
          mudou();
          desenharAjustes();
          desenharPerguntas();
        },
        opcoes: NIVEIS_CONFIG.map((n) => ({ valor: n, texto: t(`nivel.${n}`) })),
      }),
      h('p', { class: 'texto-suave dica' }, t(`nivel.${a.nivelConfig}Dica`)),
      h('div', { class: 'ajustes-grade' }, ordem.map((c) => campos[c]())),
      Botao({
        texto: t('ajuste.restaurar'),
        variante: 'fantasma',
        aoClicar: () => {
          a.regras = regrasPadrao(a.modalidade);
          mudou();
          desenharAjustes();
        },
      })
    );
  }

  // ---------- Montagem ----------
  async function montar() {
    a = await lerAtividade(id);
    if (!a || a.erro) {
      alvo.append(h('div', { class: 'vazio cartao' }, h('h1', { tabindex: '-1' }, t('editor.naoAchou')), h('p', null, a?.erro ?? ''), h('a', { class: 'botao', href: '#/atividades' }, t('editor.voltar'))));
      return;
    }
    status.textContent = t('editor.salvo');
    const campoTitulo = h('input', { id: 'atv-titulo', class: 'campo campo--titulo', maxlength: 120 });
    campoTitulo.value = a.titulo;
    campoTitulo.addEventListener('input', () => ((a.titulo = campoTitulo.value.trim() || t('atividades.semTitulo')), mudou()));

    const modalidade = h('select', { id: 'atv-modalidade', class: 'campo' }, MODALIDADES.map((m) => h('option', { value: m }, nomeModalidade(m))));
    modalidade.value = a.modalidade;
    modalidade.addEventListener('change', () => {
      a.modalidade = modalidade.value;
      mudou();
      desenharAjustes();
    });
    const disciplina = h('input', { id: 'atv-disciplina', class: 'campo', maxlength: 40, placeholder: t('editor.disciplinaDica') });
    disciplina.value = a.disciplina;
    disciplina.addEventListener('input', () => ((a.disciplina = disciplina.value.trim()), mudou()));
    const tags = h('input', { id: 'atv-tags', class: 'campo', maxlength: 200, placeholder: t('editor.tagsDica') });
    tags.value = a.tags.join(', ');
    tags.addEventListener('input', () => ((a.tags = tags.value.split(',').map((s) => s.trim()).filter(Boolean)), mudou()));
    const dificuldade = Escolha({
      rotulo: t('atividades.dificuldade'),
      valor: a.dificuldade,
      compacta: true,
      aoMudar: (v) => ((a.dificuldade = v), mudou()),
      opcoes: DIFICULDADES.map((d) => ({ valor: d, texto: t(`dificuldade.${d}`) })),
    });

    const nomes = NOMES_TIPOS();
    const adicionarBotoes = h('div', { class: 'linha' }, LISTA_TIPOS.map((tipo) => Botao({ texto: nomes[tipo], icone: 'mais', aoClicar: () => adicionar(tipo) })));

    const exportar = h('select', { class: 'campo editor__exportar', 'aria-label': t('editor.exportar') }, [
      h('option', { value: '' }, t('editor.exportar')),
      h('option', { value: 'json' }, t('atividades.exportarJSON')),
      h('option', { value: 'csv' }, t('atividades.exportarCSV')),
    ]);
    exportar.addEventListener('change', () => {
      if (exportar.value === 'json') baixar(`${nomeDeArquivo(a.titulo)}.valendo.json`, exportarJSON([a]));
      if (exportar.value === 'csv') baixar(`${nomeDeArquivo(a.titulo)}.csv`, exportarCSV(a), 'text/csv');
      exportar.value = '';
    });

    alvo.append(
      h('p', null, h('a', { href: '#/atividades', class: 'voltar' }, svg(icones.voltar), t('editor.voltar'))),
      h(
        'div',
        { class: 'tela__topo editor__topo' },
        h('h1', { class: 'sr-only', tabindex: '-1' }, t('editor.titulo')),
        h('label', { for: 'atv-titulo', class: 'texto-suave' }, t('atividades.tituloAtv')),
        campoTitulo,
        h('div', { class: 'linha' }, status, resumo)
      ),
      h(
        'div',
        { class: 'linha editor__barra' },
        h('a', { class: 'botao botao--primario', href: `#/jogar?id=${a.id}` }, svg(icones.raio), h('span', null, t('editor.jogar'))),
        h('a', { class: 'botao', href: `#/atividades/testar?id=${a.id}` }, svg(icones.quiz), h('span', null, t('editor.testar'))),
        h('a', { class: 'botao', href: `#/atividades/testar?id=${a.id}&modo=previa` }, t('editor.previa')),
        Botao({
          texto: t('atividades.editarCopia'),
          variante: 'fantasma',
          aoClicar: async () => {
            const copia = duplicar(a);
            await salvarAtividade(copia);
            location.hash = `#/atividades/editar?id=${copia.id}`;
          },
        }),
        exportar
      ),
      h(
        'div',
        { class: 'editor' },
        h(
          'div',
          { class: 'editor__principal' },
          h('section', { class: 'pilha', 'aria-labelledby': 'ed-perguntas' }, h('h2', { id: 'ed-perguntas', class: 'secao__titulo' }, t('editor.perguntas')), perguntas),
          h(
            'section',
            { class: 'cartao pilha editor__adicionar', 'aria-labelledby': 'ed-adicionar' },
            h('h2', { id: 'ed-adicionar' }, t('editor.adicionar')),
            adicionarBotoes,
            h('div', { class: 'linha' }, Botao({ texto: t('editor.colarTexto'), variante: 'amarelo', aoClicar: colar }), Botao({ texto: t('editor.importarCSV'), aoClicar: csv }))
          )
        ),
        h(
          'aside',
          { class: 'editor__lado' },
          h(
            'section',
            { class: 'cartao pilha', 'aria-labelledby': 'ed-sobre' },
            h('h2', { id: 'ed-sobre' }, t('editor.sobre')),
            h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'atv-modalidade', class: 'rotulo' }, t('atividades.modalidade')), modalidade),
            h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'atv-disciplina', class: 'rotulo' }, t('atividades.disciplina')), disciplina),
            dificuldade,
            h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'atv-tags', class: 'rotulo' }, t('editor.tags')), tags)
          ),
          h('section', { class: 'cartao pilha', 'aria-labelledby': 'ed-ajustes' }, h('h2', { id: 'ed-ajustes' }, t('editor.ajustes')), ajustes)
        )
      )
    );
    desenharAjustes();
    desenharPerguntas();
  }
  montar();

  return () => {
    if (guardar) {
      clearTimeout(guardar);
      salvarAgora();
    }
  };
}
