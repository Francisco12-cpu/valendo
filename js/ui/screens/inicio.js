// Tela inicial: destaque com o "Valendo relâmpago", as pastas das modalidades e como funciona.
import { h, svg } from '../dom.js';
import { t, tPartes } from '../../i18n/i18n.js';
import { CartaoPasta } from '../components/pasta.js';
import { PostIt } from '../components/postit.js';
import { Mascote } from '../components/mascote.js';
import { ativarAfundar } from '../components/botao.js';
import { toast } from '../components/toast.js';
import { icones } from '../components/icones.js';

// href = modalidade pronta; sem href = "Em breve".
const MODALIDADES = [
  { id: 'buzzer', icone: 'buzzer', cor: 'var(--cor-buzzer)', href: '#/buzzer' },
  { id: 'placar', icone: 'placar', cor: 'var(--cor-placar)', href: '#/placar' },
  { id: 'sorteio', icone: 'sorteio', cor: 'var(--cor-sorteio)', href: '#/sorteio' },
  { id: 'quiz', icone: 'quiz', cor: 'var(--cor-quiz)' },
  { id: 'passa', icone: 'passa', cor: 'var(--cor-passa)' },
  { id: 'espiral', icone: 'espiral', cor: 'var(--cor-espiral)' },
  { id: 'provas', icone: 'provas', cor: 'var(--cor-provas)', sobreCor: 'var(--sobre-info)' },
  { id: 'ferramentas', icone: 'ferramentas', cor: 'var(--cor-ferramentas)', href: '#/ferramentas' },
];

export const titulo = () => t('app.nome');

function botaoLink(href, classe, icone, texto) {
  return ativarAfundar(h('a', { class: `botao ${classe}`, href }, icone ? svg(icones[icone]) : null, h('span', null, texto)));
}

export function render(alvo) {
  const prontas = MODALIDADES.filter((m) => m.href).length;

  const destaque = h(
    'section',
    { class: 'destaque pautado', 'aria-labelledby': 'inicio-titulo' },
    h(
      'div',
      { class: 'destaque__texto' },
      h(
        'ul',
        { class: 'destaque__selos', role: 'list' },
        ['inicio.seloGratis', 'inicio.seloOffline', 'inicio.seloSemConta'].map((c) => h('li', { class: 'etiqueta' }, t(c)))
      ),
      h('h1', { id: 'inicio-titulo', tabindex: '-1' }, tPartes('inicio.titulo', { destaque: h('span', { class: 'marca-texto' }, t('inicio.tituloDestaque')) })),
      h('p', { class: 'tela__subtitulo' }, t('inicio.subtitulo')),
      h(
        'div',
        { class: 'destaque__acoes' },
        botaoLink('#/buzzer/jogar?relampago', 'botao--primario botao--grande', 'raio', t('inicio.relampago')),
        botaoLink('#/buzzer', '', 'buzzer', t('inicio.montarBuzzer'))
      ),
      h('p', { class: 'destaque__dica texto-suave' }, t('inicio.relampagoDica'))
    ),
    h(
      'div',
      { class: 'destaque__arte', 'aria-hidden': 'true' },
      h('span', { class: 'seta destaque__seta' }, svg(icones.seta)),
      Mascote({ humor: 'feliz', tamanho: '9rem' }),
      PostIt({ texto: t('inicio.postit'), inclinacao: 4 })
    )
  );

  const pastas = MODALIDADES.map((m, i) => {
    const nome = t(`modalidade.${m.id}`);
    const pronta = Boolean(m.href);
    return h(
      'li',
      null,
      CartaoPasta({
        titulo: nome,
        aba: String(i + 1).padStart(2, '0'),
        descricao: t(`modalidade.${m.id}.desc`),
        cor: m.cor,
        sobreCor: m.sobreCor,
        icone: m.icone,
        href: m.href,
        desativado: !pronta,
        etiqueta: pronta ? t('inicio.novo') : t('inicio.emBreve'),
        aoClicarDesativado: () => toast(t('inicio.emBreveToast', { nome }), { tipo: 'aviso' }),
      })
    );
  });

  const passos = ['passo1', 'passo2', 'passo3'].map((p, i) =>
    h(
      'li',
      { class: 'passo' },
      h('span', { class: 'passo__numero', 'aria-hidden': 'true' }, String(i + 1)),
      h('h3', null, t(`inicio.${p}`)),
      h('p', { class: 'texto-suave' }, t(`inicio.${p}Desc`))
    )
  );

  alvo.append(
    destaque,
    h(
      'section',
      { class: 'secao', 'aria-labelledby': 'inicio-pastas' },
      h(
        'div',
        { class: 'secao__topo' },
        h('h2', { id: 'inicio-pastas', class: 'secao__titulo' }, tPartes('inicio.pastas', { destaque: h('span', { class: 'marca-texto' }, t('inicio.pastasDestaque')) })),
        h('span', { class: 'etiqueta' }, t('inicio.prontas', { n: prontas, total: MODALIDADES.length }))
      ),
      h('ul', { class: 'grade-pastas', role: 'list' }, pastas)
    ),
    h(
      'section',
      { class: 'secao', 'aria-labelledby': 'inicio-como' },
      h('h2', { id: 'inicio-como', class: 'secao__titulo' }, t('inicio.comoFunciona')),
      h('ol', { class: 'passos', role: 'list' }, passos)
    )
  );
}
