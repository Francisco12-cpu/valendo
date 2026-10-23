// Tela Sobre/Créditos (§13): nome, Instagram, repositório e licença.
import { h } from '../dom.js';
import { t, tPartes } from '../../i18n/i18n.js';
import { VERSAO, REPOSITORIO } from '../../config.js';
import { PostIt } from '../components/postit.js';
import { Mascote } from '../components/mascote.js';

export const titulo = () => t('sobre.titulo');

function item(rotulo, valor) {
  return h('div', { class: 'sobre__item' }, h('dt', null, rotulo), h('dd', null, valor));
}

export function render(alvo) {
  const instagram = h(
    'a',
    { href: t('creditos.instagramUrl'), target: '_blank', rel: 'noopener' },
    t('creditos.instagram')
  );
  const repositorio = REPOSITORIO
    ? h('a', { href: REPOSITORIO, target: '_blank', rel: 'noopener' }, REPOSITORIO.replace(/^https?:\/\//, ''))
    : h('span', { class: 'texto-suave' }, t('sobre.repositorioPendente'));

  alvo.append(
    h(
      'div',
      { class: 'tela__topo' },
      h('h1', { tabindex: '-1' }, t('sobre.titulo')),
      h('p', { class: 'tela__subtitulo' }, t('sobre.intro'))
    ),
    h(
      'div',
      { class: 'sobre' },
      h(
        'section',
        { class: 'cartao sobre__creditos', 'aria-labelledby': 'sobre-autor' },
        h('h2', { id: 'sobre-autor' }, t('sobre.autorTitulo')),
        h(
          'p',
          null,
          tPartes('sobre.autorTexto', { autor: h('strong', { class: 'marca-texto' }, t('creditos.autor')) })
        ),
        h(
          'dl',
          { class: 'sobre__lista' },
          item(t('sobre.instagram'), instagram),
          item(t('sobre.repositorio'), repositorio),
          item(t('sobre.licenca'), t('sobre.licencaTexto')),
          item(t('sobre.privacidadeTitulo'), t('sobre.privacidadeTexto'))
        ),
        h('p', { class: 'texto-suave sobre__rodape' }, t('sobre.fontes'), ' ', t('sobre.versao', { versao: VERSAO }))
      ),
      h(
        'div',
        { class: 'sobre__lado' },
        Mascote({ humor: 'feliz', tamanho: '7rem' }),
        PostIt({ texto: t('sobre.postit'), inclinacao: 3 }),
        h('a', { class: 'botao', href: '#/vitrine' }, t('sobre.vitrine'))
      )
    )
  );
}
