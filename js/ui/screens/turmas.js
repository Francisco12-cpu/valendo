// #/turmas — turmas salvas no aparelho (IndexedDB). #/turmas?id=... abre o editor.
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { listar, ler, salvar, apagar, novoId } from '../../storage/db.js';
import { lerLista } from '../../core/teams.js';
import { Botao, ativarAfundar } from '../components/botao.js';
import { abrirModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { icones } from '../components/icones.js';
import { Mascote } from '../components/mascote.js';

export const titulo = () => t('turmas.titulo');

// Último salvamento em andamento: a lista espera por ele para não mostrar dados velhos.
let salvando = Promise.resolve();

export function render(alvo, params) {
  const id = params.get('id');
  if (!id) {
    lista(alvo);
    return null;
  }
  let limparEditor = null;
  editor(alvo, id).then((limpar) => (limparEditor = limpar));
  return () => limparEditor?.();
}

async function lista(alvo) {
  await salvando;
  const nova = Botao({
    texto: t('turmas.nova'),
    variante: 'primario',
    icone: 'mais',
    aoClicar: async () => {
      const turma = await salvar('turmas', { id: novoId('turma'), nome: t('turmas.nomePadrao'), alunos: [] });
      location.hash = `#/turmas?id=${turma.id}`;
    },
  });
  const grade = h('ul', { class: 'turmas-lista', role: 'list' });
  alvo.append(
    h('div', { class: 'tela__topo buzzer-topo' }, h('div', null, h('h1', { tabindex: '-1' }, t('turmas.titulo')), h('p', { class: 'tela__subtitulo' }, t('turmas.subtitulo'))), nova),
    grade
  );

  const turmas = (await listar('turmas')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (!turmas.length) {
    grade.replaceWith(
      h('div', { class: 'vazio cartao' }, Mascote({ humor: 'neutro', tamanho: '6rem' }), h('p', null, t('turmas.vazio')))
    );
    return;
  }
  grade.append(
    ...turmas.map((turma) =>
      h(
        'li',
        null,
        ativarAfundar(
          h(
            'a',
            { class: 'cartao turma-cartao', href: `#/turmas?id=${turma.id}` },
            h('span', { class: 'turma-cartao__nome manuscrito' }, turma.nome),
            h('span', { class: 'texto-suave' }, t('turmas.alunos', { n: turma.alunos.length }))
          )
        )
      )
    )
  );
}

async function editor(alvo, id) {
  const turma = await ler('turmas', id);
  if (!turma) {
    location.hash = '#/turmas';
    return;
  }
  let alunos = turma.alunos.map((a) => ({ ...a }));
  let guardar = null;
  const salvarAgora = () => {
    guardar = null;
    salvando = salvar('turmas', { ...turma, nome: campoNome.value.trim() || t('turmas.nomePadrao'), alunos });
  };
  const salvarDepois = () => {
    clearTimeout(guardar);
    guardar = setTimeout(salvarAgora, 300);
  };

  const campoNome = h('input', { id: 'turma-nome', class: 'campo campo--titulo', maxlength: 60, autocomplete: 'off' });
  campoNome.value = turma.nome;
  campoNome.addEventListener('input', salvarDepois);

  const corpo = h('ol', { class: 'alunos', role: 'list' });
  const contagem = h('p', { class: 'texto-suave', 'aria-live': 'polite' });

  function desenhar() {
    contagem.textContent = t('turmas.alunos', { n: alunos.length });
    corpo.replaceChildren(
      ...alunos.map((aluno, i) => {
        const nome = h('input', { class: 'campo', value: aluno.nome, maxlength: 40, 'aria-label': t('turmas.nomeAluno', { n: i + 1 }) });
        nome.value = aluno.nome;
        nome.addEventListener('input', () => {
          aluno.nome = nome.value;
          salvarDepois();
        });
        const nivel = h(
          'select',
          { class: 'campo campo--nivel', 'aria-label': t('turmas.nivelDe', { nome: aluno.nome || i + 1 }), title: t('turmas.nivelDica') },
          [1, 2, 3].map((n) => h('option', { value: n }, t(`turmas.nivel${n}`)))
        );
        nivel.value = String(aluno.nivel ?? 2);
        nivel.addEventListener('change', () => {
          aluno.nivel = Number(nivel.value);
          salvarDepois();
        });
        const remover = Botao({
          icone: 'fechar',
          variante: 'fantasma',
          rotulo: t('turmas.remover', { nome: aluno.nome }),
          aoClicar: () => {
            alunos = alunos.filter((a) => a !== aluno);
            salvarDepois();
            desenhar();
          },
        });
        return h('li', { class: 'alunos__linha' }, h('span', { class: 'alunos__numero', 'aria-hidden': 'true' }, String(i + 1)), nome, nivel, remover);
      })
    );
  }
  desenhar();

  const adicionar = Botao({
    texto: t('turmas.adicionar'),
    icone: 'mais',
    aoClicar: () => {
      alunos.push({ id: novoId('aluno'), nome: '', nivel: 2 });
      salvarDepois();
      desenhar();
      corpo.querySelector('li:last-child input')?.focus();
    },
  });

  const colar = Botao({
    texto: t('turmas.colar'),
    aoClicar: async () => {
      const area = h('textarea', { class: 'campo campo--area', rows: 8, placeholder: t('fonte.placeholder'), 'aria-label': t('turmas.colar') });
      const valor = await abrirModal({
        titulo: t('turmas.colar'),
        conteudo: h('div', { class: 'pilha' }, h('p', { class: 'texto-suave' }, t('turmas.colarDica')), area),
        acoes: [
          { texto: t('vitrine.secundario'), valor: null },
          { texto: t('turmas.colarConfirmar'), variante: 'primario', valor: 'ok' },
        ],
      });
      if (valor !== 'ok') return;
      const novos = lerLista(area.value).map((a) => ({ ...a, id: novoId('aluno') }));
      alunos.push(...novos);
      salvarDepois();
      desenhar();
      toast(t('turmas.colados', { n: novos.length }), { tipo: 'sucesso' });
    },
  });

  const excluir = Botao({
    texto: t('turmas.apagar'),
    variante: 'perigo',
    aoClicar: async () => {
      const ok = await abrirModal({
        titulo: t('turmas.apagarTitulo'),
        conteudo: t('turmas.apagarTexto', { nome: campoNome.value }),
        acoes: [
          { texto: t('vitrine.secundario'), valor: false },
          { texto: t('turmas.apagar'), variante: 'perigo', valor: true },
        ],
      });
      if (!ok) return;
      clearTimeout(guardar);
      await apagar('turmas', id);
      toast(t('turmas.apagada'));
      location.hash = '#/turmas';
    },
  });

  alvo.append(
    h('p', null, h('a', { href: '#/turmas', class: 'voltar' }, svg(icones.voltar), t('turmas.todas'))),
    h(
      'div',
      { class: 'tela__topo' },
      h('h1', { tabindex: '-1', class: 'sr-only' }, t('turmas.editar')),
      h('label', { for: 'turma-nome', class: 'texto-suave' }, t('turmas.nomeTurma')),
      campoNome,
      contagem
    ),
    h('section', { class: 'cartao pilha', 'aria-label': t('turmas.listaAlunos') }, h('p', { class: 'texto-suave' }, t('turmas.nivelDica')), corpo, h('div', { class: 'linha' }, adicionar, colar)),
    h('div', { class: 'linha buzzer-rodape' }, h('a', { class: 'botao botao--primario', href: '#/turmas' }, t('turmas.pronto')), excluir)
  );

  return () => {
    // Garante o último salvamento ao sair.
    if (guardar) {
      clearTimeout(guardar);
      salvarAgora();
    }
  };
}
