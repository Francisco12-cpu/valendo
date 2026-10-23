// "De onde vêm os nomes?": uma turma salva ou uma lista digitada na hora.
// aoMudar(alunos, { turmaId, texto }) é chamado sempre que a lista muda.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { listar } from '../../storage/db.js';
import { lerLista } from '../../core/teams.js';

let contador = 0;

export function FonteDeNomes({ turmaId = '', texto = '', aoMudar }) {
  const id = `fonte-${++contador}`;
  const seletor = h('select', { id, class: 'campo' }, h('option', { value: '' }, t('fonte.digitar')));
  const area = h('textarea', {
    id: `${id}-texto`,
    class: 'campo campo--area',
    rows: 6,
    placeholder: t('fonte.placeholder'),
    spellcheck: 'false',
  });
  area.value = texto;
  const contagem = h('p', { class: 'texto-suave fonte__contagem', 'aria-live': 'polite' });
  const blocoTexto = h('div', { class: 'pilha fonte__texto' }, h('label', { for: area.id }, t('fonte.rotuloTexto')), area);
  let turmas = [];

  const atual = () => {
    if (seletor.value) {
      const turma = turmas.find((tm) => tm.id === seletor.value);
      return (turma?.alunos ?? []).map((a) => ({ ...a }));
    }
    return lerLista(area.value);
  };

  const avisar = () => {
    blocoTexto.hidden = Boolean(seletor.value);
    const alunos = atual();
    contagem.textContent = t('fonte.contagem', { n: alunos.length });
    if (aoMudar) aoMudar(alunos, { turmaId: seletor.value, texto: area.value });
  };

  seletor.addEventListener('change', avisar);
  area.addEventListener('input', avisar);

  listar('turmas').then((lista) => {
    turmas = lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    for (const turma of turmas) seletor.append(h('option', { value: turma.id }, `${turma.nome} (${turma.alunos.length})`));
    if (turmaId && turmas.some((tm) => tm.id === turmaId)) seletor.value = turmaId;
    avisar();
  });

  const el = h(
    'div',
    { class: 'fonte pilha' },
    h('div', { class: 'pilha fonte__origem' }, h('label', { for: id }, t('fonte.rotulo')), seletor),
    blocoTexto,
    h('div', { class: 'linha fonte__rodape' }, contagem, h('a', { href: '#/turmas' }, t('fonte.gerenciar')))
  );
  el.alunos = atual;
  return el;
}
