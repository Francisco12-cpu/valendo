// #/atividades — banco de atividades: criar, buscar, favoritar, duplicar, importar e exportar.
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { criarAtividade, duplicar, buscar, todasAsTags, todasAsDisciplinas, MODALIDADES, DIFICULDADES } from '../../core/activity.js';
import { exportarJSON, importarJSON, importarCSV, exportarCSV } from '../../core/arquivos.js';
import { listarAtividades, salvarAtividade, apagarAtividade } from '../../storage/atividades.js';
import { baixar, escolherArquivos, nomeDeArquivo } from '../arquivo.js';
import { Botao } from '../components/botao.js';
import { Escolha } from '../components/escolha.js';
import { abrirModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { icones } from '../components/icones.js';
import { Mascote } from '../components/mascote.js';

export const titulo = () => t('atividades.titulo');

export const nomeModalidade = (m) => t(`modalidadeAtv.${m}`);

export function render(alvo) {
  let todas = [];
  const filtro = { texto: '', tag: '', disciplina: '', dificuldade: '', favoritas: false };
  const lista = h('ul', { class: 'atividades', role: 'list' });
  const contagem = h('p', { class: 'texto-suave', 'aria-live': 'polite' });

  // ---------- Filtros ----------
  const busca = h('input', { id: 'atv-busca', class: 'campo', type: 'search', placeholder: t('atividades.buscarDica'), autocomplete: 'off' });
  busca.addEventListener('input', () => ((filtro.texto = busca.value), desenhar()));
  const selTag = h('select', { id: 'atv-tag', class: 'campo' });
  const selDisc = h('select', { id: 'atv-disc', class: 'campo' });
  const selDif = h(
    'select',
    { id: 'atv-dif', class: 'campo' },
    h('option', { value: '' }, t('atividades.todas')),
    DIFICULDADES.map((d) => h('option', { value: d }, t(`dificuldade.${d}`)))
  );
  selTag.addEventListener('change', () => ((filtro.tag = selTag.value), desenhar()));
  selDisc.addEventListener('change', () => ((filtro.disciplina = selDisc.value), desenhar()));
  selDif.addEventListener('change', () => ((filtro.dificuldade = selDif.value), desenhar()));
  const favoritas = h('button', { type: 'button', class: 'botao', 'aria-pressed': 'false' }, svg(icones.estrela), h('span', null, t('atividades.soFavoritas')));
  favoritas.addEventListener('click', () => {
    filtro.favoritas = !filtro.favoritas;
    favoritas.setAttribute('aria-pressed', String(filtro.favoritas));
    desenhar();
  });

  const preencherSelect = (sel, valores, rotuloTodos) => {
    const atual = sel.value;
    sel.replaceChildren(h('option', { value: '' }, rotuloTodos), ...valores.map((v) => h('option', { value: v }, v)));
    sel.value = valores.includes(atual) ? atual : '';
  };

  async function carregar() {
    todas = await listarAtividades();
    const validas = todas.filter((a) => !a.erro);
    preencherSelect(selTag, todasAsTags(validas), t('atividades.todasTags'));
    preencherSelect(selDisc, todasAsDisciplinas(validas), t('atividades.todasDisciplinas'));
    desenhar();
  }

  // ---------- Ações ----------
  async function nova() {
    const campo = h('input', { class: 'campo', maxlength: 80, value: '', placeholder: t('atividades.tituloDica'), 'aria-label': t('atividades.tituloAtv') });
    let modalidade = 'quiz';
    const ok = await abrirModal({
      titulo: t('atividades.nova'),
      conteudo: h(
        'div',
        { class: 'pilha' },
        h('label', { class: 'rotulo' }, t('atividades.tituloAtv'), campo),
        Escolha({
          rotulo: t('atividades.modalidade'),
          valor: modalidade,
          compacta: true,
          aoMudar: (v) => (modalidade = v),
          opcoes: MODALIDADES.map((m) => ({ valor: m, texto: nomeModalidade(m) })),
        })
      ),
      acoes: [
        { texto: t('vitrine.secundario'), valor: false },
        { texto: t('atividades.criar'), variante: 'primario', valor: true },
      ],
    });
    if (!ok) return;
    const a = criarAtividade({ titulo: campo.value.trim() || t('atividades.semTitulo'), modalidade });
    await salvarAtividade(a);
    location.hash = `#/atividades/editar?id=${a.id}`;
  }

  async function importar() {
    const arquivos = await escolherArquivos({ aceitar: '.json,.valendo.json,.csv,text/csv,application/json', varios: true });
    let total = 0;
    const problemas = [];
    const ids = new Set(todas.map((a) => a.id));
    for (const arq of arquivos) {
      if (/\.csv$/i.test(arq.nome)) {
        const { perguntas, avisos } = importarCSV(arq.texto);
        const a = criarAtividade({ titulo: arq.nome.replace(/\.csv$/i, '') });
        a.conteudo.perguntas = perguntas;
        await salvarAtividade(a);
        total += 1;
        avisos.forEach((av) => problemas.push(`${arq.nome}, ${t('atividades.perguntaN', { n: av.pergunta })}: ${av.aviso}`));
      } else {
        const { atividades, problemas: probs } = importarJSON(arq.texto);
        for (const a of atividades) {
          // Mesmo id já existe? Importa como cópia, sem apagar a do aparelho.
          const final = ids.has(a.id) ? duplicar(a, { titulo: `${a.titulo} (${t('atividades.importada')})` }) : a;
          ids.add(final.id);
          await salvarAtividade(final);
          total += 1;
        }
        probs.forEach((p) => problemas.push(`${arq.nome}${p.titulo ? ` — ${p.titulo}` : ''}: ${p.erro}`));
      }
    }
    await carregar();
    if (total) toast(t('atividades.importadas', { n: total }), { tipo: 'sucesso' });
    if (problemas.length) {
      abrirModal({ titulo: t('atividades.avisosImportacao'), conteudo: h('ul', { class: 'lista-avisos' }, problemas.map((p) => h('li', null, p))) });
    }
  }

  function exportarTodas() {
    const validas = todas.filter((a) => !a.erro);
    if (!validas.length) return toast(t('atividades.nadaExportar'), { tipo: 'aviso' });
    baixar(`valendo-atividades-${new Date().toISOString().slice(0, 10)}.valendo.json`, exportarJSON(validas));
  }

  async function acaoCartao(a, acao) {
    if (acao === 'favorita') {
      a.favorita = !a.favorita;
      await salvarAtividade(a);
      return desenhar();
    }
    if (acao === 'duplicar' || acao === 'copia') {
      const copia = duplicar(a);
      await salvarAtividade(copia);
      toast(t('atividades.duplicada'), { tipo: 'sucesso' });
      if (acao === 'copia') location.hash = `#/atividades/editar?id=${copia.id}`;
      else carregar();
      return;
    }
    if (acao === 'json') return baixar(`${nomeDeArquivo(a.titulo)}.valendo.json`, exportarJSON([a]));
    if (acao === 'csv') return baixar(`${nomeDeArquivo(a.titulo)}.csv`, exportarCSV(a), 'text/csv');
    if (acao === 'apagar') {
      const ok = await abrirModal({
        titulo: t('atividades.apagarTitulo'),
        conteudo: t('atividades.apagarTexto', { titulo: a.titulo }),
        acoes: [
          { texto: t('vitrine.secundario'), valor: false },
          { texto: t('atividades.apagar'), variante: 'perigo', valor: true },
        ],
      });
      if (!ok) return;
      await apagarAtividade(a.id);
      toast(t('atividades.apagada'));
      carregar();
    }
  }

  // ---------- Lista ----------
  function cartao(a) {
    if (a.erro) {
      return h('li', { class: 'cartao atividade atividade--erro' }, h('h2', { class: 'atividade__titulo' }, a.titulo), h('p', { class: 'erro-texto' }, a.erro));
    }
    const n = a.conteudo.perguntas.length;
    const estrela = h(
      'button',
      { type: 'button', class: 'botao botao--icone atividade__estrela', 'aria-pressed': String(a.favorita), 'aria-label': a.favorita ? t('atividades.desfavoritar', { titulo: a.titulo }) : t('atividades.favoritar', { titulo: a.titulo }) },
      svg(icones.estrela)
    );
    estrela.addEventListener('click', () => acaoCartao(a, 'favorita'));
    const mais = h('select', { class: 'campo atividade__mais', 'aria-label': t('atividades.maisAcoes', { titulo: a.titulo }) }, [
      h('option', { value: '' }, t('atividades.mais')),
      h('option', { value: 'copia' }, t('atividades.editarCopia')),
      h('option', { value: 'duplicar' }, t('atividades.duplicar')),
      h('option', { value: 'json' }, t('atividades.exportarJSON')),
      h('option', { value: 'csv' }, t('atividades.exportarCSV')),
      h('option', { value: 'apagar' }, t('atividades.apagar')),
    ]);
    mais.addEventListener('change', () => {
      const acao = mais.value;
      mais.value = '';
      if (acao) acaoCartao(a, acao);
    });
    return h(
      'li',
      { class: 'cartao atividade', 'data-modalidade': a.modalidade },
      h('div', { class: 'atividade__topo' }, h('span', { class: 'etiqueta atividade__modalidade' }, nomeModalidade(a.modalidade)), estrela),
      h('h2', { class: 'atividade__titulo' }, h('a', { href: `#/atividades/editar?id=${a.id}` }, a.titulo)),
      h(
        'p',
        { class: 'texto-suave atividade__meta' },
        [t('atividades.nPerguntas', { n }), a.disciplina, t(`dificuldade.${a.dificuldade}`)].filter(Boolean).join(' · ')
      ),
      a.tags.length ? h('ul', { class: 'atividade__tags', role: 'list' }, a.tags.map((tg) => h('li', { class: 'etiqueta' }, `#${tg}`))) : null,
      h(
        'div',
        { class: 'linha atividade__acoes' },
        h('a', { class: 'botao botao--primario', href: `#/jogar?id=${a.id}` }, t('atividades.jogar')),
        h('a', { class: 'botao', href: `#/atividades/editar?id=${a.id}` }, t('atividades.editar')),
        h('a', { class: 'botao', href: `#/atividades/testar?id=${a.id}` }, t('atividades.testar')),
        mais
      )
    );
  }

  function desenhar() {
    const validas = todas.filter((a) => !a.erro);
    const achadas = buscar(validas, filtro);
    const comErro = todas.filter((a) => a.erro);
    contagem.textContent = t('atividades.contagem', { n: achadas.length, total: validas.length });
    if (!todas.length) {
      lista.replaceChildren(h('li', { class: 'vazio cartao' }, Mascote({ humor: 'neutro', tamanho: '6rem' }), h('p', null, t('atividades.vazio'))));
      return;
    }
    lista.replaceChildren(...achadas.map(cartao), ...comErro.map(cartao));
    if (!achadas.length) lista.prepend(h('li', { class: 'vazio' }, h('p', null, t('atividades.nadaAchado'))));
  }

  alvo.append(
    h(
      'div',
      { class: 'tela__topo buzzer-topo' },
      h('div', null, h('h1', { tabindex: '-1' }, t('atividades.titulo')), h('p', { class: 'tela__subtitulo' }, t('atividades.subtitulo'))),
      h('div', { class: 'linha' }, Botao({ texto: t('atividades.nova'), variante: 'primario', icone: 'mais', aoClicar: nova }), Botao({ texto: t('atividades.importar'), aoClicar: importar }), Botao({ texto: t('atividades.exportarTudo'), variante: 'fantasma', aoClicar: exportarTodas }))
    ),
    h(
      'section',
      { class: 'filtros cartao', 'aria-label': t('atividades.filtros') },
      h('div', { class: 'filtros__busca pilha pilha--justa' }, h('label', { for: 'atv-busca', class: 'rotulo' }, t('atividades.buscar')), busca),
      h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'atv-disc', class: 'rotulo' }, t('atividades.disciplina')), selDisc),
      h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'atv-tag', class: 'rotulo' }, t('atividades.tag')), selTag),
      h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'atv-dif', class: 'rotulo' }, t('atividades.dificuldade')), selDif),
      h('div', { class: 'filtros__fav' }, favoritas)
    ),
    contagem,
    lista
  );
  carregar();
}
