// #/ferramentas — a pasta com as ferramentas rápidas da sala de aula.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { CartaoPasta } from '../components/pasta.js';

const ITENS = [
  { id: 'cronometro', icone: 'ferramentas', cor: 'var(--cor-ferramentas)', href: '#/cronometro' },
  { id: 'equipes', icone: 'equipes', cor: 'var(--cor-passa)', href: '#/equipes' },
  { id: 'turmas', icone: 'turmas', cor: 'var(--cor-sorteio)', href: '#/turmas' },
  { id: 'placar', icone: 'placar', cor: 'var(--cor-placar)', href: '#/placar' },
  { id: 'sorteio', icone: 'sorteio', cor: 'var(--cor-sorteio)', href: '#/sorteio' },
  { id: 'buzzer', icone: 'buzzer', cor: 'var(--cor-buzzer)', href: '#/buzzer' },
];

export const titulo = () => t('ferramentas.titulo');

export function render(alvo) {
  alvo.append(
    h('div', { class: 'tela__topo' }, h('h1', { tabindex: '-1' }, t('ferramentas.titulo')), h('p', { class: 'tela__subtitulo' }, t('ferramentas.subtitulo'))),
    h(
      'ul',
      { class: 'grade-pastas', role: 'list' },
      ITENS.map((item, i) =>
        h(
          'li',
          null,
          CartaoPasta({
            titulo: t(`ferramentas.${item.id}`),
            aba: String(i + 1).padStart(2, '0'),
            descricao: t(`ferramentas.${item.id}Desc`),
            cor: item.cor,
            icone: item.icone,
            href: item.href,
          })
        )
      )
    )
  );
}
